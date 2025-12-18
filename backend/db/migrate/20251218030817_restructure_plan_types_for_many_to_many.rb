# Restructure plan_types to support many-to-many with categories
#
# BEFORE: plan_types belongs_to plan_category (one plan type per category)
#   - If you want PERSPECTIVE in 3 categories, you create 3 rows
#
# AFTER: plan_types has_and_belongs_to_many plan_categories (via join table)
#   - PERSPECTIVE exists ONCE, linked to multiple categories
#
class RestructurePlanTypesForManyToMany < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Create join table
    create_table :plan_category_plan_types do |t|
      t.references :plan_category, null: false, foreign_key: true
      t.references :plan_type, null: false, foreign_key: true
      t.integer :sequence_order, default: 0  # Order within category
      t.timestamps
    end

    add_index :plan_category_plan_types, [:plan_category_id, :plan_type_id],
              unique: true, name: 'idx_plan_cat_type_unique'

    # Step 2: Migrate existing data - merge duplicates by name
    # Keep the first occurrence of each name, link to all its categories
    execute <<-SQL
      -- First, insert join records for ALL existing plan_types
      INSERT INTO plan_category_plan_types (plan_category_id, plan_type_id, sequence_order, created_at, updated_at)
      SELECT plan_category_id, id, sequence_order, NOW(), NOW()
      FROM plan_types
      WHERE plan_category_id IS NOT NULL;
    SQL

    # Step 3: For duplicates (same name), we need to:
    # - Keep one canonical plan_type per unique name
    # - Update job_plans to point to the canonical one
    # - Update join table to point to canonical one
    # - Delete the duplicate plan_types

    # Find duplicates and merge them
    duplicates = execute(<<-SQL).to_a
      SELECT name, array_agg(id ORDER BY id) as ids, COUNT(*) as cnt
      FROM plan_types
      GROUP BY name
      HAVING COUNT(*) > 1;
    SQL

    duplicates.each do |row|
      name = row['name']
      ids = row['ids'].gsub(/[{}]/, '').split(',').map(&:to_i)
      canonical_id = ids.first
      duplicate_ids = ids[1..-1]

      next if duplicate_ids.empty?

      # Update job_plans to use canonical ID
      execute "UPDATE job_plans SET plan_type_id = #{canonical_id} WHERE plan_type_id IN (#{duplicate_ids.join(',')})"

      # Update join table - change duplicate references to canonical
      # But first check if canonical already has that category
      duplicate_ids.each do |dup_id|
        execute <<-SQL
          UPDATE plan_category_plan_types
          SET plan_type_id = #{canonical_id}
          WHERE plan_type_id = #{dup_id}
          AND plan_category_id NOT IN (
            SELECT plan_category_id FROM plan_category_plan_types WHERE plan_type_id = #{canonical_id}
          );
        SQL

        # Delete any remaining duplicates in join table
        execute "DELETE FROM plan_category_plan_types WHERE plan_type_id = #{dup_id}"
      end

      # Delete duplicate plan_types
      execute "DELETE FROM plan_types WHERE id IN (#{duplicate_ids.join(',')})"
    end

    # Step 4: Remove the plan_category_id column (now using join table)
    remove_reference :plan_types, :plan_category, foreign_key: true

    # Step 5: Add unique constraint on plan_type name + code
    add_index :plan_types, :name, unique: true
    add_index :plan_types, :code, unique: true
  end

  def down
    # Re-add plan_category_id
    add_reference :plan_types, :plan_category, foreign_key: true

    # This is a lossy rollback - we can only link each plan_type to ONE category
    # We'll use the first category from the join table
    execute <<-SQL
      UPDATE plan_types pt
      SET plan_category_id = (
        SELECT plan_category_id
        FROM plan_category_plan_types pcpt
        WHERE pcpt.plan_type_id = pt.id
        ORDER BY pcpt.created_at
        LIMIT 1
      );
    SQL

    # Remove unique indexes
    remove_index :plan_types, :name, if_exists: true
    remove_index :plan_types, :code, if_exists: true

    # Drop join table
    drop_table :plan_category_plan_types
  end
end

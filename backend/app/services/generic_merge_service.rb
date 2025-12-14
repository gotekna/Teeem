# frozen_string_literal: true

# Generic merge service that works for ANY model
# Uses Rails reflection AND database FK constraints to handle ALL relationships
#
# Usage:
#   GenericMergeService.new(primary_record, secondary_records, ModelClass).merge!
#
# Key features:
# - Transfers ALL has_many/has_one associations (including restrict_with_error)
# - Falls back to database FK constraints for undeclared associations
# - Handles unique constraint conflicts by deleting duplicates
# - Logs all transfer operations for debugging
#
class GenericMergeService
  attr_reader :primary, :secondaries, :model_class, :merged_count

  def initialize(primary, secondaries, model_class)
    @primary = primary
    @secondaries = Array(secondaries)
    @model_class = model_class
    @merged_count = 0
    @transferred_tables = Set.new  # Track which tables we've already transferred
  end

  def merge!
    return primary if secondaries.empty?

    ActiveRecord::Base.transaction do
      secondaries.each do |secondary|
        next if secondary.id == primary.id

        Rails.logger.info "[Merge] Merging #{model_class.name}##{secondary.id} into ##{primary.id}"

        # Step 1: Transfer via Rails associations (most reliable)
        transfer_associations(secondary)

        # Step 2: Transfer any remaining FK references via database schema
        # This catches tables that aren't declared as associations
        transfer_database_fk_references(secondary)

        # Step 3: Fill blank fields from secondary
        fill_blank_fields(secondary)

        # Step 4: Destroy the secondary record
        secondary.destroy!
        @merged_count += 1

        Rails.logger.info "[Merge] Successfully merged #{model_class.name}##{secondary.id}"
      end

      primary.save!
    end

    primary
  end

  private

  # Transfer all has_many relationships from secondary to primary
  # Uses Rails reflection to automatically discover associations
  # NOTE: We DO transfer restrict_with_error associations - we're merging, not deleting
  def transfer_associations(secondary)
    model_class.reflect_on_all_associations(:has_many).each do |reflection|
      # Skip through associations (they're handled via the source association)
      next if reflection.options[:through]

      foreign_key = reflection.foreign_key
      table_name = reflection.table_name

      # Track that we've handled this table
      @transferred_tables << table_name

      begin
        # Use savepoint to isolate failures - prevents PG::InFailedSqlTransaction
        ActiveRecord::Base.transaction(requires_new: true) do
          count = secondary.send(reflection.name).count
          if count > 0
            # Update all related records to point to primary
            secondary.send(reflection.name).update_all(foreign_key => primary.id)
            Rails.logger.info "[Merge] Transferred #{count} #{reflection.name} (#{table_name}.#{foreign_key})"
          end
        end
      rescue ActiveRecord::RecordNotUnique => e
        # Unique constraint violation - delete duplicates from secondary instead of transferring
        Rails.logger.warn "[Merge] Unique conflict on #{reflection.name}, deleting from secondary: #{e.message}"
        ActiveRecord::Base.transaction(requires_new: true) do
          secondary.send(reflection.name).destroy_all
        end
      rescue StandardError => e
        Rails.logger.warn "[Merge] Could not transfer #{reflection.name}: #{e.message}"
      end
    end

    # Also handle has_one associations
    model_class.reflect_on_all_associations(:has_one).each do |reflection|
      next if reflection.options[:through]

      foreign_key = reflection.foreign_key
      table_name = reflection.table_name

      # Track that we've handled this table
      @transferred_tables << table_name

      begin
        ActiveRecord::Base.transaction(requires_new: true) do
          related = secondary.send(reflection.name)
          if related.present?
            if primary.send(reflection.name).blank?
              related.update!(foreign_key => primary.id)
              Rails.logger.info "[Merge] Transferred has_one #{reflection.name}"
            else
              # Primary already has one - delete secondary's
              related.destroy
              Rails.logger.info "[Merge] Deleted duplicate has_one #{reflection.name}"
            end
          end
        end
      rescue StandardError => e
        Rails.logger.warn "[Merge] Could not transfer #{reflection.name}: #{e.message}"
      end
    end
  end

  # Transfer FK references that aren't declared as Rails associations
  # Queries the database schema directly for all FK constraints
  def transfer_database_fk_references(secondary)
    table_name = model_class.table_name

    # Query all FK constraints that reference this table
    fk_query = <<-SQL
      SELECT
        tc.table_name AS referencing_table,
        kcu.column_name AS referencing_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = '#{table_name}'
        AND ccu.column_name = 'id'
    SQL

    fk_references = ActiveRecord::Base.connection.execute(fk_query)

    fk_references.each do |fk|
      ref_table = fk["referencing_table"]
      ref_column = fk["referencing_column"]

      # Skip if we already handled this via Rails associations
      next if @transferred_tables.include?(ref_table)

      begin
        ActiveRecord::Base.transaction(requires_new: true) do
          # Count records to transfer
          count_sql = "SELECT COUNT(*) FROM #{ref_table} WHERE #{ref_column} = #{secondary.id}"
          count = ActiveRecord::Base.connection.execute(count_sql).first["count"].to_i

          if count > 0
            # Transfer FK references via direct SQL
            update_sql = "UPDATE #{ref_table} SET #{ref_column} = #{primary.id} WHERE #{ref_column} = #{secondary.id}"
            ActiveRecord::Base.connection.execute(update_sql)
            Rails.logger.info "[Merge] Transferred #{count} rows from #{ref_table}.#{ref_column} (via DB FK)"
          end
        end
      rescue ActiveRecord::RecordNotUnique => e
        # Unique constraint - delete instead
        Rails.logger.warn "[Merge] Unique conflict on #{ref_table}.#{ref_column}, deleting: #{e.message}"
        ActiveRecord::Base.transaction(requires_new: true) do
          delete_sql = "DELETE FROM #{ref_table} WHERE #{ref_column} = #{secondary.id}"
          ActiveRecord::Base.connection.execute(delete_sql)
        end
      rescue StandardError => e
        Rails.logger.warn "[Merge] Could not transfer #{ref_table}.#{ref_column}: #{e.message}"
      end
    end
  end

  # Fill blank fields on primary with values from secondary
  def fill_blank_fields(secondary)
    filled = []
    primary.attributes.each_key do |attr|
      # Skip system columns
      next if %w[id created_at updated_at].include?(attr)

      # Only fill if primary is blank and secondary has a value
      next if primary[attr].present?
      next if secondary[attr].blank?

      primary[attr] = secondary[attr]
      filled << attr
    end

    Rails.logger.info "[Merge] Filled #{filled.size} blank fields: #{filled.join(', ')}" if filled.any?
  end
end

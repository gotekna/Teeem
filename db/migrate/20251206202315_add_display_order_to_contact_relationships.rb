class AddDisplayOrderToContactRelationships < ActiveRecord::Migration[8.0]
  def change
    add_column :contact_relationships, :display_order, :integer, default: 0

    # Backfill existing employee relationships with sequential display_order
    # grouped by the company they belong to
    reversible do |dir|
      dir.up do
        # For each company, order their employees by created_at and assign display_order
        execute <<-SQL
          WITH numbered_employees AS (
            SELECT
              id,
              ROW_NUMBER() OVER (
                PARTITION BY related_contact_id
                ORDER BY created_at ASC
              ) - 1 AS new_order
            FROM contact_relationships
            WHERE relationship_type = 'employee_of'
              AND is_active = true
          )
          UPDATE contact_relationships
          SET display_order = numbered_employees.new_order
          FROM numbered_employees
          WHERE contact_relationships.id = numbered_employees.id;
        SQL
      end
    end

    # Add index for efficient ordering queries
    add_index :contact_relationships, [ :related_contact_id, :display_order ],
              name: 'index_contact_relationships_on_company_and_order'
  end
end

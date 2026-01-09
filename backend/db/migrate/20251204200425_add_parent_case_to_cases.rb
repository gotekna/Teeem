class AddParentCaseToCases < ActiveRecord::Migration[8.0]
  def change
    # Add self-referential parent_case_id for nested cases
    # null: true because top-level cases have no parent
    add_reference :cases, :parent_case, null: true, foreign_key: { to_table: :cases }

    # Add hierarchy_level for easier querying (0 = root, 1 = child, 2 = grandchild, etc.)
    add_column :cases, :hierarchy_level, :integer, default: 0

    # Index for finding all children of a case
    add_index :cases, [ :parent_case_id, :status ], name: 'index_cases_on_parent_and_status'
  end
end

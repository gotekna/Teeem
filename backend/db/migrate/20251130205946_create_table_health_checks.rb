class CreateTableHealthChecks < ActiveRecord::Migration[8.0]
  def change
    create_table :table_health_checks do |t|
      t.references :foundation, foreign_key: true, null: true  # null for system tables
      t.string :table_name, null: true  # Alternative to foundation_id for system tables (contacts, jobs, etc.)
      t.string :check_type, null: false  # 'duplicates', 'missing_required', 'orphaned_records', etc.
      t.string :name, null: false  # Display name: "Duplicate Contacts"
      t.text :description  # User-friendly explanation of what this check does
      t.string :api_endpoint, null: false  # "/api/v1/contacts/possible_duplicates"
      t.string :severity, default: 'warning'  # 'critical', 'warning', 'info'
      t.boolean :enabled, default: true
      t.string :icon  # Heroicon name for display
      t.string :action_path  # Where clicking an item navigates to (e.g., "/contacts/:id")
      t.integer :display_order, default: 0  # Order within a table's health checks
      t.timestamps
    end

    # foundation_id index already created by t.references
    add_index :table_health_checks, :table_name
    add_index :table_health_checks, :check_type
    add_index :table_health_checks, :enabled
  end
end

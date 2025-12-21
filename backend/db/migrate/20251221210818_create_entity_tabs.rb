# Unified Tab & Document Management System
# SSoT: This replaces CorporateEntityTab, DocumentFolder, JobTab, JobDocumentationTab,
#       XeroFeatureTab, and UserJobTabConfig with ONE unified model
class CreateEntityTabs < ActiveRecord::Migration[8.0]
  def change
    create_table :entity_tabs do |t|
      # Core Identity
      t.string :scope, null: false        # 'corporate_entity' | 'people' | 'job' | 'document' | 'xero'
      t.string :tab_key, null: false      # Unique identifier within scope (e.g., "xero", "overview")
      t.string :display_name, null: false # User-facing label
      t.text :description                 # Optional description for admins

      # Grouping & Hierarchy
      t.string :tab_group                 # 'overview' | 'documents' | 'data' | 'special'
      t.references :parent, foreign_key: { to_table: :entity_tabs }, null: true

      # Job-Specific Tabs (for per-job custom folders)
      t.references :job, foreign_key: true, null: true  # NULL = global, set = job-specific

      # Filtering - which entity sub-types see this tab
      # Corporate: ["Company", "Trust", "Superfund", "Charity"]
      t.string :entity_filters, array: true, default: []

      # Display
      t.integer :order_position, default: 0
      t.boolean :enabled, default: true
      t.string :icon_name
      t.string :component_name            # React component to render (e.g., 'XeroBankStatementsKanban')

      # System tab protection
      t.boolean :is_system_tab, default: false  # System tabs cannot be deleted

      # SharePoint Integration
      t.boolean :has_sharepoint_folder, default: false
      t.string :sharepoint_folder_path

      t.timestamps
    end

    # Indexes for performance
    add_index :entity_tabs, :scope
    add_index :entity_tabs, :enabled
    add_index :entity_tabs, [:scope, :enabled]
    add_index :entity_tabs, [:scope, :tab_group]
    add_index :entity_tabs, :entity_filters, using: :gin

    # Unique constraint: tab_key must be unique within scope + job_id
    # This allows same tab_key across different scopes and per-job tabs
    add_index :entity_tabs, [:scope, :tab_key, :job_id], unique: true, name: 'idx_entity_tabs_unique_key'
  end
end

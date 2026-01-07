class AddContactPerformanceIndexes < ActiveRecord::Migration[8.0]
  # Performance optimization: Add missing indexes for common query patterns
  # Identified via Contact Ultra Audit - these columns are frequently filtered but not indexed
  def change
    # Single column indexes for frequent WHERE clauses
    add_index :contacts, :entity_type, if_not_exists: true
    add_index :contacts, :is_family_member, if_not_exists: true
    add_index :contacts, :is_potential_director, if_not_exists: true

    # Composite indexes for common query patterns
    # (entity_type, is_active) - most common filter combination
    add_index :contacts, [:entity_type, :is_active], name: "idx_contacts_entity_type_active"

    # (entity_type, display_name) - type-filtered searches
    add_index :contacts, [:entity_type, :display_name], name: "idx_contacts_entity_type_display_name"

    # (is_team_contact, is_active) - team contact filters
    # Note: is_team_contact already has single index, this adds composite
    add_index :contacts, [:is_team_contact, :is_active], name: "idx_contacts_team_contact_active"

    # Trigram index for fast ILIKE searches on display_name
    # Requires pg_trgm extension (already enabled in TEEEM)
    execute <<-SQL
      CREATE INDEX IF NOT EXISTS idx_contacts_display_name_trgm
      ON contacts USING gin (display_name gin_trgm_ops);
    SQL
  end
end

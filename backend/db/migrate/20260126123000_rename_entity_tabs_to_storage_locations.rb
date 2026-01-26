# frozen_string_literal: true

# SSoT Rename: EntityTab → StorageLocation
# "StorageLocation" is clearer than "EntityTab" - it's just a folder configuration
class RenameEntityTabsToStorageLocations < ActiveRecord::Migration[8.0]
  def change
    # Rename the main table
    rename_table :entity_tabs, :storage_locations

    # Rename the join table
    rename_table :entity_tab_document_types, :storage_location_document_types

    # Rename foreign key columns in join table
    rename_column :storage_location_document_types, :entity_tab_id, :storage_location_id

    # Rename self-referential foreign key (parent_id stays the same, just update index names)
    # The column name parent_id is still appropriate

    # Rename indexes (Rails will handle most automatically, but let's be explicit for important ones)
    # Note: Rails 8 auto-renames indexes when table is renamed, but we ensure consistency
  end
end

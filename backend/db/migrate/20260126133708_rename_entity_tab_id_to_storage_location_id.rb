# frozen_string_literal: true

# SSoT Rename (Jan 2026): Complete the EntityTab → StorageLocation rename
# Renames the foreign key column to match the new model name
class RenameEntityTabIdToStorageLocationId < ActiveRecord::Migration[8.0]
  def change
    rename_column :entity_tab_document_types, :entity_tab_id, :storage_location_id
  end
end

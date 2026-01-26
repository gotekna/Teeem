# frozen_string_literal: true

# Phase 4: Virtual File Warehouse
# Add virtual_scopes JSONB column to enable UI-driven configuration
# of which scopes render from database (virtual) vs S3 (physical).
#
# Example: { "email" => true, "email_attachments" => true, "task" => true }
#
# When a scope is virtual:
# - Folder tree renders from WarehouseDocument.folder (database)
# - Reorganization is instant (bulk DB update)
# - Physical storage stays at Blobs/{hash}.ext (never moves)
class AddVirtualScopesToStorageConfigurations < ActiveRecord::Migration[7.1]
  def change
    add_column :storage_configurations, :virtual_scopes, :jsonb, default: {}, null: false
  end
end

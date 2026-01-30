# frozen_string_literal: true

# SSoT Rename (Jan 2026): StorageConfiguration → WarehouseProvider
# This clarifies the purpose: it's the provider (Wasabi/SharePoint/Local) for File Warehouse
class RenameStorageConfigurationsToWarehouseProviders < ActiveRecord::Migration[8.0]
  def change
    rename_table :storage_configurations, :warehouse_providers
  end
end

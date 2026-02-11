class AddConfigSyncTableTimestampsToTenantSettings < ActiveRecord::Migration[7.1]
  def change
    add_column :tenant_settings, :config_sync_table_timestamps, :jsonb, default: {}
  end
end

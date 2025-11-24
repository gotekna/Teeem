class AddFinancialSyncToAccountingIntegrations < ActiveRecord::Migration[8.0]
  def change
    # Note: last_sync_at and metadata already exist on this table
    # We'll use the existing metadata field and just add account_mappings and sync_settings
    add_column :accounting_integrations, :account_mappings, :jsonb, default: {}
    add_column :accounting_integrations, :sync_settings, :jsonb, default: {}
    add_column :accounting_integrations, :sync_error_message, :text
  end
end

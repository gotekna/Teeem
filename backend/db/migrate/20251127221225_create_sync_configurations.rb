class CreateSyncConfigurations < ActiveRecord::Migration[8.0]
  def change
    create_table :sync_configurations do |t|
      t.string :xero_tenant_id, null: false
      t.string :xero_tenant_name
      t.string :accounting_system, default: 'xero' # xero, quickbooks, myob
      t.jsonb :field_mappings, default: {} # Which fields sync in which direction
      t.jsonb :cleanup_options, default: {
        'delete_primary_person_after_import' => false,
        'archive_duplicates' => false,
        'standardize_abn_format' => true
      }
      t.boolean :sync_enabled, default: true
      t.boolean :webhooks_enabled, default: false
      t.datetime :last_full_sync_at
      t.datetime :webhooks_registered_at
      t.string :webhook_key # For signature validation
      t.jsonb :metadata, default: {}
      t.timestamps

      t.index :xero_tenant_id, unique: true
      t.index :accounting_system
    end
  end
end

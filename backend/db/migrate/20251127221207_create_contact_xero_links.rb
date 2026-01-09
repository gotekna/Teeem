class CreateContactXeroLinks < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_xero_links do |t|
      t.references :contact, null: false, foreign_key: true
      t.string :xero_tenant_id, null: false
      t.string :xero_tenant_name
      t.string :xero_contact_id, null: false
      t.boolean :sync_enabled, default: true
      t.string :sync_direction, default: 'bidirectional' # import_only, export_only, bidirectional
      t.datetime :last_synced_at
      t.datetime :xero_last_modified_at # For conflict detection
      t.string :sync_error
      t.jsonb :conflict_fields, default: {}
      t.jsonb :metadata, default: {}
      t.timestamps

      t.index [ :contact_id, :xero_tenant_id ], unique: true, name: 'idx_contact_xero_links_contact_tenant'
      t.index [ :xero_tenant_id, :xero_contact_id ], unique: true, name: 'idx_contact_xero_links_tenant_xero_id'
      t.index :xero_tenant_id
      t.index :sync_enabled
    end
  end
end

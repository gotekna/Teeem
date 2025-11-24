class CreateAccountingIntegrations < ActiveRecord::Migration[8.0]
  def change
    create_table :accounting_integrations do |t|
      t.references :contact, null: false, foreign_key: true
      t.string :system_type, null: false
      t.text :oauth_token
      t.text :refresh_token
      t.datetime :token_expires_at
      t.string :organization_id
      t.string :tenant_id
      t.datetime :last_sync_at
      t.string :sync_status
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :accounting_integrations, :system_type
    add_index :accounting_integrations, [:contact_id, :system_type], unique: true
    add_index :accounting_integrations, :last_sync_at
  end
end

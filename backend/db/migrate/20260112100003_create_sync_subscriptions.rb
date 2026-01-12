class CreateSyncSubscriptions < ActiveRecord::Migration[8.0]
  def change
    create_table :sync_subscriptions do |t|
      t.references :desktop_client, null: false, foreign_key: true

      # Polymorphic association to syncable entity (Job, CorporateCompany, Contact)
      t.string :syncable_type, null: false
      t.bigint :syncable_id, null: false

      # Sync settings for this subscription
      t.boolean :include_subfolders, default: true
      t.boolean :enabled, default: true

      # File type overrides for this specific subscription (override org/user defaults)
      # Example: { "include": [".rvt"], "exclude": [".tmp"] }
      t.jsonb :file_type_overrides, default: {}

      # Sync state
      t.string :delta_token  # Microsoft Graph delta token for this folder
      t.datetime :last_sync_at
      t.integer :files_synced, default: 0
      t.bigint :bytes_synced, default: 0

      t.timestamps
    end

    add_index :sync_subscriptions, [:syncable_type, :syncable_id]
    add_index :sync_subscriptions, [:desktop_client_id, :syncable_type, :syncable_id],
              unique: true, name: "idx_sync_subscriptions_unique"
  end
end

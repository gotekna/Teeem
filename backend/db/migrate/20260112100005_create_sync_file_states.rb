class CreateSyncFileStates < ActiveRecord::Migration[8.0]
  def change
    create_table :sync_file_states do |t|
      t.references :desktop_client, null: false, foreign_key: true
      t.references :sync_subscription, null: false, foreign_key: true

      # File identification
      t.string :remote_path, null: false  # Path on cloud storage
      t.string :remote_item_id            # SharePoint/S3 item ID
      t.string :file_name, null: false

      # Version tracking
      t.string :remote_etag               # Cloud version tag
      t.string :remote_content_hash       # Content hash from cloud
      t.string :local_content_hash        # Content hash on client (reported by client)
      t.bigint :file_size

      # Timestamps for sync
      t.datetime :remote_modified_at
      t.datetime :local_modified_at       # Reported by client
      t.datetime :last_synced_at

      # Sync status
      # 'synced' - Both sides match
      # 'pending_download' - Cloud has newer version
      # 'pending_upload' - Local has newer version
      # 'conflict' - Both sides changed
      # 'placeholder' - Files On-Demand placeholder (not downloaded)
      # 'pinned' - User wants this file always available offline
      t.string :sync_status, null: false, default: "pending_download"

      # Local state (reported by desktop client)
      t.boolean :is_placeholder, default: true   # Not yet downloaded
      t.boolean :is_pinned, default: false       # Keep offline always
      t.boolean :is_deleted, default: false      # Marked for deletion

      # Error tracking
      t.integer :error_count, default: 0
      t.text :last_error

      t.timestamps
    end

    add_index :sync_file_states, [:desktop_client_id, :remote_path], unique: true
    add_index :sync_file_states, :sync_status
    add_index :sync_file_states, :remote_item_id
    add_index :sync_file_states, :is_placeholder
    add_index :sync_file_states, :is_deleted
  end
end

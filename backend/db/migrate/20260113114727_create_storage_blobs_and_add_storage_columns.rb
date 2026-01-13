# frozen_string_literal: true

# Email Warehouse SSoT Refactor
#
# Purpose: Provider-agnostic storage with deduplication
#
# Changes:
# 1. Create storage_blobs table for deduplicated file storage
# 2. Add storage_path columns to email_warehouses (replace sharepoint_*)
# 3. Add storage_blob reference to email_attachments
#
class CreateStorageBlobsAndAddStorageColumns < ActiveRecord::Migration[8.0]
  def change
    # StorageBlob - SSoT for deduplicated file storage
    # Same file (by content_hash) = 1 storage copy
    create_table :storage_blobs do |t|
      t.string :content_hash, null: false
      t.string :storage_path, null: false
      t.bigint :file_size
      t.string :content_type
      t.integer :reference_count, default: 0, null: false
      t.string :original_filename  # First filename seen (for extension)
      t.timestamps
    end

    add_index :storage_blobs, :content_hash, unique: true
    add_index :storage_blobs, :storage_path

    # EmailWarehouse - Add provider-agnostic storage columns
    # Will replace sharepoint_email_path and sharepoint_email_file_id
    add_column :email_warehouses, :storage_path, :string
    add_column :email_warehouses, :storage_file_id, :string

    add_index :email_warehouses, :storage_path

    # EmailAttachment - Link to deduplicated StorageBlob
    add_reference :email_attachments, :storage_blob, foreign_key: true

    # Copy existing data from sharepoint_* columns to new storage_* columns
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE email_warehouses
          SET storage_path = sharepoint_email_path,
              storage_file_id = sharepoint_email_file_id
          WHERE sharepoint_email_path IS NOT NULL
            AND sharepoint_email_path != ''
        SQL
      end
    end
  end
end

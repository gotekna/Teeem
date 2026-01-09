class CreateAttachments < ActiveRecord::Migration[8.0]
  def change
    create_table :attachments do |t|
      t.string :sharepoint_file_id, null: false      # ID from SharePoint
      t.string :sharepoint_path, null: false         # Full path in SharePoint
      t.string :filename, null: false                # Original filename
      t.string :content_type                         # MIME type
      t.bigint :file_size                           # Size in bytes
      t.string :content_hash, null: false           # SHA256 hash for deduplication
      t.references :organization_microsoft_app_credential,
                   foreign_key: true,
                   index: { name: "index_attachments_on_org_cred_id" }
      t.timestamps

      t.index :content_hash, unique: true           # Enforce one file per hash
      t.index :sharepoint_file_id
    end
  end
end

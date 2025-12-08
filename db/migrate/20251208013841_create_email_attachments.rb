class CreateEmailAttachments < ActiveRecord::Migration[8.0]
  def change
    create_table :email_attachments do |t|
      t.references :email_warehouse, null: false, foreign_key: { to_table: :email_warehouse }
      t.references :company_document, foreign_key: true  # If linking to existing doc
      t.string :sharepoint_file_id  # If new attachment stored in SharePoint
      t.string :sharepoint_path
      t.string :outlook_attachment_id  # Original ID from Outlook API
      t.string :filename, null: false
      t.string :content_type
      t.bigint :file_size
      t.string :content_hash  # For deduplication (MD5/SHA of content)
      t.boolean :is_existing_doc, default: false  # true = linked to company_document, false = new upload
      t.timestamps

      t.index :sharepoint_file_id
      t.index :content_hash
      t.index :outlook_attachment_id
    end
  end
end

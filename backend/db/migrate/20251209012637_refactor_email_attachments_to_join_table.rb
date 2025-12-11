class RefactorEmailAttachmentsToJoinTable < ActiveRecord::Migration[8.0]
  def up
    # Remove file metadata columns (will live in attachments table)
    remove_column :email_attachments, :sharepoint_file_id
    remove_column :email_attachments, :sharepoint_path
    remove_column :email_attachments, :filename
    remove_column :email_attachments, :content_type
    remove_column :email_attachments, :file_size
    remove_column :email_attachments, :content_hash
    remove_column :email_attachments, :is_existing_doc
    remove_column :email_attachments, :company_document_id

    # Add reference to attachments table
    add_reference :email_attachments, :attachment, foreign_key: true

    # Add unique constraint to prevent duplicate links
    add_index :email_attachments,
              [ :email_warehouse_id, :attachment_id ],
              unique: true,
              name: "index_email_attachments_unique"
  end

  def down
    # Reverse the changes
    remove_index :email_attachments, name: "index_email_attachments_unique"
    remove_reference :email_attachments, :attachment

    add_column :email_attachments, :sharepoint_file_id, :string
    add_column :email_attachments, :sharepoint_path, :string
    add_column :email_attachments, :filename, :string, null: false
    add_column :email_attachments, :content_type, :string
    add_column :email_attachments, :file_size, :bigint
    add_column :email_attachments, :content_hash, :string
    add_column :email_attachments, :is_existing_doc, :boolean, default: false
    add_reference :email_attachments, :company_document, foreign_key: true
  end
end

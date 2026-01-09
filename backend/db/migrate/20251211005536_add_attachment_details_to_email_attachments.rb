class AddAttachmentDetailsToEmailAttachments < ActiveRecord::Migration[8.0]
  def change
    add_column :email_attachments, :filename, :string
    add_column :email_attachments, :sharepoint_path, :string
    add_column :email_attachments, :content_hash, :string
  end
end

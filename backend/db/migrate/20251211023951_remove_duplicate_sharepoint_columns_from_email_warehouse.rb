class RemoveDuplicateSharepointColumnsFromEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    # Remove duplicate SharePoint columns (unused - were for attachments initially)
    # Keeping sharepoint_email_file_id and sharepoint_email_path (for .eml files)
    remove_column :email_warehouse, :sharepoint_file_id, :string
    remove_column :email_warehouse, :sharepoint_path, :string
    remove_column :email_warehouse, :sharepoint_synced_at, :datetime

    # Remove direction - can calculate from from_email, to_emails, cc_emails, bcc_emails
    remove_column :email_warehouse, :direction, :string

    # Add contact matching columns
    add_column :email_warehouse, :contact_ids, :bigint, array: true, default: []
    add_column :email_warehouse, :primary_contact_id, :bigint
    add_column :email_warehouse, :contacts_matched_at, :datetime

    # Indexes
    remove_index :email_warehouse, :sharepoint_file_id, if_exists: true
    remove_index :email_warehouse, :direction, if_exists: true

    add_index :email_warehouse, :contact_ids, using: :gin
    add_index :email_warehouse, :primary_contact_id
    add_foreign_key :email_warehouse, :contacts, column: :primary_contact_id
  end
end

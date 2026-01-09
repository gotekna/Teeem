class AddSsotFieldsToEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    # SSoT tracking fields
    add_column :email_warehouse, :direction, :string  # 'sent', 'received', 'cc', 'bcc'
    add_column :email_warehouse, :ssot_owner_id, :bigint  # User who owns the SSoT copy

    # SharePoint storage fields
    add_column :email_warehouse, :sharepoint_file_id, :string
    add_column :email_warehouse, :sharepoint_path, :string
    add_column :email_warehouse, :sharepoint_synced_at, :datetime

    # Content fields
    add_column :email_warehouse, :body_preview, :string, limit: 500  # Short preview only
    add_column :email_warehouse, :ai_summary, :text  # AI-generated summary

    # Extracted data (from signature parsing and AI)
    add_column :email_warehouse, :extracted_contacts, :jsonb, default: {}  # From signature
    add_column :email_warehouse, :extracted_entities, :jsonb, default: {}  # Jobs, cases, etc.
    add_column :email_warehouse, :action_items, :jsonb, default: []  # TODO items from email

    # Indexes for common queries
    add_index :email_warehouse, :direction
    add_index :email_warehouse, :ssot_owner_id
    add_index :email_warehouse, :sharepoint_file_id

    # Foreign key to users table
    add_foreign_key :email_warehouse, :users, column: :ssot_owner_id
  end
end

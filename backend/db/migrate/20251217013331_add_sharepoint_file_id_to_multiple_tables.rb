class AddSharepointFileIdToMultipleTables < ActiveRecord::Migration[8.0]
  def change
    # Add sharepoint_file_id to tables that currently use Active Storage
    # This enables SharePoint as the SSoT for all file storage

    # BillInbox - stores invoice files uploaded via email/portal
    add_column :bill_inboxes, :sharepoint_file_id, :string
    add_index :bill_inboxes, :sharepoint_file_id

    # ChatMessages - file attachments in chat
    add_column :chat_messages, :sharepoint_file_id, :string
    add_index :chat_messages, :sharepoint_file_id

    # PayNowRequests - invoice files and proof photos
    add_column :pay_now_requests, :sharepoint_file_id, :string
    add_column :pay_now_requests, :proof_photos_sharepoint_ids, :jsonb, default: []
    add_index :pay_now_requests, :sharepoint_file_id

    # FinancialTransactions - receipt attachments
    add_column :financial_transactions, :sharepoint_file_id, :string
    add_index :financial_transactions, :sharepoint_file_id
  end
end

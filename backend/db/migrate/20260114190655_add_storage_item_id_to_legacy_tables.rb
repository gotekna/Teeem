# frozen_string_literal: true

# SSoT Migration: Add storage_item_id to legacy tables
#
# The codebase has THE ONE pattern: StorableDocument concern with storage_item_id
# Some tables still use sharepoint_file_id. This migration:
# 1. Adds storage_item_id column to legacy tables
# 2. Copies data from sharepoint_file_id → storage_item_id
# 3. Adds indexes for performance
#
# After this migration, code should use storage_reference method which falls back:
# storage_item_id.presence || sharepoint_file_id
class AddStorageItemIdToLegacyTables < ActiveRecord::Migration[7.2]
  def change
    # Standard tables (7 tables with sharepoint_file_id)
    add_column :attachments, :storage_item_id, :string
    add_column :bill_inboxes, :storage_item_id, :string
    add_column :chat_messages, :storage_item_id, :string
    add_column :financial_transactions, :storage_item_id, :string
    add_column :job_plan_revisions, :storage_item_id, :string
    add_column :pay_now_requests, :storage_item_id, :string
    add_column :plan_folder_scans, :storage_item_id, :string

    # E-signature requests (has original_sharepoint_file_id and signed_sharepoint_file_id)
    add_column :e_signature_requests, :original_storage_item_id, :string
    add_column :e_signature_requests, :signed_storage_item_id, :string

    # Copy data from sharepoint_file_id → storage_item_id
    reversible do |dir|
      dir.up do
        execute <<-SQL.squish
          UPDATE attachments SET storage_item_id = sharepoint_file_id WHERE sharepoint_file_id IS NOT NULL;
          UPDATE bill_inboxes SET storage_item_id = sharepoint_file_id WHERE sharepoint_file_id IS NOT NULL;
          UPDATE chat_messages SET storage_item_id = sharepoint_file_id WHERE sharepoint_file_id IS NOT NULL;
          UPDATE financial_transactions SET storage_item_id = sharepoint_file_id WHERE sharepoint_file_id IS NOT NULL;
          UPDATE job_plan_revisions SET storage_item_id = sharepoint_file_id WHERE sharepoint_file_id IS NOT NULL;
          UPDATE pay_now_requests SET storage_item_id = sharepoint_file_id WHERE sharepoint_file_id IS NOT NULL;
          UPDATE plan_folder_scans SET storage_item_id = sharepoint_file_id WHERE sharepoint_file_id IS NOT NULL;
          UPDATE e_signature_requests SET original_storage_item_id = original_sharepoint_file_id WHERE original_sharepoint_file_id IS NOT NULL;
          UPDATE e_signature_requests SET signed_storage_item_id = signed_sharepoint_file_id WHERE signed_sharepoint_file_id IS NOT NULL;
        SQL
      end
    end

    # Add indexes (non-unique to allow duplicates during transition)
    add_index :attachments, :storage_item_id
    add_index :bill_inboxes, :storage_item_id
    add_index :chat_messages, :storage_item_id
    add_index :financial_transactions, :storage_item_id
    add_index :job_plan_revisions, :storage_item_id
    add_index :pay_now_requests, :storage_item_id
    add_index :plan_folder_scans, :storage_item_id
  end
end

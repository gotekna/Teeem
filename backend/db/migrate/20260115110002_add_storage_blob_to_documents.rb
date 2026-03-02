# frozen_string_literal: true

# Add storage_blob_id to document models for SSoT deduplication
#
# SSoT Architecture:
#   Document → StorageBlob (deduplicated by content_hash)
#
# This enables:
# - Same file stored once, referenced by many documents
# - Content-based deduplication via SHA256 hash
# - Provider-agnostic storage via StorageConfiguration
#
class AddStorageBlobToDocuments < ActiveRecord::Migration[8.0]
  def up
    # CorporateCompanyDocument - main document storage (12,783+ records)
    unless column_exists?(:corporate_documents, :storage_blob_id)
      add_reference :corporate_documents, :storage_blob, foreign_key: true, index: true
    end

    # ChatMessage - chat attachments (5 records)
    unless column_exists?(:chat_messages, :storage_blob_id)
      add_reference :chat_messages, :storage_blob, foreign_key: true, index: true
    end

    # BillInbox - invoice files (2 records)
    unless column_exists?(:bill_inboxes, :storage_blob_id)
      add_reference :bill_inboxes, :storage_blob, foreign_key: true, index: true
    end

    # Add index on content_hash for deduplication lookups
    add_index :corporate_documents, :content_hash, where: "content_hash IS NOT NULL", if_not_exists: true
  end

  def down
    remove_index :corporate_documents, :content_hash, if_exists: true
    remove_reference :bill_inboxes, :storage_blob, if_exists: true
    remove_reference :chat_messages, :storage_blob, if_exists: true
    remove_reference :corporate_documents, :storage_blob, if_exists: true
  end
end

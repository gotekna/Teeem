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
  def change
    # CorporateCompanyDocument - main document storage (12,783+ records)
    add_reference :corporate_documents, :storage_blob, foreign_key: true, index: true

    # ChatMessage - chat attachments (5 records)
    add_reference :chat_messages, :storage_blob, foreign_key: true, index: true

    # BillInbox - invoice files (2 records)
    add_reference :bill_inboxes, :storage_blob, foreign_key: true, index: true

    # Add index on content_hash for deduplication lookups (if not exists)
    unless index_exists?(:corporate_documents, :content_hash)
      add_index :corporate_documents, :content_hash, where: "content_hash IS NOT NULL"
    end
  end
end

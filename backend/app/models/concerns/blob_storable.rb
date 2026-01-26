# frozen_string_literal: true

# BlobStorable - SSoT concern for StorageBlob-based file access
#
# Include in any model that stores files via StorageBlob without needing
# the full StorableDocument concern (which requires storage_path/storage_provider columns).
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: StorageBlob is THE ONE for deduplicated file storage       ║
# ║  This concern provides standard download/attach for blob-backed   ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Requires: belongs_to :storage_blob, optional: true
#
# Usage:
#   class NotebookPageAttachment < ApplicationRecord
#     belongs_to :storage_blob, optional: true
#     include BlobStorable
#   end
#
#   attachment.download_file  # => file content
#   attachment.has_file?      # => true/false
#   attachment.attach_file(content, filename: "doc.pdf")
#
module BlobStorable
  extend ActiveSupport::Concern

  # Download file content from StorageBlob
  # @return [String, nil] File content or nil if not found
  def download_file
    return nil unless storage_blob

    storage_blob.download
  end

  # Check if file exists in storage
  def has_file?
    storage_blob.present?
  end

  # Get presigned download URL for the file (SSoT)
  # @param expires_in [Integer] Expiry time in seconds (default: 3600)
  # @return [String, nil] Presigned download URL or nil if no file
  def file_url(expires_in: 3600)
    return nil unless storage_blob

    filename = respond_to?(:file_name) ? file_name : nil
    storage_blob.presigned_url(expires_in: expires_in, filename: filename)
  end

  # Attach a file using StorageBlob (deduplication via content_hash)
  # @param content [String] File content
  # @param filename [String] Original filename
  # @param content_type [String] MIME type (optional)
  def attach_file(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    # Decrement old blob reference if replacing
    storage_blob&.decrement_reference! if storage_blob_id.present?

    self.storage_blob = blob
    blob.increment_reference!
    blob
  end
end

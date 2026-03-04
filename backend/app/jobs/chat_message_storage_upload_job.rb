# frozen_string_literal: true

# Job to upload ChatMessage files to blob storage
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses StorageBlob for deduplicated storage                  ║
# ║  Creates WarehouseDocument for File Warehouse visibility          ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class ChatMessageStorageUploadJob < ApplicationJob
  queue_as :default

  def perform(chat_message_id)
    # unscoped: background jobs don't have ActsAsTenant context
    message = ChatMessage.unscoped.find_by(id: chat_message_id)
    return unless message
    return if message.storage_blob_id.present?
    return unless message.file.attached?

    Rails.logger.info("[ChatMessageUpload] Uploading file for ChatMessage #{chat_message_id}")

    filename = message.file.filename.to_s
    content = message.file.download
    content_type = message.file.content_type

    # Set tenant context for StorageBlob creation
    tenant = message.respond_to?(:tenant) ? message.tenant : nil
    tenant ||= message.job&.tenant if message.respond_to?(:job)

    ActsAsTenant.with_tenant(tenant) do
      # SSoT: Create StorageBlob with content-hash deduplication
      blob = StorageBlob.find_or_create_for_content!(
        content,
        filename: filename,
        content_type: content_type
      )

      # Link blob to record
      message.update_columns(storage_blob_id: blob.id)

      # SSoT: Create WarehouseDocument for File Warehouse visibility
      job = message.respond_to?(:job) ? message.job : nil
      WarehouseDocumentCreator.create!(
        filename: filename,
        source_type: "warehouse",
        linkable: job,
        storage_blob: blob,
        file_size: content.bytesize,
        content_type: content_type,
        metadata: { "source" => "chat_message", "chat_message_id" => chat_message_id }
      )
      blob.increment_reference!

      Rails.logger.info("[ChatMessageUpload] Uploaded to blob storage: #{filename} -> #{blob.storage_path}")
    end
  rescue StandardError => e
    Rails.logger.error("[ChatMessageUpload] Error: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    raise
  end
end

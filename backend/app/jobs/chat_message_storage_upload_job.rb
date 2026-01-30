# frozen_string_literal: true

# Job to upload ChatMessage files to storage
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Uploads to Wasabi, SharePoint, or S3 based on WarehouseProvider║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class ChatMessageStorageUploadJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(chat_message_id)
    message = ChatMessage.find_by(id: chat_message_id)
    return unless message
    return if message.storage_reference.present?
    return unless message.file.attached?

    Rails.logger.info("[ChatMessageUpload] Uploading file for ChatMessage #{chat_message_id}")

    # SSoT: Setup document provider using WarehouseProvider
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.error("[ChatMessageUpload] No storage provider configured: #{e.message}")
      return
    end

    # Build folder path: Warehousing/Chat/{YYYY-MM}
    date = message.created_at || Time.current
    base_folder = scope_folder_path(:chat)
    folder_path = "/#{base_folder}/#{date.strftime('%Y-%m')}"
    filename = message.file.filename.to_s

    file_content = message.file.download

    get_or_create_folder_path(folder_path)
    upload_result = upload_to_provider(folder_path, file_content, filename)

    if upload_result && upload_result[:id]
      message.update_columns(storage_file_id: upload_result[:id])
      Rails.logger.info("[ChatMessageUpload] Uploaded: #{filename} -> #{upload_result[:path]}")
    else
      Rails.logger.error("[ChatMessageUpload] Upload failed - no ID returned")
    end
  rescue DocumentProviders::Error => e
    Rails.logger.error("[ChatMessageUpload] Provider error: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[ChatMessageUpload] Error: #{e.message}")
  end
end

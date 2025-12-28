# Job to upload ChatMessage files to SharePoint
class ChatMessageSharepointUploadJob < ApplicationJob
  queue_as :default

  def perform(chat_message_id)
    message = ChatMessage.find_by(id: chat_message_id)
    return unless message
    return if message.sharepoint_file_id.present?
    return unless message.file.attached?

    Rails.logger.info("[ChatMessageSharepointUpload] Uploading file for ChatMessage #{chat_message_id}")

    credential = MicrosoftCredential.sharepoint_credential
    unless credential
      Rails.logger.error("[ChatMessageSharepointUpload] No active OneDrive credential")
      return
    end

    client = MicrosoftGraphClient.new(credential)

    # Upload to ChatFiles folder structure: ChatFiles/{YYYY-MM}/{filename}
    date = message.created_at || Time.current
    folder_path = "ChatFiles/#{date.strftime('%Y-%m')}"
    filename = message.file.filename.to_s

    file_content = message.file.download

    folder_id = ensure_folder_exists(client, folder_path)
    upload_result = client.upload_file_content(folder_id, filename, file_content)

    if upload_result && upload_result[:id]
      message.update_columns(sharepoint_file_id: upload_result[:id])
      Rails.logger.info("[ChatMessageSharepointUpload] Uploaded: #{filename}")
    else
      Rails.logger.error("[ChatMessageSharepointUpload] Upload failed - no ID returned")
    end
  rescue StandardError => e
    Rails.logger.error("[ChatMessageSharepointUpload] Error: #{e.message}")
  end

  private

  def ensure_folder_exists(client, path)
    parts = path.split("/")
    current_folder_id = nil

    parts.each do |folder_name|
      if current_folder_id.nil?
        folder = client.find_folder_in_drive_root(folder_name)
        folder ||= client.create_folder(folder_name)
        current_folder_id = folder[:id] || folder["id"]
      else
        folder = client.get_or_create_subfolder(current_folder_id, folder_name)
        current_folder_id = folder[:id] || folder["id"]
      end
    end

    current_folder_id
  end
end

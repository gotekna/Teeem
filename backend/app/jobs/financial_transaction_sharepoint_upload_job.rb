# Job to upload FinancialTransaction receipts to SharePoint
class FinancialTransactionSharepointUploadJob < ApplicationJob
  queue_as :default

  def perform(transaction_id)
    transaction = FinancialTransaction.find_by(id: transaction_id)
    return unless transaction
    return if transaction.sharepoint_file_id.present?
    return unless transaction.receipt.attached?

    credential = MicrosoftCredential.sharepoint_credential
    return unless credential

    client = MicrosoftGraphClient.new(credential)

    folder_path = "FinancialReceipts/#{transaction.transaction_date.strftime('%Y-%m')}"
    filename = transaction.receipt.filename.to_s
    content = transaction.receipt.download

    folder_id = ensure_folder_exists(client, folder_path)
    result = client.upload_file_content(folder_id, filename, content)

    if result && result[:id]
      transaction.update_columns(sharepoint_file_id: result[:id])
      Rails.logger.info("[FinancialTransactionSharepointUpload] Uploaded: #{filename}")
    end
  rescue StandardError => e
    Rails.logger.error("[FinancialTransactionSharepointUpload] Error: #{e.message}")
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

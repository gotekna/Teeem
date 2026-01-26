# frozen_string_literal: true

# Job to upload FinancialTransaction receipts to storage
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Uploads to Wasabi, SharePoint, or S3 based on StorageConfiguration║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class FinancialTransactionStorageUploadJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(transaction_id)
    transaction = FinancialTransaction.find_by(id: transaction_id)
    return unless transaction
    return if transaction.storage_reference.present?
    return unless transaction.receipt.attached?

    Rails.logger.info("[FinancialTransactionUpload] Uploading receipt for Transaction #{transaction_id}")

    # SSoT: Setup document provider using StorageConfiguration
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.error("[FinancialTransactionUpload] No storage provider configured: #{e.message}")
      return
    end

    # Build folder path: Warehousing/{YYYY-MM}
    folder_path = "/Warehousing/FinancialReceipts/#{transaction.transaction_date.strftime('%Y-%m')}"
    filename = transaction.receipt.filename.to_s
    content = transaction.receipt.download

    get_or_create_folder_path(folder_path)
    result = upload_to_provider(folder_path, content, filename)

    if result && result[:id]
      transaction.update_columns(storage_file_id: result[:id])
      Rails.logger.info("[FinancialTransactionUpload] Uploaded: #{filename} -> #{result[:path]}")
    else
      Rails.logger.error("[FinancialTransactionUpload] Upload failed - no ID returned")
    end
  rescue DocumentProviders::Error => e
    Rails.logger.error("[FinancialTransactionUpload] Provider error: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[FinancialTransactionUpload] Error: #{e.message}")
  end
end

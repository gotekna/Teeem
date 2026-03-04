# frozen_string_literal: true

# Job to upload FinancialTransaction receipts to blob storage
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses StorageBlob for deduplicated storage                  ║
# ║  Creates WarehouseDocument for File Warehouse visibility          ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class FinancialTransactionStorageUploadJob < ApplicationJob
  queue_as :default

  def perform(transaction_id)
    transaction = FinancialTransaction.find_by(id: transaction_id)
    return unless transaction
    return if transaction.storage_blob_id.present?
    return unless transaction.receipt.attached?

    Rails.logger.info("[FinancialTransactionUpload] Uploading receipt for Transaction #{transaction_id}")

    filename = transaction.receipt.filename.to_s
    content = transaction.receipt.download
    content_type = transaction.receipt.content_type

    # SSoT: Create StorageBlob with content-hash deduplication
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    # Link blob to record
    transaction.update_columns(storage_blob_id: blob.id)

    # SSoT: Create WarehouseDocument for File Warehouse visibility
    job = transaction.respond_to?(:job) ? transaction.job : nil
    WarehouseDocumentCreator.create!(
      filename: filename,
      source_type: "financial",
      linkable: job,
      storage_blob: blob,
      file_size: content.bytesize,
      content_type: content_type,
      metadata: { "source" => "financial_transaction", "transaction_id" => transaction_id }
    )
    blob.increment_reference!

    Rails.logger.info("[FinancialTransactionUpload] Uploaded to blob storage: #{filename} -> #{blob.storage_path}")
  rescue StandardError => e
    Rails.logger.error("[FinancialTransactionUpload] Error: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    raise
  end
end

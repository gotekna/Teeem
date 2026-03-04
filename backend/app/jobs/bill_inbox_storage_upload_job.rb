# frozen_string_literal: true

# Job to upload BillInbox invoice files to blob storage
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses StorageBlob for deduplicated storage                  ║
# ║  Creates WarehouseDocument for File Warehouse visibility          ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class BillInboxStorageUploadJob < ApplicationJob
  queue_as :default

  def perform(bill_inbox_id)
    bill = BillInbox.find_by(id: bill_inbox_id)
    return unless bill
    return if bill.storage_blob_id.present? # Already uploaded to blob storage
    return unless bill.invoice_file.attached?

    Rails.logger.info("[BillInboxUpload] Uploading file for BillInbox #{bill_inbox_id}")

    filename = bill.invoice_file.filename.to_s
    content = bill.invoice_file.download
    content_type = bill.invoice_file.content_type

    # SSoT: Create StorageBlob with content-hash deduplication
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    # Link blob to record
    bill.update_columns(storage_blob_id: blob.id)

    # SSoT: Create WarehouseDocument for File Warehouse visibility
    WarehouseDocumentCreator.create!(
      filename: filename,
      source_type: "financial",
      storage_blob: blob,
      file_size: content.bytesize,
      content_type: content_type,
      metadata: { "source" => "bill_inbox", "bill_inbox_id" => bill_inbox_id }
    )
    blob.increment_reference!

    Rails.logger.info("[BillInboxUpload] Uploaded to blob storage: #{filename} -> #{blob.storage_path}")

    # Queue extraction now that file is in storage
    if bill.status == "pending"
      InvoiceExtractionJob.perform_later(bill.id)
    end
  rescue StandardError => e
    Rails.logger.error("[BillInboxUpload] Error: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    raise
  end
end

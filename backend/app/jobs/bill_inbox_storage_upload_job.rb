# frozen_string_literal: true

# Job to upload BillInbox invoice files to storage
# Triggered after a BillInbox is created/updated with an attached file
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Uploads to Wasabi, SharePoint, or S3 based on WarehouseProvider║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class BillInboxStorageUploadJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(bill_inbox_id)
    bill = BillInbox.find_by(id: bill_inbox_id)
    return unless bill
    return if bill.storage_reference.present? # Already uploaded
    return unless bill.invoice_file.attached?

    Rails.logger.info("[BillInboxUpload] Uploading file for BillInbox #{bill_inbox_id}")

    # SSoT: Setup document provider using WarehouseProvider
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.error("[BillInboxUpload] No storage provider configured: #{e.message}")
      return
    end

    # Build folder path: Warehousing/BillInbox/{YYYY-MM}/{source}
    folder_path = build_folder_path(bill)
    filename = bill.invoice_file.filename.to_s

    # Download from Active Storage
    file_content = bill.invoice_file.download

    # Ensure folder exists and upload
    get_or_create_folder_path(folder_path)
    upload_result = upload_to_provider(folder_path, file_content, filename)

    if upload_result && upload_result[:id]
      bill.update_columns(
        storage_file_id: upload_result[:id],
        original_filename: filename
      )
      Rails.logger.info("[BillInboxUpload] Uploaded: #{filename} -> #{upload_result[:path]}")

      # Queue extraction now that file is in storage
      if bill.status == "pending"
        InvoiceExtractionJob.perform_later(bill.id)
      end
    else
      Rails.logger.error("[BillInboxUpload] Upload failed - no ID returned")
    end
  rescue DocumentProviders::AuthenticationError => e
    Rails.logger.error("[BillInboxUpload] Auth error: #{e.message}")
  rescue DocumentProviders::Error => e
    Rails.logger.error("[BillInboxUpload] Provider error: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[BillInboxUpload] Error: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
  end

  private

  def build_folder_path(bill)
    # SSoT: Get base path from WarehouseProvider
    base_folder = scope_folder_path(:bill_inbox)
    date = bill.created_at || Time.current
    year_month = date.strftime("%Y-%m")
    source = bill.source || "upload"

    "/#{base_folder}/#{year_month}/#{source}"
  end
end

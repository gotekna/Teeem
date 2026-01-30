# frozen_string_literal: true

# Job to upload PayNowRequest files to storage
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Uploads to Wasabi, SharePoint, or S3 based on WarehouseProvider║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class PayNowStorageUploadJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform(pay_now_request_id)
    request = PayNowRequest.find_by(id: pay_now_request_id)
    return unless request

    Rails.logger.info("[PayNowUpload] Uploading files for PayNowRequest #{pay_now_request_id}")

    # SSoT: Setup document provider using WarehouseProvider
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.error("[PayNowUpload] No storage provider configured: #{e.message}")
      return
    end

    # Upload invoice file
    if request.invoice_file.attached? && request.storage_reference.blank?
      upload_invoice_file(request)
    end

    # Upload proof photos
    if request.proof_photos.attached? && request.proof_photos_storage_ids.blank?
      upload_proof_photos(request)
    end
  rescue DocumentProviders::Error => e
    Rails.logger.error("[PayNowUpload] Provider error: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[PayNowUpload] Error: #{e.message}")
  end

  private

  def upload_invoice_file(request)
    folder_path = "/Warehousing/PayNowRequests/#{request.created_at.strftime('%Y-%m')}/Invoices"
    filename = request.invoice_file.filename.to_s
    content = request.invoice_file.download

    get_or_create_folder_path(folder_path)
    result = upload_to_provider(folder_path, content, filename)

    if result && result[:id]
      request.update_columns(storage_file_id: result[:id])
      Rails.logger.info("[PayNowUpload] Uploaded invoice: #{filename} -> #{result[:path]}")
    end
  end

  def upload_proof_photos(request)
    folder_path = "/Warehousing/PayNowRequests/#{request.created_at.strftime('%Y-%m')}/ProofPhotos/#{request.id}"
    get_or_create_folder_path(folder_path)

    ids = []
    request.proof_photos.each do |photo|
      filename = photo.filename.to_s
      content = photo.download
      result = upload_to_provider(folder_path, content, filename)
      ids << result[:id] if result && result[:id]
    end

    if ids.any?
      request.update_columns(proof_photos_storage_ids: ids)
      Rails.logger.info("[PayNowUpload] Uploaded #{ids.count} proof photos")
    end
  end
end

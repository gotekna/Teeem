# frozen_string_literal: true

# Job to upload PayNowRequest files to blob storage
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses StorageBlob for deduplicated storage                  ║
# ║  Creates WarehouseDocument for File Warehouse visibility          ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class PayNowStorageUploadJob < ApplicationJob
  queue_as :default

  def perform(pay_now_request_id)
    request = PayNowRequest.find_by(id: pay_now_request_id)
    return unless request

    Rails.logger.info("[PayNowUpload] Uploading files for PayNowRequest #{pay_now_request_id}")

    # Upload invoice file
    if request.invoice_file.attached? && request.storage_reference.blank?
      upload_invoice_file(request)
    end

    # Upload proof photos
    if request.proof_photos.attached? && request.proof_photos_storage_ids.blank?
      upload_proof_photos(request)
    end
  rescue StandardError => e
    Rails.logger.error("[PayNowUpload] Error: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    raise
  end

  private

  def upload_invoice_file(request)
    filename = request.invoice_file.filename.to_s
    content = request.invoice_file.download
    content_type = request.invoice_file.content_type

    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    request.update_columns(storage_file_id: blob.storage_path)

    job = request.respond_to?(:job) ? request.job : nil
    WarehouseDocumentCreator.create!(
      filename: filename,
      source_type: "financial",
      linkable: job,
      storage_blob: blob,
      file_size: content.bytesize,
      content_type: content_type,
      metadata: { "source" => "pay_now_invoice", "pay_now_request_id" => request.id }
    )
    blob.increment_reference!

    Rails.logger.info("[PayNowUpload] Uploaded invoice to blob: #{filename} -> #{blob.storage_path}")
  end

  def upload_proof_photos(request)
    ids = []
    request.proof_photos.each do |photo|
      filename = photo.filename.to_s
      content = photo.download
      content_type = photo.content_type

      blob = StorageBlob.find_or_create_for_content!(
        content,
        filename: filename,
        content_type: content_type
      )

      ids << blob.storage_path

      job = request.respond_to?(:job) ? request.job : nil
      WarehouseDocumentCreator.create!(
        filename: filename,
        source_type: "financial",
        linkable: job,
        storage_blob: blob,
        file_size: content.bytesize,
        content_type: content_type,
        metadata: { "source" => "pay_now_proof_photo", "pay_now_request_id" => request.id }
      )
      blob.increment_reference!
    end

    if ids.any?
      request.update_columns(proof_photos_storage_ids: ids)
      Rails.logger.info("[PayNowUpload] Uploaded #{ids.count} proof photos to blob storage")
    end
  end
end

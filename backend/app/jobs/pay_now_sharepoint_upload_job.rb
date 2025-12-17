# Job to upload PayNowRequest files to SharePoint
class PayNowSharepointUploadJob < ApplicationJob
  queue_as :default

  def perform(pay_now_request_id)
    request = PayNowRequest.find_by(id: pay_now_request_id)
    return unless request

    credential = OrganizationOneDriveCredential.active_credential
    return unless credential

    client = MicrosoftGraphClient.new(credential)

    # Upload invoice file
    if request.invoice_file.attached? && request.sharepoint_file_id.blank?
      upload_invoice_file(request, client)
    end

    # Upload proof photos
    if request.proof_photos.attached? && request.proof_photos_sharepoint_ids.blank?
      upload_proof_photos(request, client)
    end
  rescue StandardError => e
    Rails.logger.error("[PayNowSharepointUpload] Error: #{e.message}")
  end

  private

  def upload_invoice_file(request, client)
    folder_path = "PayNowRequests/#{request.created_at.strftime('%Y-%m')}/Invoices"
    filename = request.invoice_file.filename.to_s
    content = request.invoice_file.download

    folder_id = ensure_folder_exists(client, folder_path)
    result = client.upload_file_content(folder_id, filename, content)

    if result && result[:id]
      request.update_columns(sharepoint_file_id: result[:id])
      Rails.logger.info("[PayNowSharepointUpload] Uploaded invoice: #{filename}")
    end
  end

  def upload_proof_photos(request, client)
    folder_path = "PayNowRequests/#{request.created_at.strftime('%Y-%m')}/ProofPhotos/#{request.id}"
    folder_id = ensure_folder_exists(client, folder_path)

    ids = []
    request.proof_photos.each do |photo|
      filename = photo.filename.to_s
      content = photo.download
      result = client.upload_file_content(folder_id, filename, content)
      ids << result[:id] if result && result[:id]
    end

    if ids.any?
      request.update_columns(proof_photos_sharepoint_ids: ids)
      Rails.logger.info("[PayNowSharepointUpload] Uploaded #{ids.count} proof photos")
    end
  end

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

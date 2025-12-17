# Job to upload BillInbox invoice files to SharePoint
# Triggered after a BillInbox is created/updated with an attached file
class BillInboxSharepointUploadJob < ApplicationJob
  queue_as :default

  def perform(bill_inbox_id)
    bill = BillInbox.find_by(id: bill_inbox_id)
    return unless bill
    return if bill.sharepoint_file_id.present? # Already uploaded
    return unless bill.invoice_file.attached?

    Rails.logger.info("[BillInboxSharepointUpload] Uploading file for BillInbox #{bill_inbox_id}")

    credential = OrganizationOneDriveCredential.active_credential
    unless credential
      Rails.logger.error("[BillInboxSharepointUpload] No active OneDrive credential")
      return
    end

    client = MicrosoftGraphClient.new(credential)

    # Upload to BillInbox folder structure
    folder_path = build_folder_path(bill)
    filename = bill.invoice_file.filename.to_s

    # Download from Active Storage
    file_content = bill.invoice_file.download

    # Ensure folder exists and upload
    folder_id = ensure_folder_exists(client, folder_path)
    upload_result = client.upload_file_content(folder_id, filename, file_content)

    if upload_result && upload_result[:id]
      bill.update_columns(
        sharepoint_file_id: upload_result[:id],
        original_filename: filename
      )
      Rails.logger.info("[BillInboxSharepointUpload] Uploaded: #{filename} -> #{upload_result[:web_url]}")

      # Queue extraction now that file is in SharePoint
      if bill.status == "pending"
        InvoiceExtractionJob.perform_later(bill.id)
      end
    else
      Rails.logger.error("[BillInboxSharepointUpload] Upload failed - no ID returned")
    end
  rescue MicrosoftGraphClient::AuthenticationError => e
    Rails.logger.error("[BillInboxSharepointUpload] Auth error: #{e.message}")
  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error("[BillInboxSharepointUpload] API error: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[BillInboxSharepointUpload] Error: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
  end

  private

  def build_folder_path(bill)
    # Structure: BillInbox/{YYYY-MM}/{source}
    date = bill.created_at || Time.current
    year_month = date.strftime("%Y-%m")
    source = bill.source || "upload"

    "BillInbox/#{year_month}/#{source}"
  end

  def ensure_folder_exists(client, path)
    parts = path.split("/")
    current_folder_id = nil

    parts.each do |folder_name|
      if current_folder_id.nil?
        # Root level
        folder = client.find_folder_in_drive_root(folder_name)
        unless folder
          folder = client.create_folder(folder_name)
        end
        current_folder_id = folder[:id] || folder["id"]
      else
        # Subfolder
        folder = client.get_or_create_subfolder(current_folder_id, folder_name)
        current_folder_id = folder[:id] || folder["id"]
      end
    end

    current_folder_id
  end
end

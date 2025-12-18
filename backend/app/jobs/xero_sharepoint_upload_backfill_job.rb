# One-time job to upload Xero documents that were downloaded before SharePoint upload was working
# These documents exist in ActiveStorage but were never uploaded to SharePoint
# Creates the folder structure: Contacts/{contact_folder}/BILLS|INVOICES/{filename}
class XeroSharepointUploadBackfillJob < ApplicationJob
  queue_as :low

  # Run with: XeroSharepointUploadBackfillJob.perform_now(limit: 50, dry_run: true)
  # Or enqueue: XeroSharepointUploadBackfillJob.perform_later(limit: 100)
  def perform(limit: nil, dry_run: false)
    # Smart skip: Don't consume a worker thread if there's barely any work
    # This prevents the recurring job from blocking critical jobs when backlog is small
    pending_count = CorporateCompanyDocument
      .where(source: "xero")
      .where("external_id LIKE ?", "xero:%:pdf")
      .where(sharepoint_file_id: nil)
      .count

    if pending_count < 5
      Rails.logger.info("[XeroSharepointUploadBackfill] Skipping - only #{pending_count} pending (threshold: 5)")
      return { skipped: true, pending_count: pending_count }
    end

    start_time = Time.current
    stats = {
      total_processed: 0,
      uploaded: 0,
      skipped_no_file: 0,
      skipped_no_contact: 0,
      already_uploaded: 0,
      errors: 0,
      error_details: []
    }

    Rails.logger.info("[XeroSharepointUploadBackfill] Starting backfill job (dry_run: #{dry_run}, limit: #{limit}, pending: #{pending_count})")

    # Find PDF documents that need uploading
    # SSoT: Only process PDFs (external_id LIKE 'xero:%:pdf'), not old attachment records
    # This ensures we don't get stuck on 650+ orphaned attachments without files
    scope = CorporateCompanyDocument
      .where(source: "xero")
      .where("external_id LIKE ?", "xero:%:pdf")  # Only PDFs, not attachments
      .where(sharepoint_file_id: nil)
      .includes(:contact, :documentable)
      .order(created_at: :desc)  # Newest first - process recent PDFs quickly

    scope = scope.limit(limit) if limit.present?

    # Filter to only those with attached files (can't do this in SQL easily)
    documents_to_process = scope.select { |doc| doc.file.attached? }
    total_count = documents_to_process.count

    Rails.logger.info("[XeroSharepointUploadBackfill] Found #{total_count} documents with attached files to upload")

    return stats if total_count.zero?

    # Get SharePoint client
    credential = OrganizationSharePointCredential.active_credential
    unless credential
      Rails.logger.error("[XeroSharepointUploadBackfill] No active OneDrive credential found")
      stats[:errors] += 1
      stats[:error_details] << "No active OneDrive credential"
      return stats
    end

    graph_client = MicrosoftGraphClient.new(credential)

    # Get base folder settings
    settings = CorporateCompanySetting.instance
    base_folder_name = settings.contact_documents_path || "Contacts"

    # Ensure base Contacts folder exists
    contacts_folder = graph_client.find_folder_in_drive_root(base_folder_name)
    unless contacts_folder
      contacts_folder = graph_client.create_folder(base_folder_name)
      Rails.logger.info("[XeroSharepointUploadBackfill] Created base folder: #{base_folder_name}")
    end

    documents_to_process.each_with_index do |doc, index|
      stats[:total_processed] += 1

      begin
        # Double-check file is attached
        unless doc.file.attached?
          stats[:skipped_no_file] += 1
          next
        end

        # Need contact for folder structure
        contact = doc.contact
        unless contact.present?
          stats[:skipped_no_contact] += 1
          Rails.logger.warn("[XeroSharepointUploadBackfill] Skipping document #{doc.id} - no contact")
          next
        end

        # Build folder path
        contact_folder_name = contact.document_folder_name
        type_folder_name = doc.folder || determine_folder_from_document(doc)

        if dry_run
          Rails.logger.info("[XeroSharepointUploadBackfill] [DRY RUN] Would upload: #{doc.title}")
          Rails.logger.info("  -> Path: #{base_folder_name}/#{contact_folder_name}/#{type_folder_name}/#{doc.file_name || doc.title}")
          stats[:uploaded] += 1
          next
        end

        # Get or create contact subfolder
        contact_folder = graph_client.get_or_create_subfolder(
          contacts_folder[:id] || contacts_folder["id"],
          contact_folder_name
        )

        # Get or create type subfolder (BILLS, INVOICES, etc.)
        type_folder = graph_client.get_or_create_subfolder(
          contact_folder[:id] || contact_folder["id"],
          type_folder_name
        )

        # Download file content from ActiveStorage
        file_content = doc.file.download
        filename = doc.file_name || doc.file.filename.to_s

        # Upload to SharePoint
        upload_result = graph_client.upload_file_content(
          type_folder[:id] || type_folder["id"],
          filename,
          file_content
        )

        if upload_result && upload_result[:id]
          doc.update!(sharepoint_file_id: upload_result[:id])
          stats[:uploaded] += 1
          Rails.logger.info("[XeroSharepointUploadBackfill] Uploaded: #{filename} -> #{upload_result[:web_url]}")
        else
          stats[:errors] += 1
          stats[:error_details] << "Upload returned no ID for document #{doc.id}"
        end

        # Progress logging every 10 documents
        if (index + 1) % 10 == 0
          Rails.logger.info("[XeroSharepointUploadBackfill] Progress: #{index + 1}/#{total_count} (#{stats[:uploaded]} uploaded)")
        end

        # Small delay between uploads to avoid throttling
        sleep(0.5) unless dry_run

      rescue MicrosoftGraphClient::AuthenticationError => e
        stats[:errors] += 1
        stats[:error_details] << "Auth error for doc #{doc.id}: #{e.message}"
        Rails.logger.error("[XeroSharepointUploadBackfill] Auth error - stopping job: #{e.message}")
        break  # Stop processing if auth fails
      rescue MicrosoftGraphClient::APIError => e
        stats[:errors] += 1
        stats[:error_details] << "API error for doc #{doc.id}: #{e.message}"
        Rails.logger.error("[XeroSharepointUploadBackfill] API error for document #{doc.id}: #{e.message}")
      rescue StandardError => e
        stats[:errors] += 1
        stats[:error_details] << "Error for doc #{doc.id}: #{e.message}"
        Rails.logger.error("[XeroSharepointUploadBackfill] Error processing document #{doc.id}: #{e.message}")
        Rails.logger.error(e.backtrace.first(5).join("\n"))
      end
    end

    elapsed = (Time.current - start_time).round(2)

    Rails.logger.info("[XeroSharepointUploadBackfill] Complete! Stats: #{stats.except(:error_details).to_json}")
    Rails.logger.info("[XeroSharepointUploadBackfill] Time elapsed: #{elapsed}s (#{(elapsed / 60).round(2)} minutes)")

    if stats[:errors] > 0
      Rails.logger.warn("[XeroSharepointUploadBackfill] Errors: #{stats[:error_details].first(10).join('; ')}")
    end

    stats
  end

  private

  # Determine folder from document type or external invoice
  def determine_folder_from_document(doc)
    # Try to get from linked external invoice
    if doc.documentable.is_a?(ExternalInvoice)
      case doc.documentable.invoice_type
      when "bill" then "BILLS"
      when "sales_invoice" then "INVOICES"
      when "credit_note" then "CREDIT_NOTES"
      when "quote" then "QUOTES"
      else "XERO"
      end
    elsif doc.document_type.present?
      # Guess from document_type
      case doc.document_type.downcase
      when "purchases" then "BILLS"
      when "sales document" then "INVOICES"
      when "estimation" then "QUOTES"
      else "XERO"
      end
    else
      "XERO"
    end
  end
end

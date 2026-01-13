# frozen_string_literal: true

# Backfill job to upload Xero documents to the configured storage provider
# These documents exist in ActiveStorage but were never uploaded to external storage
# Creates the folder structure: Contacts/{contact_folder}/BILLS|INVOICES/{filename}
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Uploads to Wasabi, SharePoint, or S3 based on StorageConfiguration║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class XeroSharepointUploadBackfillJob < ApplicationJob
  include DocumentProviderAware

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
      Rails.logger.info("[XeroDocumentUpload] Skipping - only #{pending_count} pending (threshold: 5)")
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
      error_details: [],
      provider: nil
    }

    Rails.logger.info("[XeroDocumentUpload] Starting backfill job (dry_run: #{dry_run}, limit: #{limit}, pending: #{pending_count})")

    # SSoT: Setup document provider using StorageConfiguration
    begin
      setup_default_provider!
      stats[:provider] = current_provider_type.to_s
      Rails.logger.info("[XeroDocumentUpload] Using provider: #{stats[:provider]}")
    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.error("[XeroDocumentUpload] No storage provider configured: #{e.message}")
      stats[:errors] += 1
      stats[:error_details] << "No storage provider configured"
      return stats
    end

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

    Rails.logger.info("[XeroDocumentUpload] Found #{total_count} documents with attached files to upload")

    return stats if total_count.zero?

    # SSoT: Get contacts folder path from StorageConfiguration
    base_folder_name = scope_folder_path(:contact)

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
          Rails.logger.warn("[XeroDocumentUpload] Skipping document #{doc.id} - no contact")
          next
        end

        # Build folder path
        contact_folder_name = contact.document_folder_name
        type_folder_name = doc.folder || determine_folder_from_document(doc)
        folder_path = "/#{base_folder_name}/#{contact_folder_name}/#{type_folder_name}"
        filename = doc.file_name || doc.file.filename.to_s

        if dry_run
          Rails.logger.info("[XeroDocumentUpload] [DRY RUN] Would upload: #{doc.title}")
          Rails.logger.info("  -> Path: #{folder_path}/#{filename}")
          stats[:uploaded] += 1
          next
        end

        # Ensure folder path exists (creates all parents)
        get_or_create_folder_path(folder_path)

        # Download file content from ActiveStorage
        file_content = doc.file.download

        # Upload to storage provider
        upload_result = upload_to_provider(folder_path, file_content, filename)

        if upload_result && upload_result[:id]
          begin
            doc.update!(sharepoint_file_id: upload_result[:id])
            stats[:uploaded] += 1
            Rails.logger.info("[XeroDocumentUpload] Uploaded: #{filename} -> #{upload_result[:path]}")
          rescue ActiveRecord::RecordNotUnique
            # Another process already uploaded with this file ID (race condition)
            # This is fine - the file exists in storage, just skip
            stats[:already_uploaded] += 1
            Rails.logger.info("[XeroDocumentUpload] Already uploaded by another process: #{filename}")
          end
        else
          stats[:errors] += 1
          stats[:error_details] << "Upload returned no ID for document #{doc.id}"
        end

        # Progress logging every 10 documents
        if (index + 1) % 10 == 0
          Rails.logger.info("[XeroDocumentUpload] Progress: #{index + 1}/#{total_count} (#{stats[:uploaded]} uploaded)")
        end

        # Small delay between uploads to avoid throttling
        sleep(0.5) unless dry_run

      rescue DocumentProviders::AuthenticationError => e
        stats[:errors] += 1
        stats[:error_details] << "Auth error for doc #{doc.id}: #{e.message}"
        Rails.logger.error("[XeroDocumentUpload] Auth error - stopping job: #{e.message}")
        break  # Stop processing if auth fails
      rescue DocumentProviders::Error => e
        stats[:errors] += 1
        stats[:error_details] << "Provider error for doc #{doc.id}: #{e.message}"
        Rails.logger.error("[XeroDocumentUpload] Provider error for document #{doc.id}: #{e.message}")
      rescue StandardError => e
        stats[:errors] += 1
        stats[:error_details] << "Error for doc #{doc.id}: #{e.message}"
        Rails.logger.error("[XeroDocumentUpload] Error processing document #{doc.id}: #{e.message}")
        Rails.logger.error(e.backtrace.first(5).join("\n"))
      end
    end

    elapsed = (Time.current - start_time).round(2)

    Rails.logger.info("[XeroDocumentUpload] Complete! Stats: #{stats.except(:error_details).to_json}")
    Rails.logger.info("[XeroDocumentUpload] Time elapsed: #{elapsed}s (#{(elapsed / 60).round(2)} minutes)")

    if stats[:errors] > 0
      Rails.logger.warn("[XeroDocumentUpload] Errors: #{stats[:error_details].first(10).join('; ')}")
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

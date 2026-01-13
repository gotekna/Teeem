# frozen_string_literal: true

# XeroAttachmentUploadJob - Upload documents from TEEEM to Xero
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Downloads from Wasabi, SharePoint, or S3                         ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# This job handles uploading attachments to Xero entities (invoices, contacts, etc.)
# Part of the two-way sync implementation for documents.
#
# It can upload:
# - CorporateCompanyDocuments linked to ExternalInvoices
# - Storage files linked to Xero entities
#
# Usage:
#   XeroAttachmentUploadJob.perform_later(document_id: 123)
#   XeroAttachmentUploadJob.perform_later(document_id: 123, entity_type: 'Invoices', entity_id: 'xero-guid')
#   XeroAttachmentUploadJob.perform_later(batch: true)  # Process all pending documents
#
class XeroAttachmentUploadJob < ApplicationJob
  include XeroJobBase
  include DocumentProviderAware

  queue_as :xero_bulk

  # Xero supported entity types for attachments
  SUPPORTED_ENTITY_TYPES = %w[Invoices Contacts BankTransactions CreditNotes Quotes].freeze

  def perform(options = {})
    if options[:batch]
      upload_all_pending(options)
    elsif options[:document_id]
      upload_single_document(options[:document_id], options)
    else
      Rails.logger.warn("[XeroAttachmentUploadJob] No document_id or batch option provided")
    end
  end

  private

  # Upload a single document to Xero
  def upload_single_document(document_id, options = {})
    document = CorporateCompanyDocument.find_by(id: document_id)

    unless document
      Rails.logger.warn("[XeroAttachmentUploadJob] Document #{document_id} not found")
      return
    end

    # Skip if already synced to Xero (unless forced)
    unless options[:force]
      if document.synced_to_xero_at.present? && document.xero_attachment_id.present?
        Rails.logger.info("[XeroAttachmentUploadJob] Document #{document_id} already synced to Xero")
        return
      end
    end

    # Determine the target Xero entity
    entity_info = resolve_xero_entity(document, options)

    unless entity_info
      Rails.logger.warn("[XeroAttachmentUploadJob] Could not determine Xero entity for document #{document_id}")
      return
    end

    entity_type = entity_info[:entity_type]
    entity_id = entity_info[:entity_id]
    credential = entity_info[:credential]

    unless SUPPORTED_ENTITY_TYPES.include?(entity_type)
      Rails.logger.warn("[XeroAttachmentUploadJob] Unsupported entity type: #{entity_type}")
      return
    end

    with_xero_credential(credential_id: credential.id, sync_type: "attachments", trigger: "manual") do |_cred|
      # Get the file content
      file_content = download_document_content(document)

      unless file_content
        Rails.logger.error("[XeroAttachmentUploadJob] Could not download content for document #{document_id}")
        increment_records_skipped
        return
      end

      # Determine filename
      filename = document.file_name.presence || document.title.presence || "document_#{document.id}.pdf"

      # Sanitize filename for Xero
      filename = sanitize_filename(filename)

      # Upload to Xero
      client = XeroApiClient.new
      result = client.upload_attachment(
        entity_type,
        entity_id,
        filename,
        file_content,
        tenant_id: credential.tenant_id,
        content_type: document.content_type.presence || guess_content_type(filename),
        include_online: options[:include_online] || false
      )

      if result[:success]
        # Update document with Xero attachment info
        document.update!(
          synced_to_xero_at: Time.current,
          xero_attachment_id: result[:attachment_id],
          sync_to_xero: false # Clear the pending flag
        )

        increment_records_processed
        increment_records_updated

        Rails.logger.info("[XeroAttachmentUploadJob] Successfully uploaded document #{document.id} as #{filename}")
      else
        Rails.logger.error("[XeroAttachmentUploadJob] Failed to upload document #{document.id}: #{result[:error]}")
        raise StandardError, result[:error]
      end
    end
  rescue StandardError => e
    Rails.logger.error("[XeroAttachmentUploadJob] Error uploading document #{document_id}: #{e.message}")
    raise
  end

  # Upload all documents with sync_to_xero flag
  def upload_all_pending(options)
    scope = CorporateCompanyDocument.where(sync_to_xero: true)
                                    .where(synced_to_xero_at: nil)

    # Optional: limit to a specific company
    if options[:company_id].present?
      scope = scope.where(company_id: options[:company_id])
    end

    # Limit batch size to avoid timeouts
    limit = options[:limit] || 25
    scope = scope.limit(limit)

    count = scope.count
    Rails.logger.info("[XeroAttachmentUploadJob] Found #{count} pending documents to upload")

    return if count.zero?

    scope.find_each do |document|
      begin
        upload_single_document(document.id, options.except(:batch, :limit))

        # Rate limiting between uploads
        sleep(0.5)
      rescue StandardError => e
        Rails.logger.error("[XeroAttachmentUploadJob] Failed to upload document #{document.id}: #{e.message}")
        # Continue with next document
      end
    end
  end

  # Resolve which Xero entity this document should be attached to
  def resolve_xero_entity(document, options = {})
    # If explicitly provided, use those
    if options[:entity_type].present? && options[:entity_id].present?
      credential = find_credential_for_entity(options[:entity_type], options[:entity_id], options[:tenant_id])
      return nil unless credential

      return {
        entity_type: options[:entity_type],
        entity_id: options[:entity_id],
        credential: credential
      }
    end

    # Check if document is linked to an invoice via documentable
    if document.documentable_type == "ExternalInvoice" && document.documentable.present?
      invoice = document.documentable
      if invoice.xero_id.present?
        credential = XeroCredential.find_by(tenant_id: invoice.tenant_id)
        return nil unless credential

        return {
          entity_type: "Invoices",
          entity_id: invoice.xero_id,
          credential: credential
        }
      end
    end

    # Check if document is linked to a contact via contact_id
    if document.contact.present?
      # Try to find Xero contact ID
      xero_contact = find_xero_contact_for_teeem_contact(document.contact)
      if xero_contact
        credential = XeroCredential.find_by(tenant_id: xero_contact[:tenant_id])
        return nil unless credential

        return {
          entity_type: "Contacts",
          entity_id: xero_contact[:xero_id],
          credential: credential
        }
      end
    end

    # Check if linked to a job with invoices
    if document.documentable_type == "Job" && document.documentable.present?
      job = document.documentable
      # Find the primary invoice for this job
      invoice = ExternalInvoice.where(job_id: job.id).where.not(xero_id: nil).first
      if invoice
        credential = XeroCredential.find_by(tenant_id: invoice.tenant_id)
        return nil unless credential

        return {
          entity_type: "Invoices",
          entity_id: invoice.xero_id,
          credential: credential
        }
      end
    end

    Rails.logger.warn("[XeroAttachmentUploadJob] Could not resolve Xero entity for document #{document.id}")
    nil
  end

  # Find a Xero contact for a TEEEM contact
  def find_xero_contact_for_teeem_contact(contact)
    return nil unless contact

    # Check if contact has xero_contact_id stored
    if contact.respond_to?(:xero_contact_id) && contact.xero_contact_id.present?
      # Need to also find the tenant
      # Try to find from the contact's company
      company = contact.corporate_company
      if company&.corporate_company_xero_connection.present?
        return {
          xero_id: contact.xero_contact_id,
          tenant_id: company.corporate_company_xero_connection.xero_tenant_id
        }
      end
    end

    # Fallback: search ExternalContact by name match
    external_contact = ExternalContact.where("LOWER(name) = ?", contact.full_name&.downcase).first
    if external_contact&.xero_id.present?
      return {
        xero_id: external_contact.xero_id,
        tenant_id: external_contact.tenant_id
      }
    end

    nil
  end

  # Find the right credential for an entity
  def find_credential_for_entity(entity_type, entity_id, tenant_id = nil)
    return XeroCredential.find_by(tenant_id: tenant_id) if tenant_id.present?

    # Try to infer tenant from entity
    case entity_type
    when "Invoices"
      invoice = ExternalInvoice.find_by(xero_id: entity_id)
      XeroCredential.find_by(tenant_id: invoice&.tenant_id)
    when "Contacts"
      contact = ExternalContact.find_by(xero_id: entity_id)
      XeroCredential.find_by(tenant_id: contact&.tenant_id)
    else
      # Use current/default credential
      XeroCredential.current
    end
  end

  # Download document content from storage
  # SSoT: Delegates to DocumentStorageService (handles S3, SharePoint, ActiveStorage)
  def download_document_content(document)
    service = DocumentStorageService.new
    result = service.download(document)

    if result[:success]
      result[:content]
    else
      Rails.logger.error("[XeroAttachmentUploadJob] Download failed for document #{document.id}: #{result[:error]}")
      nil
    end
  end

  # Download file from a direct URL
  def download_from_url(url)
    response = HTTParty.get(url, timeout: 30)
    response.body if response.success?
  rescue StandardError => e
    Rails.logger.error("[XeroAttachmentUploadJob] URL download failed: #{e.message}")
    nil
  end

  # SSoT: Use centralized SharePoint filename sanitization
  # See lib/sharepoint/filename_sanitizer.rb for rules
  def sanitize_filename(filename)
    # SSoT handles character sanitization and length limiting (255 max)
    sanitized = SharePoint::FilenameSanitizer.sanitize(filename)

    # Ensure it has an extension (Xero requires it)
    sanitized += ".pdf" unless sanitized.include?(".")

    sanitized
  end

  # Guess content type from filename
  def guess_content_type(filename)
    ext = File.extname(filename).downcase
    case ext
    when ".pdf"
      "application/pdf"
    when ".png"
      "image/png"
    when ".jpg", ".jpeg"
      "image/jpeg"
    when ".gif"
      "image/gif"
    when ".doc"
      "application/msword"
    when ".docx"
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    when ".xls"
      "application/vnd.ms-excel"
    when ".xlsx"
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    when ".csv"
      "text/csv"
    when ".txt"
      "text/plain"
    else
      "application/octet-stream"
    end
  end
end

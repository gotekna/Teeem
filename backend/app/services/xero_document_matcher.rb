# frozen_string_literal: true

# XeroDocumentMatcher - Match existing documents to Xero invoices
#
# SSoT Content-Hash Deduplication (Jan 2026)
#
# This service helps reconcile existing documents with Xero invoices to
# prevent duplicate WarehouseDocuments for the same PDF content.
#
# Usage:
#   # For a single invoice
#   matcher = XeroDocumentMatcher.new(invoice)
#   match = matcher.find_best_match
#   matcher.link_match(match) if match
#
#   # For batch reconciliation
#   matcher = XeroDocumentMatcher.new(dry_run: true)
#   results = matcher.reconcile_all
#
class XeroDocumentMatcher
  attr_reader :invoice, :dry_run, :tenant

  # Initialize with optional invoice for single-document matching
  # @param invoice [ExternalInvoice, nil] The invoice to find matches for (nil for batch mode)
  # @param dry_run [Boolean] If true, don't actually update documents
  def initialize(invoice = nil, dry_run: false)
    @invoice = invoice
    @dry_run = dry_run
    @tenant = find_tenant
  end

  # Find the best matching document for the invoice
  # @return [WarehouseDocument, nil] The best matching document or nil
  def find_best_match
    return nil unless invoice.present?

    # Priority 1: Match by invoice number in display_name
    match = match_by_invoice_number
    return match if match

    # Priority 2: Match by amount + date (future enhancement)
    # match = match_by_amount_and_date
    # return match if match

    nil
  end

  # Link a matched document to the invoice
  # @param doc [WarehouseDocument] The document to link
  # @return [Boolean] True if successfully linked
  def link_match(doc)
    return false if dry_run
    return false unless doc.present? && invoice.present?

    original_source_type = doc.source_type
    original_documentable_type = doc.documentable_type
    original_documentable_id = doc.documentable_id

    document_type = find_document_type_for_invoice

    doc.update!(
      documentable: invoice,
      source_type: "xero",
      linkable: invoice.contact,
      metadata: (doc.metadata || {}).merge(
        "xero_id" => invoice.external_id,
        "xero_linked_at" => Time.current.iso8601,
        "original_source_type" => original_source_type,
        "original_documentable_type" => original_documentable_type,
        "original_documentable_id" => original_documentable_id,
        "document_type_id" => document_type&.id,
        "document_type_name" => document_type&.name,
        "invoice_number" => invoice.invoice_number,
        "invoice_type" => invoice.invoice_type,
        "linked_via" => "invoice_number_reconciliation"
      )
    )

    Rails.logger.info("[XeroDocumentMatcher] Linked document #{doc.id} to invoice #{invoice.id}")
    true
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error("[XeroDocumentMatcher] Failed to link document: #{e.message}")
    false
  end

  # Reconcile all unlinked invoices
  # @return [Hash] Results summary
  def reconcile_all
    results = {
      processed: 0,
      matched: 0,
      already_linked: 0,
      no_match: 0,
      errors: [],
      matches: []
    }

    unlinked_invoices.find_each do |inv|
      @invoice = inv
      results[:processed] += 1

      begin
        # Check if already linked
        if invoice_already_linked?
          results[:already_linked] += 1
          next
        end

        match = find_best_match
        if match
          results[:matched] += 1
          results[:matches] << {
            invoice_id: inv.id,
            invoice_number: inv.invoice_number,
            document_id: match.id,
            document_display_name: match.display_name,
            match_type: determine_match_type(match)
          }

          link_match(match) unless dry_run
        else
          results[:no_match] += 1
        end

        # Progress logging
        if results[:processed] % 100 == 0
          puts "Progress: #{results[:processed]} processed, #{results[:matched]} matched"
        end

      rescue => e
        results[:errors] << "Invoice #{inv.id}: #{e.message}"
        Rails.logger.error("[XeroDocumentMatcher] Error processing invoice #{inv.id}: #{e.message}")
      end
    end

    results
  end

  private

  def find_tenant
    if invoice.present?
      # Try to find tenant from invoice's Xero credential
      xero_credential = XeroCredential.find_by(tenant_id: invoice.tenant_id)
      org = xero_credential&.organization || Organization.where(is_active: true).first
      org&.tenant
    else
      # Default to first tenant for batch operations
      Tenant.first
    end
  end

  def unlinked_invoices
    ExternalInvoice
      .left_joins(:warehouse_documents)
      .where(warehouse_documents: { id: nil })
      .where.not(external_id: nil)
      .where.not(invoice_number: nil)
  end

  def invoice_already_linked?
    WarehouseDocument.exists?(
      documentable: invoice,
      source_type: "xero"
    )
  end

  # Match by invoice number in display_name or original_filename
  def match_by_invoice_number
    return nil if invoice.invoice_number.blank?

    # Search for documents containing the invoice number
    # Look in unlinked documents only
    WarehouseDocument
      .where(documentable_id: nil)
      .where(
        "display_name ILIKE :pattern OR original_filename ILIKE :pattern",
        pattern: "%#{sanitize_for_like(invoice.invoice_number)}%"
      )
      .where(content_type: "application/pdf")
      .first
  end

  # Match by content pattern (invoice number in storage path or metadata)
  def match_by_content_pattern
    return nil if invoice.invoice_number.blank?

    # Search in metadata for invoice number
    WarehouseDocument
      .where(documentable_id: nil)
      .where("metadata->>'invoice_number' = ?", invoice.invoice_number)
      .first
  end

  # Find DocumentType for the invoice
  def find_document_type_for_invoice
    type_name = case invoice.invoice_type
                when "bill" then "Xero Bill"
                when "credit_note" then "Xero Credit Note"
                else "Xero Invoice"
                end

    DocumentType.find_by(name: type_name)
  end

  def determine_match_type(doc)
    if doc.ui_name&.include?(invoice.invoice_number)
      "ui_name"
    elsif doc.original_filename&.include?(invoice.invoice_number)
      "filename"
    elsif doc.metadata&.dig("invoice_number") == invoice.invoice_number
      "metadata"
    else
      "unknown"
    end
  end

  def sanitize_for_like(value)
    # Escape special characters for LIKE pattern
    value.to_s.gsub(/[%_\\]/) { |char| "\\#{char}" }
  end
end

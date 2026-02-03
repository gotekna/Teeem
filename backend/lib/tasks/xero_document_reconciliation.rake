# frozen_string_literal: true

# Xero Document Reconciliation Tasks
#
# SSoT Content-Hash Deduplication (Jan 2026)
#
# These tasks reconcile existing documents with Xero invoices to prevent
# duplicate WarehouseDocuments for the same PDF content.
#
# Architecture:
#   ExternalInvoice (Xero invoice record)
#      ↑ links via
#   WarehouseDocument (documentable: ExternalInvoice)
#      ↑ links via
#   StorageBlob (content_hash deduplication)
#
# Usage:
#   rails xero:reconcile_documents:status         # Check current status
#   rails xero:reconcile_documents:dry_run        # Preview what would be linked
#   rails xero:reconcile_documents:execute        # Actually link documents
#   rails xero:reconcile_documents:by_content     # Link by content hash (requires Xero API)
#
namespace :xero do
  namespace :reconcile_documents do
    desc "Check status of Xero invoice document linking"
    task status: :environment do
      puts "=" * 60
      puts "Xero Document Reconciliation Status"
      puts "=" * 60

      # Get all external invoices
      total_invoices = ExternalInvoice.count
      puts "\nExternalInvoices: #{total_invoices}"

      # Invoices with linked WarehouseDocuments
      invoices_with_docs = ExternalInvoice
        .joins("INNER JOIN warehouse_documents ON warehouse_documents.documentable_type = 'ExternalInvoice' AND warehouse_documents.documentable_id = external_invoices.id")
        .distinct
        .count
      puts "  With WarehouseDocument: #{invoices_with_docs} (#{(invoices_with_docs.to_f / total_invoices * 100).round(1)}%)"

      # Invoices without linked WarehouseDocuments
      invoices_without_docs = ExternalInvoice
        .left_joins(:warehouse_documents)
        .where(warehouse_documents: { id: nil })
        .where.not(external_id: nil)
        .count
      puts "  Without WarehouseDocument: #{invoices_without_docs}"

      # Xero-sourced WarehouseDocuments
      xero_docs = WarehouseDocument.where(source_type: "xero").count
      xero_docs_linked = WarehouseDocument.where(source_type: "xero")
        .where(documentable_type: "ExternalInvoice")
        .where.not(documentable_id: nil)
        .count
      puts "\nXero WarehouseDocuments: #{xero_docs}"
      puts "  Linked to ExternalInvoice: #{xero_docs_linked}"

      # Documents that were linked via content-hash dedup
      linked_via_content = WarehouseDocument
        .where(source_type: "xero")
        .where("metadata->>'xero_linked_at' IS NOT NULL")
        .count
      puts "  Linked via content-hash dedup: #{linked_via_content}"

      # Potential matches by invoice number pattern
      puts "\nPotential matches by invoice number:"
      unlinked_invoices = ExternalInvoice
        .left_joins(:warehouse_documents)
        .where(warehouse_documents: { id: nil })
        .where.not(external_id: nil)
        .where.not(invoice_number: nil)
        .limit(10)

      unlinked_invoices.each do |invoice|
        potential_matches = WarehouseDocument
          .where(documentable_id: nil)
          .where("display_name ILIKE ?", "%#{invoice.invoice_number}%")
          .count
        if potential_matches > 0
          puts "  Invoice #{invoice.invoice_number}: #{potential_matches} potential match(es)"
        end
      end

      puts "\n" + "=" * 60
    end

    desc "Dry run: Preview documents that would be linked by invoice number"
    task dry_run: :environment do
      puts "=" * 60
      puts "Xero Document Reconciliation - DRY RUN"
      puts "=" * 60
      puts "\nLooking for documents that can be linked by invoice number..."

      matcher = XeroDocumentMatcher.new(dry_run: true)
      results = matcher.reconcile_all

      puts "\nResults:"
      puts "  Invoices processed: #{results[:processed]}"
      puts "  Matches found: #{results[:matched]}"
      puts "  Already linked: #{results[:already_linked]}"
      puts "  No match: #{results[:no_match]}"
      puts "  Errors: #{results[:errors].count}"

      if results[:matches].any?
        puts "\nMatches that would be linked:"
        results[:matches].first(20).each do |match|
          puts "  Invoice #{match[:invoice_number]} (ID: #{match[:invoice_id]})"
          puts "    -> Document: #{match[:document_display_name]} (ID: #{match[:document_id]})"
          puts "    -> Match type: #{match[:match_type]}"
        end
        puts "  ... and #{results[:matches].count - 20} more" if results[:matches].count > 20
      end

      if results[:errors].any?
        puts "\nErrors:"
        results[:errors].first(5).each do |error|
          puts "  #{error}"
        end
      end

      puts "\n" + "=" * 60
      puts "To actually link these documents, run:"
      puts "  rails xero:reconcile_documents:execute"
    end

    desc "Execute: Link documents to Xero invoices by invoice number"
    task execute: :environment do
      puts "=" * 60
      puts "Xero Document Reconciliation - EXECUTE"
      puts "=" * 60

      puts "\nThis will update WarehouseDocuments to link to ExternalInvoices."
      puts "Press Ctrl+C within 5 seconds to cancel..."
      sleep 5

      matcher = XeroDocumentMatcher.new(dry_run: false)
      results = matcher.reconcile_all

      puts "\nResults:"
      puts "  Invoices processed: #{results[:processed]}"
      puts "  Documents linked: #{results[:matched]}"
      puts "  Already linked: #{results[:already_linked]}"
      puts "  No match: #{results[:no_match]}"
      puts "  Errors: #{results[:errors].count}"

      if results[:errors].any?
        puts "\nErrors:"
        results[:errors].first(10).each do |error|
          puts "  #{error}"
        end
      end

      puts "\n" + "=" * 60
    end

    desc "Link documents by content hash (requires downloading from Xero)"
    task by_content: :environment do
      puts "=" * 60
      puts "Xero Document Reconciliation - BY CONTENT HASH"
      puts "=" * 60
      puts "\nThis will download PDFs from Xero and match by content hash."
      puts "This is slower but more accurate than invoice number matching."
      puts "Press Ctrl+C within 5 seconds to cancel..."
      sleep 5

      # Get unlinked invoices
      unlinked = ExternalInvoice
        .left_joins(:warehouse_documents)
        .where(warehouse_documents: { id: nil })
        .where.not(external_id: nil)
        .limit(100) # Process in batches to avoid API rate limits

      puts "Found #{unlinked.count} unlinked invoices to process"

      linked = 0
      errors = 0
      xero_client = XeroApiClient.new

      unlinked.find_each.with_index do |invoice, index|
        begin
          # Download PDF from Xero
          pdf_result = case invoice.invoice_type
                       when "quote"
                         xero_client.get_quote_pdf(invoice.external_id, tenant_id: invoice.tenant_id)
                       when "credit_note"
                         xero_client.get_credit_note_pdf(invoice.external_id, tenant_id: invoice.tenant_id)
                       else
                         xero_client.get_invoice_pdf(invoice.external_id, tenant_id: invoice.tenant_id)
                       end

          unless pdf_result[:success]
            puts "  [#{index + 1}] Invoice #{invoice.invoice_number}: Failed to download PDF - #{pdf_result[:error]}"
            errors += 1
            next
          end

          # Compute content hash
          content_hash = StorageBlob.compute_hash(pdf_result[:content])

          # Find matching document
          matching_doc = WarehouseDocument
            .joins(:storage_blob)
            .where(storage_blobs: { content_hash: content_hash })
            .where(documentable_id: nil)
            .first

          if matching_doc
            # Get document type for folder computation
            tenant = invoice.tenant_id.present? ? Tenant.first : nil
            document_type = DocumentType.find_by(name: "Xero Bill") || DocumentType.find_by(name: "Xero Invoice")

            original_source_type = matching_doc.source_type
            matching_doc.update!(
              documentable: invoice,
              source_type: "xero",
              linkable: invoice.contact,
              metadata: (matching_doc.metadata || {}).merge(
                "xero_id" => invoice.external_id,
                "xero_linked_at" => Time.current.iso8601,
                "original_source_type" => original_source_type,
                "invoice_number" => invoice.invoice_number,
                "invoice_type" => invoice.invoice_type,
                "linked_via" => "content_hash_reconciliation"
              )
            )
            linked += 1
            puts "  [#{index + 1}] Invoice #{invoice.invoice_number}: Linked to document #{matching_doc.id}"
          else
            puts "  [#{index + 1}] Invoice #{invoice.invoice_number}: No matching document found"
          end

          # Rate limit protection
          sleep 0.5

        rescue XeroApiClient::RateLimitError => e
          puts "Rate limited by Xero API. Waiting 60 seconds..."
          sleep 60
          retry
        rescue => e
          errors += 1
          puts "  [#{index + 1}] Invoice #{invoice.invoice_number}: Error - #{e.message}"
        end
      end

      puts "\n" + "=" * 60
      puts "Content-hash reconciliation complete!"
      puts "  Documents linked: #{linked}"
      puts "  Errors: #{errors}"
      puts "=" * 60
    end

    desc "Find duplicate WarehouseDocuments for same content"
    task find_duplicates: :environment do
      puts "=" * 60
      puts "Finding Duplicate WarehouseDocuments"
      puts "=" * 60

      # Find content hashes with multiple WarehouseDocuments
      duplicates = WarehouseDocument
        .joins(:storage_blob)
        .where(source_type: "xero")
        .group("storage_blobs.content_hash")
        .having("COUNT(*) > 1")
        .count

      if duplicates.empty?
        puts "\nNo duplicate documents found!"
      else
        puts "\nFound #{duplicates.count} content hashes with multiple documents:"
        duplicates.first(20).each do |hash, count|
          docs = WarehouseDocument.joins(:storage_blob).where(storage_blobs: { content_hash: hash })
          puts "\n  Content hash: #{hash[0..15]}... (#{count} documents)"
          docs.each do |doc|
            puts "    - ID: #{doc.id}, Display: #{doc.ui_name[0..40]}..."
            puts "      Documentable: #{doc.documentable_type}##{doc.documentable_id}"
          end
        end
      end

      puts "\n" + "=" * 60
    end
  end
end

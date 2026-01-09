# frozen_string_literal: true

namespace :xero do
  namespace :pdf do
    desc "Backfill is_pdf_eligible for existing Xero PDF documents (SSoT migration)"
    task backfill_eligibility: :environment do
      puts "Starting PDF eligibility backfill..."

      # Count total PDFs to process
      total = CorporateCompanyDocument
        .where(source: "xero", documentable_type: "ExternalInvoice")
        .count

      puts "Found #{total} Xero PDF documents to process"

      eligible_count = 0
      orphaned_count = 0
      processed = 0

      CorporateCompanyDocument
        .where(source: "xero", documentable_type: "ExternalInvoice")
        .includes(:documentable)
        .find_each do |doc|
          processed += 1
          invoice = doc.documentable

          if invoice.nil?
            # Invoice deleted - orphan the PDF
            doc.update_columns(
              is_pdf_eligible: false,
              orphaned_at: Time.current,
              orphan_reason: "invoice_deleted"
            )
            orphaned_count += 1
          elsif invoice.pdf_eligible?
            # Invoice is eligible
            doc.update_columns(
              is_pdf_eligible: true,
              orphaned_at: nil,
              orphan_reason: nil
            )
            eligible_count += 1
          else
            # Invoice not eligible - orphan the PDF
            reason = if invoice.contact_id.nil?
              "contact_removed"
            elsif invoice.status == "draft"
              "became_draft"
            else
              "eligibility_lost"
            end
            doc.update_columns(
              is_pdf_eligible: false,
              orphaned_at: Time.current,
              orphan_reason: reason
            )
            orphaned_count += 1
          end

          print "\rProcessed #{processed}/#{total} (#{eligible_count} eligible, #{orphaned_count} orphaned)" if processed % 100 == 0
        end

      puts "\n\nBackfill complete!"
      puts "  Total processed: #{processed}"
      puts "  Eligible PDFs: #{eligible_count}"
      puts "  Orphaned PDFs: #{orphaned_count}"
    end

    desc "Detect and report orphaned PDFs without fixing"
    task detect_orphans: :environment do
      stats = XeroSyncStatus.detect_orphaned_pdfs
      puts "Orphan Detection Results:"
      puts "  Marked orphaned: #{stats[:marked_orphaned]}"
      puts "  Should be orphaned (inconsistent): #{stats[:inconsistent_should_be_orphaned]}"
      puts "  Should NOT be orphaned (inconsistent): #{stats[:inconsistent_should_not_be_orphaned]}"
      puts "  Health: #{stats[:health_status]}"
      puts "  Message: #{stats[:message]}"
    end

    desc "Heal orphaned PDFs - fix any data inconsistencies"
    task heal_orphans: :environment do
      puts "Detecting orphaned PDFs..."
      before_stats = XeroSyncStatus.detect_orphaned_pdfs
      puts "Before: #{before_stats[:message]}"

      puts "\nHealing..."
      healed = XeroSyncStatus.heal_orphaned_pdfs!
      puts "Healed #{healed} records"

      puts "\nAfter healing:"
      after_stats = XeroSyncStatus.detect_orphaned_pdfs
      puts "After: #{after_stats[:message]}"
    end
  end
end

# frozen_string_literal: true

# Xero Blob Cleanup Task
#
# Root Cause (Jan 2026):
# The XeroAttachmentSyncService used path_for(:contacts) which had no alias
# before Jan 2026. This caused nil paths, fallback to /corporate/unassigned,
# and SILENT FAILURE of PDF downloads from Xero.
#
# The storage_blob_backfill.rake then ran and created placeholder blobs
# trusting the storage_path, linking multiple docs to the SAME empty blob.
#
# Result: 12,891 docs -> 99 empty placeholder blobs (no actual files)
#
# This task cleans up those invalid blob references so the PDF sync can retry.

namespace :xero do
  namespace :blob do
    desc "Audit Xero documents with invalid blob references (content_hash is nil)"
    task audit: :environment do
      puts "=" * 60
      puts "XERO BLOB AUDIT"
      puts "=" * 60

      # Find Xero docs linked to blobs WITHOUT content_hash (empty placeholders)
      invalid_docs = CorporateCompanyDocument
        .where(source: "xero")
        .where.not(storage_blob_id: nil)
        .joins(:storage_blob)
        .where(storage_blobs: { content_hash: nil })

      invalid_count = invalid_docs.count
      puts "Documents with invalid blob refs: #{invalid_count}"

      # Find the unique blobs
      invalid_blob_ids = invalid_docs.pluck(:storage_blob_id).uniq
      puts "Unique empty placeholder blobs: #{invalid_blob_ids.count}"

      # Show blob details
      if invalid_blob_ids.any?
        puts "\nEmpty placeholder blobs:"
        StorageBlob.where(id: invalid_blob_ids).find_each do |blob|
          doc_count = CorporateCompanyDocument.where(storage_blob_id: blob.id).count
          puts "  Blob #{blob.id}: #{blob.storage_path} (#{doc_count} docs linked)"
        end
      end

      # Show documents with VALID blobs for comparison
      valid_docs = CorporateCompanyDocument
        .where(source: "xero")
        .where.not(storage_blob_id: nil)
        .joins(:storage_blob)
        .where.not(storage_blobs: { content_hash: nil })
      puts "\nDocuments with valid blob refs: #{valid_docs.count}"

      # Show breakdown by document type
      puts "\nBreakdown by document type (invalid refs):"
      invalid_docs.group(:document_type).count.each do |type, count|
        puts "  #{type}: #{count}"
      end

      puts "\n" + "=" * 60
      puts "To clean up: rails xero:blob:cleanup[dry_run]"
      puts "To execute:  rails xero:blob:cleanup[execute]"
      puts "=" * 60
    end

    desc "Clean up invalid Xero blob references (mode: dry_run|execute)"
    task :cleanup, [:mode] => :environment do |_t, args|
      mode = args[:mode] || "dry_run"
      dry_run = mode != "execute"

      puts "=" * 60
      puts "XERO BLOB CLEANUP - #{dry_run ? 'DRY RUN' : 'EXECUTING'}"
      puts "=" * 60

      # Find Xero docs linked to blobs WITHOUT content_hash (empty placeholders)
      invalid_docs = CorporateCompanyDocument
        .where(source: "xero")
        .where.not(storage_blob_id: nil)
        .joins(:storage_blob)
        .where(storage_blobs: { content_hash: nil })

      invalid_count = invalid_docs.count
      puts "Documents to clean: #{invalid_count}"

      if invalid_count.zero?
        puts "Nothing to clean up!"
        next
      end

      # Group by blob to process efficiently
      blob_ids = invalid_docs.pluck(:storage_blob_id).uniq
      puts "Empty placeholder blobs to process: #{blob_ids.count}"

      cleaned_docs = 0
      orphaned_blobs = 0

      blob_ids.each do |blob_id|
        blob = StorageBlob.find_by(id: blob_id)
        next unless blob

        docs_for_blob = CorporateCompanyDocument.where(storage_blob_id: blob_id)
        doc_count = docs_for_blob.count

        puts "  Processing blob #{blob_id} (#{doc_count} docs)..."

        if dry_run
          puts "    [DRY RUN] Would clear storage_blob_id on #{doc_count} documents"
          puts "    [DRY RUN] Would decrement reference_count by #{doc_count}"
          cleaned_docs += doc_count
          if blob.reference_count <= doc_count
            puts "    [DRY RUN] Blob would become orphaned (ref_count: #{blob.reference_count})"
            orphaned_blobs += 1
          end
        else
          # Clear storage_blob_id on all docs linked to this blob
          docs_for_blob.update_all(storage_blob_id: nil, storage_path: nil)
          cleaned_docs += doc_count

          # Decrement reference count
          new_count = [blob.reference_count - doc_count, 0].max
          blob.update_column(:reference_count, new_count)

          puts "    Cleared #{doc_count} documents, ref_count now: #{new_count}"

          # Delete blob if orphaned
          if new_count.zero?
            blob.destroy
            orphaned_blobs += 1
            puts "    Deleted orphaned blob"
          end
        end
      end

      puts "\n" + "=" * 60
      puts "SUMMARY"
      puts "=" * 60
      puts "Documents cleaned: #{cleaned_docs}"
      puts "Blobs removed: #{orphaned_blobs}"

      if dry_run
        puts "\nThis was a DRY RUN. To execute:"
        puts "  rails xero:blob:cleanup[execute]"
      else
        puts "\nCleanup complete. PDF sync will retry these documents."
        puts "Monitor progress at: /settings/company/connections/integrations/xero?tab=stats"
      end
    end

    desc "Verify cleanup results"
    task verify: :environment do
      puts "=" * 60
      puts "XERO BLOB VERIFICATION"
      puts "=" * 60

      # Count documents with invalid blob refs (should be 0 after cleanup)
      invalid_docs = CorporateCompanyDocument
        .where(source: "xero")
        .where.not(storage_blob_id: nil)
        .joins(:storage_blob)
        .where(storage_blobs: { content_hash: nil })
        .count

      puts "Documents with invalid blob refs: #{invalid_docs}"
      puts invalid_docs.zero? ? "SUCCESS: All blob references are valid" : "ISSUE: Still have invalid blob refs"

      # Count documents ready for PDF sync (no valid blob)
      pending_sync = CorporateCompanyDocument
        .where(source: "xero")
        .where(document_type: ["Xero Bill", "Xero Invoice", "Xero Credit Note"])
        .where(storage_blob_id: nil)
        .count

      puts "\nDocuments pending PDF sync: #{pending_sync}"

      # Count documents with valid blobs
      valid_synced = CorporateCompanyDocument
        .where(source: "xero")
        .where(document_type: ["Xero Bill", "Xero Invoice", "Xero Credit Note"])
        .where.not(storage_blob_id: nil)
        .joins(:storage_blob)
        .where.not(storage_blobs: { content_hash: nil })
        .count

      puts "Documents with valid PDF blobs: #{valid_synced}"

      # Check S3/Storage for actual Xero PDFs
      puts "\nTo verify actual files in storage:"
      puts "  rails runner 'puts StorageBlob.where.not(content_hash: nil).where(\"storage_path LIKE ?\", \"Blobs/%\").count'"
    end
  end
end

# frozen_string_literal: true

# Full Warehouse Cleanup - Option C
#
# This task performs a complete cleanup of orphaned/broken warehouse data:
# 1. Delete broken ContactDocument WarehouseDocuments (no storage_blob, files don't exist)
# 2. Delete orphaned StorageBlobs (legacy paths with 0 references)
# 3. Delete orphan Xero WarehouseDocuments (nil documentable_type duplicates)
# 4. Queue Xero re-sync for invoices missing PDFs
#
# Usage:
#   rails warehouse:cleanup              # Preview (dry run)
#   rails warehouse:cleanup[execute]     # Execute cleanup
#
namespace :warehouse do
  desc "Full cleanup of orphaned warehouse data (ContactDocument, legacy blobs, Xero orphans)"
  task :cleanup, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "preview"
    dry_run = mode != "execute"

    puts "=" * 70
    puts "WAREHOUSE DATA CLEANUP - OPTION C (FULL)"
    puts "Mode: #{dry_run ? 'PREVIEW (no changes)' : 'EXECUTE (making changes)'}"
    puts "=" * 70
    puts

    stats = {
      cd_wd_deleted: 0,
      orphan_blobs_deleted: 0,
      xero_orphans_deleted: 0,
      xero_sync_queued: 0,
      errors: 0
    }

    # ========================================
    # STEP 1: Delete broken ContactDocument WarehouseDocuments
    # ========================================
    puts "STEP 1: ContactDocument WarehouseDocuments (broken - no storage_blob)"
    puts "-" * 50

    cd_wd_broken = WarehouseDocument.where(
      documentable_type: "ContactDocument",
      storage_blob_id: nil
    )
    count = cd_wd_broken.count
    puts "  Found: #{count} WarehouseDocuments → ContactDocument without storage_blob"

    if count > 0
      if dry_run
        puts "  [PREVIEW] Would delete #{count} records"
        stats[:cd_wd_deleted] = count
      else
        begin
          deleted = cd_wd_broken.delete_all
          stats[:cd_wd_deleted] = deleted
          puts "  [DELETED] #{deleted} WarehouseDocuments"
        rescue => e
          stats[:errors] += 1
          puts "  [ERROR] #{e.message}"
        end
      end
    end
    puts

    # ========================================
    # STEP 2: Delete orphaned StorageBlobs (legacy paths, 0 references)
    # ========================================
    puts "STEP 2: Orphaned StorageBlobs (legacy paths, not referenced)"
    puts "-" * 50

    # Find blobs not in Blobs/ folder
    legacy_blobs = StorageBlob.where.not("storage_path LIKE ?", "Blobs/%")
    legacy_count = legacy_blobs.count
    puts "  Found: #{legacy_count} StorageBlobs with legacy paths (not Blobs/)"

    # Check which ones are actually orphaned (not referenced by any WarehouseDocument)
    orphan_blob_ids = legacy_blobs.where.not(
      id: WarehouseDocument.where.not(storage_blob_id: nil).select(:storage_blob_id)
    ).pluck(:id)
    puts "  Orphaned (0 references): #{orphan_blob_ids.count}"

    if orphan_blob_ids.any?
      if dry_run
        puts "  [PREVIEW] Would delete #{orphan_blob_ids.count} orphaned blobs"
        # Show sample paths
        sample = StorageBlob.where(id: orphan_blob_ids.first(5)).pluck(:storage_path)
        sample.each { |p| puts "    - #{p}" }
        stats[:orphan_blobs_deleted] = orphan_blob_ids.count
      else
        begin
          deleted = StorageBlob.where(id: orphan_blob_ids).delete_all
          stats[:orphan_blobs_deleted] = deleted
          puts "  [DELETED] #{deleted} orphaned StorageBlobs"
        rescue => e
          stats[:errors] += 1
          puts "  [ERROR] #{e.message}"
        end
      end
    end
    puts

    # ========================================
    # STEP 3: Delete orphan Xero WarehouseDocuments (nil documentable_type)
    # ========================================
    puts "STEP 3: Xero Orphans (source_type=xero, documentable_type=nil)"
    puts "-" * 50

    xero_orphans = WarehouseDocument.where(
      source_type: "xero",
      documentable_type: nil
    )
    xero_count = xero_orphans.count
    puts "  Found: #{xero_count} Xero WarehouseDocuments with nil documentable_type"

    if xero_count > 0
      # These have storage_blob but no link to ExternalInvoice - likely duplicates
      with_blob = xero_orphans.where.not(storage_blob_id: nil).count
      puts "  All have storage_blob: #{with_blob == xero_count}"

      if dry_run
        puts "  [PREVIEW] Would delete #{xero_count} orphan Xero records"
        # Show sample folders
        sample_folders = xero_orphans.limit(5).pluck(:folder)
        sample_folders.each { |f| puts "    - #{f}" }
        stats[:xero_orphans_deleted] = xero_count
      else
        begin
          deleted = xero_orphans.delete_all
          stats[:xero_orphans_deleted] = deleted
          puts "  [DELETED] #{deleted} Xero orphan WarehouseDocuments"
        rescue => e
          stats[:errors] += 1
          puts "  [ERROR] #{e.message}"
        end
      end
    end
    puts

    # ========================================
    # STEP 4: Queue Xero re-sync for invoices missing PDFs
    # ========================================
    puts "STEP 4: Xero Re-sync (invoices missing PDFs)"
    puts "-" * 50

    # Find ExternalInvoices without WarehouseDocument
    ei_with_wd_ids = WarehouseDocument.where(documentable_type: "ExternalInvoice")
                                       .pluck(:documentable_id)
                                       .uniq
    ei_without_pdf = ExternalInvoice.where.not(id: ei_with_wd_ids)
    missing_count = ei_without_pdf.count

    puts "  ExternalInvoices total: #{ExternalInvoice.count}"
    puts "  Already have PDFs: #{ei_with_wd_ids.count}"
    puts "  Missing PDFs: #{missing_count}"

    if missing_count > 0
      if dry_run
        puts "  [PREVIEW] Would queue XeroAttachmentSyncJob"
        puts "  Note: The job will process invoices in batches"
        stats[:xero_sync_queued] = missing_count
      else
        begin
          # Queue the sync job - it handles batching internally
          XeroAttachmentSyncJob.perform_later
          stats[:xero_sync_queued] = missing_count
          puts "  [QUEUED] XeroAttachmentSyncJob to sync #{missing_count} invoices"
        rescue => e
          stats[:errors] += 1
          puts "  [ERROR] Failed to queue job: #{e.message}"
        end
      end
    end
    puts

    # ========================================
    # SUMMARY
    # ========================================
    puts "=" * 70
    puts "SUMMARY"
    puts "=" * 70
    puts "  ContactDocument WDs #{dry_run ? 'to delete' : 'deleted'}:  #{stats[:cd_wd_deleted]}"
    puts "  Orphan StorageBlobs #{dry_run ? 'to delete' : 'deleted'}: #{stats[:orphan_blobs_deleted]}"
    puts "  Xero orphans #{dry_run ? 'to delete' : 'deleted'}:        #{stats[:xero_orphans_deleted]}"
    puts "  Xero invoices #{dry_run ? 'to sync' : 'queued for sync'}: #{stats[:xero_sync_queued]}"
    puts "  Errors: #{stats[:errors]}"
    puts

    if dry_run
      puts "This was a PREVIEW. To execute, run:"
      puts "  rails warehouse:cleanup[execute]"
    else
      puts "Cleanup complete!"
      puts
      puts "Verify with:"
      puts "  rails runner 'puts WarehouseDocument.where(documentable_type: \"ContactDocument\", storage_blob_id: nil).count'"
      puts
      puts "Monitor Xero sync:"
      puts "  Check Sidekiq dashboard or logs for XeroAttachmentSyncJob progress"
    end
    puts
  end

  # ========================================
  # Additional: Delete ContactDocument table rows (optional)
  # ========================================
  desc "Delete orphaned ContactDocument table records (after cleanup)"
  task :cleanup_contact_documents, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "preview"
    dry_run = mode != "execute"

    puts "=" * 70
    puts "CONTACT DOCUMENT TABLE CLEANUP"
    puts "Mode: #{dry_run ? 'PREVIEW (no changes)' : 'EXECUTE (making changes)'}"
    puts "=" * 70
    puts

    # Count records
    total = ActiveRecord::Base.connection.execute(
      "SELECT COUNT(*) FROM contact_documents"
    ).first["count"]
    puts "ContactDocument records: #{total}"

    # Check if any WarehouseDocuments still reference them
    referenced = WarehouseDocument.where(documentable_type: "ContactDocument").count
    puts "Still referenced by WarehouseDocuments: #{referenced}"

    if referenced > 0
      puts
      puts "⚠️  Cannot delete ContactDocument table - still has #{referenced} WarehouseDocument references"
      puts "Run 'rails warehouse:cleanup[execute]' first to remove broken references"
      next
    end

    if dry_run
      puts "[PREVIEW] Would delete #{total} ContactDocument records"
      puts
      puts "To execute, run:"
      puts "  rails warehouse:cleanup_contact_documents[execute]"
    else
      begin
        deleted = ActiveRecord::Base.connection.execute(
          "DELETE FROM contact_documents"
        )
        puts "[DELETED] All ContactDocument records"
      rescue => e
        puts "[ERROR] #{e.message}"
      end
    end
    puts
  end
end

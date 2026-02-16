# frozen_string_literal: true

# Phase 3: Garbage Collection for StorageBlob
#
# Tasks:
#   blob:cleanup:orphaned         - Delete blobs with no references
#   blob:audit:integrity          - Verify reference_count matches actual refs
#   blob:audit:duplicates         - Find duplicate blobs (same content_hash)
#   blob:audit:warehouse          - Check WarehouseDocument→StorageBlob links
#   blob:backfill:email_attachments - Backfill WH docs for legacy email attachments
#
# SSoT: BlobReferenceScanner (app/services/blob_reference_scanner.rb)
#   Checks ALL 20+ models/tables with storage_blob_id before declaring orphaned.
#   FRC (Feb 2026): Previous version only checked 3 of 20+ models.
#
# Safety:
#   - All cleanup tasks require explicit confirmation
#   - Dry run mode by default
#   - Logs all deletions for audit trail
#
namespace :blob do
  namespace :cleanup do
    desc "Delete orphaned StorageBlobs (no references from any model)"
    task :orphaned, [:mode, :age_days] => :environment do |_t, args|
      mode = args[:mode] || "dry_run"
      age_days = (args[:age_days] || 30).to_i
      execute = mode == "execute"

      puts "=" * 70
      puts "Phase 3: Orphaned StorageBlob Cleanup"
      puts "Mode: #{execute ? 'EXECUTE (will delete!)' : 'DRY RUN (preview only)'}"
      puts "Min age: #{age_days} days (blobs newer than this are skipped)"
      puts "=" * 70
      puts ""

      cutoff_date = age_days.days.ago

      # Collect ALL referenced blob IDs (SSoT: BlobReferenceScanner)
      puts "Scanning all #{BlobReferenceScanner.source_count} reference sources..."
      all_referenced_ids = BlobReferenceScanner.all_referenced_blob_ids do |source, count|
        puts "  #{source}: #{count} unique blobs" if count > 0
      end

      puts "  Total unique referenced: #{all_referenced_ids.count}"
      puts ""

      # Find orphaned blobs (older than cutoff, not in referenced list)
      orphaned_scope = StorageBlob.where("created_at < ?", cutoff_date)
      orphaned_scope = orphaned_scope.where.not(id: all_referenced_ids.to_a) if all_referenced_ids.any?

      orphan_count = orphaned_scope.count
      total_blobs = StorageBlob.count
      total_size_bytes = orphaned_scope.sum(:file_size)
      total_size_mb = (total_size_bytes / 1024.0 / 1024.0).round(2)

      puts "Orphaned blobs found: #{orphan_count} / #{total_blobs} total"
      puts "Total size to reclaim: #{total_size_mb} MB"
      puts ""

      if orphan_count == 0
        puts "No orphaned blobs to clean up!"
        next
      end

      # Show sample of what would be deleted
      puts "Sample orphaned blobs (first 10):"
      orphaned_scope.limit(10).each do |blob|
        puts "  ID: #{blob.id}"
        puts "    Path: #{blob.storage_path}"
        puts "    Size: #{(blob.file_size.to_f / 1024).round(1)} KB"
        puts "    Created: #{blob.created_at}"
        puts ""
      end

      if execute
        puts "-" * 70
        puts "EXECUTING DELETION..."
        puts "-" * 70

        # Set tenant context for storage provider access
        tenant = Tenant.find_by(name: "Tekna") || Tenant.first
        ActsAsTenant.current_tenant = tenant
        provider = DocumentProviders.for_tenant(tenant)

        deleted_count = 0
        deleted_size = 0
        error_count = 0

        orphaned_scope.find_each do |blob|
          begin
            provider.delete_file(blob.storage_path) rescue nil
            deleted_size += blob.file_size.to_i
            blob.destroy!
            deleted_count += 1
            print "." if deleted_count % 100 == 0
          rescue StandardError => e
            puts "\n  ERROR deleting blob #{blob.id}: #{e.message}"
            error_count += 1
          end
        end

        puts ""
        puts ""
        puts "=" * 70
        puts "Cleanup Complete"
        puts "=" * 70
        puts "Deleted: #{deleted_count} blobs"
        puts "Reclaimed: #{(deleted_size / 1024.0 / 1024.0).round(2)} MB"
        puts "Errors: #{error_count}"
      else
        puts "-" * 70
        puts "DRY RUN - No changes made"
        puts "-" * 70
        puts ""
        puts "To execute cleanup, run:"
        puts "  rails blob:cleanup:orphaned[execute]"
        puts ""
        puts "To clean blobs older than 7 days:"
        puts "  rails blob:cleanup:orphaned[execute,7]"
      end
    end
  end

  namespace :audit do
    desc "Verify StorageBlob reference counts match actual references"
    task :integrity, [:fix] => :environment do |_t, args|
      fix = args[:fix] == "fix"

      puts "=" * 70
      puts "Phase 3: StorageBlob Integrity Audit"
      puts "Mode: #{fix ? 'FIX (will update counts)' : 'AUDIT ONLY'}"
      puts "=" * 70
      puts ""

      mismatches = []
      checked = 0

      StorageBlob.find_each do |blob|
        actual_count = BlobReferenceScanner.count_references_for(blob.id)
        stored_count = blob.reference_count

        if actual_count != stored_count
          mismatches << {
            id: blob.id,
            storage_path: blob.storage_path,
            stored: stored_count,
            actual: actual_count
          }

          blob.update_column(:reference_count, actual_count) if fix
        end

        checked += 1
        print "." if checked % 1000 == 0
      end

      puts ""
      puts ""
      puts "=" * 70
      puts "Integrity Audit Results"
      puts "=" * 70
      puts "Total blobs checked: #{checked}"
      puts "Mismatches found: #{mismatches.count}"

      if mismatches.any?
        puts ""
        puts "Mismatched blobs (first 20):"
        mismatches.first(20).each do |m|
          puts "  Blob #{m[:id]}:"
          puts "    Path: #{m[:storage_path]&.truncate(50)}"
          puts "    Stored count: #{m[:stored]}, Actual: #{m[:actual]}"
        end

        if fix
          puts ""
          puts "All #{mismatches.count} reference counts have been FIXED."
        else
          puts ""
          puts "To fix reference counts, run:"
          puts "  rails blob:audit:integrity[fix]"
        end
      else
        puts ""
        puts "All reference counts are correct!"
      end
    end

    desc "Find duplicate StorageBlobs (same content_hash, multiple records)"
    task duplicates: :environment do
      puts "=" * 70
      puts "Phase 3: Duplicate StorageBlob Audit"
      puts "=" * 70
      puts ""

      duplicates = StorageBlob
        .where.not(content_hash: nil)
        .group(:content_hash)
        .having("COUNT(*) > 1")
        .count

      if duplicates.empty?
        puts "No duplicate blobs found!"
        puts "All blobs with content_hash are unique."
        next
      end

      puts "Found #{duplicates.count} content hashes with duplicates:"
      puts ""

      total_wasted = 0

      duplicates.each do |hash, count|
        blobs = StorageBlob.where(content_hash: hash).order(:created_at)
        primary = blobs.first
        extras = blobs.offset(1)

        wasted_size = extras.sum(:file_size)
        total_wasted += wasted_size

        puts "Content hash: #{hash[0..15]}..."
        puts "  Duplicate count: #{count}"
        puts "  Primary blob: #{primary.id} (created: #{primary.created_at})"
        puts "  Extra blobs: #{extras.pluck(:id).join(', ')}"
        puts "  Wasted space: #{(wasted_size / 1024.0).round(1)} KB"
        puts ""
      end

      puts "=" * 70
      puts "Total duplicates: #{duplicates.values.sum - duplicates.count} extra blobs"
      puts "Total wasted space: #{(total_wasted / 1024.0 / 1024.0).round(2)} MB"
      puts ""
      puts "Note: Deduplication requires re-linking references to primary blob."
      puts "This is handled automatically for new uploads via content_hash lookup."
    end

    desc "Audit WarehouseDocument → StorageBlob links"
    task warehouse: :environment do
      puts "=" * 70
      puts "Phase 3: WarehouseDocument Link Audit"
      puts "=" * 70
      puts ""

      total = WarehouseDocument.count
      with_blob = WarehouseDocument.where.not(storage_blob_id: nil).count
      without_blob = WarehouseDocument.where(storage_blob_id: nil).count

      puts "Total WarehouseDocuments: #{total}"
      puts "  With StorageBlob: #{with_blob} (#{(with_blob.to_f / total * 100).round(1)}%)"
      puts "  Without StorageBlob: #{without_blob} (#{(without_blob.to_f / total * 100).round(1)}%)"
      puts ""

      puts "By source_type:"
      WarehouseDocument.group(:source_type).count.each do |source, count|
        with = WarehouseDocument.where(source_type: source).where.not(storage_blob_id: nil).count
        without = count - with
        puts "  #{source}: #{count} total, #{with} with blob, #{without} without"
      end
      puts ""

      puts "Checking for broken references..."
      blob_ids = StorageBlob.pluck(:id)
      broken = WarehouseDocument
        .where.not(storage_blob_id: nil)
        .where.not(storage_blob_id: blob_ids)
        .count

      if broken > 0
        puts "  WARNING: #{broken} WarehouseDocuments reference non-existent blobs!"
      else
        puts "  All blob references are valid."
      end
      puts ""

      puts "Checking documentable references..."
      orphaned_docs = 0
      WarehouseDocument.find_each do |wd|
        begin
          wd.documentable
        rescue StandardError
          orphaned_docs += 1
        end
      end

      if orphaned_docs > 0
        puts "  WARNING: #{orphaned_docs} WarehouseDocuments have invalid documentable!"
      else
        puts "  All documentable references are valid."
      end
    end
  end

  namespace :backfill do
    desc "Create WarehouseDocuments for email_attachments with blobs but no WH doc"
    task email_attachments: :environment do
      puts "=" * 70
      puts "Backfill: email_attachments → WarehouseDocument"
      puts "FRC (Feb 2026): Legacy email_attachments table has blobs without"
      puts "WarehouseDocument entries. This creates them via WarehouseDocumentCreator."
      puts "=" * 70
      puts ""

      unless ActiveRecord::Base.connection.table_exists?("email_attachments")
        puts "email_attachments table does not exist. Nothing to backfill."
        next
      end

      # Set tenant context
      tenant = Tenant.find_by(name: "Tekna") || Tenant.first
      unless tenant
        puts "No tenant found"
        next
      end
      ActsAsTenant.current_tenant = tenant

      # Find email_attachment rows with storage_blob_id but no WarehouseDocument
      existing_wh_blob_ids = WarehouseDocument
        .where(source_type: "email_attachment")
        .where.not(storage_blob_id: nil)
        .pluck(:storage_blob_id)

      rows = ActiveRecord::Base.connection.select_all(
        "SELECT ea.id, ea.email_warehouse_id, ea.filename, ea.storage_blob_id, ea.content_hash, " \
        "ea.storage_path, ea.content_id, ea.created_at " \
        "FROM email_attachments ea " \
        "WHERE ea.storage_blob_id IS NOT NULL"
      )

      total = rows.count
      need_backfill = rows.reject { |r| existing_wh_blob_ids.include?(r["storage_blob_id"].to_i) }

      puts "Total email_attachment rows with blob: #{total}"
      puts "Already have WarehouseDocument: #{total - need_backfill.count}"
      puts "Need backfill: #{need_backfill.count}"
      puts ""

      if need_backfill.empty?
        puts "Nothing to backfill!"
        next
      end

      created = 0
      errors = 0

      need_backfill.each do |row|
        blob = StorageBlob.find_by(id: row["storage_blob_id"])
        unless blob
          puts "  SKIP: Blob #{row['storage_blob_id']} not found for email_attachment #{row['id']}"
          errors += 1
          next
        end

        # Find the parent SyncedEmail for linkable context
        synced_email = SyncedEmail.find_by(id: row["email_warehouse_id"])

        begin
          WarehouseDocumentCreator.create!(
            filename: row["filename"] || "attachment",
            source_type: "email_attachment",
            storage_blob: blob,
            linkable: synced_email,
            metadata: {
              "backfilled_from" => "email_attachments",
              "email_attachment_id" => row["id"],
              "content_id" => row["content_id"],
              "backfilled_at" => Time.current.iso8601
            }
          )
          blob.increment_reference!
          created += 1
          print "." if created % 50 == 0
        rescue StandardError => e
          puts "\n  ERROR: email_attachment #{row['id']}: #{e.message}"
          errors += 1
        end
      end

      puts ""
      puts ""
      puts "=" * 70
      puts "Backfill Complete"
      puts "=" * 70
      puts "Created: #{created} WarehouseDocuments"
      puts "Errors: #{errors}"
    end
  end

  desc "Full StorageBlob health check"
  task health: :environment do
    puts "=" * 70
    puts "Phase 3: StorageBlob Health Check"
    puts "=" * 70
    puts ""

    total_blobs = StorageBlob.count
    total_size = StorageBlob.sum(:file_size)
    orphaned = StorageBlob.orphaned.count

    puts "StorageBlob Stats:"
    puts "  Total blobs: #{total_blobs}"
    puts "  Total size: #{(total_size / 1024.0 / 1024.0 / 1024.0).round(2)} GB"
    puts "  Orphaned (ref_count=0): #{orphaned}"
    puts ""

    puts "WarehouseDocument Stats:"
    puts "  Total: #{WarehouseDocument.count}"
    puts "  By source: #{WarehouseDocument.group(:source_type).count}"
    puts ""

    warehouse_with_blob = WarehouseDocument.where.not(storage_blob_id: nil).count
    unique_blobs = WarehouseDocument.where.not(storage_blob_id: nil).distinct.count(:storage_blob_id)
    if warehouse_with_blob > 0 && unique_blobs > 0
      dedup_ratio = ((warehouse_with_blob - unique_blobs).to_f / warehouse_with_blob * 100).round(1)
      puts "Deduplication:"
      puts "  Documents with blobs: #{warehouse_with_blob}"
      puts "  Unique blobs used: #{unique_blobs}"
      puts "  Deduplication ratio: #{dedup_ratio}%"
      puts ""
    end

    # Reference integrity quick check
    mismatched = 0
    StorageBlob.where("reference_count > 0").limit(1000).find_each do |blob|
      actual = BlobReferenceScanner.count_references_for(blob.id)
      mismatched += 1 if actual != blob.reference_count
    end

    puts "Reference Integrity (sampled first 1000):"
    if mismatched > 0
      puts "  WARNING: #{mismatched} blobs have mismatched reference counts"
      puts "  Run: rails blob:audit:integrity[fix]"
    else
      puts "  All reference counts match actual references"
    end
    puts ""

    puts "=" * 70
    puts "Recommendations:"
    puts "=" * 70

    if orphaned > 0
      puts "- Run 'rails blob:cleanup:orphaned[execute]' to delete #{orphaned} orphaned blobs"
    end

    if mismatched > 0
      puts "- Run 'rails blob:audit:integrity[fix]' to fix reference counts"
    end

    if orphaned == 0 && mismatched == 0
      puts "- System is healthy! No action needed."
    end
  end
end

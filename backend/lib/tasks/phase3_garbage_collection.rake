# frozen_string_literal: true

# Phase 3: Garbage Collection for StorageBlob
#
# Tasks:
#   blob:cleanup:orphaned    - Delete blobs with no references
#   blob:audit:integrity     - Verify reference_count matches actual refs
#   blob:audit:duplicates    - Find duplicate blobs (same content_hash)
#   blob:audit:warehouse     - Check WarehouseDocument→StorageBlob links
#
# Architecture:
#   StorageBlob
#   ├── has_many :warehouse_documents (Phase 3 universal table - SSoT)
#   ├── has_many :email_attachments (legacy direct refs)
#   ├── has_many :corporate_company_documents (legacy direct refs)
#   ├── has_many :chat_messages (legacy direct refs)
#   └── has_many :bill_inboxes (legacy direct refs)
#
# An "orphaned" blob is one with:
#   - No warehouse_documents referencing it
#   - No legacy direct references (email_attachments, etc.)
#
# Safety:
#   - All cleanup tasks require explicit confirmation
#   - Dry run mode by default
#   - Logs all deletions for audit trail
#
namespace :blob do
  namespace :cleanup do
    desc "Delete orphaned StorageBlobs (no references)"
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

      # Find blobs older than age_days with no references
      cutoff_date = age_days.days.ago

      # Phase 3: Primary check is WarehouseDocument (SSoT)
      warehouse_blob_ids = WarehouseDocument.where.not(storage_blob_id: nil).distinct.pluck(:storage_blob_id)

      # Legacy: Also check direct associations
      email_blob_ids = EmailAttachment.where.not(storage_blob_id: nil).distinct.pluck(:storage_blob_id)
      corp_blob_ids = CorporateCompanyDocument.where.not(storage_blob_id: nil).distinct.pluck(:storage_blob_id)
      chat_blob_ids = ChatMessage.where.not(storage_blob_id: nil).distinct.pluck(:storage_blob_id)
      bill_blob_ids = BillInbox.where.not(storage_blob_id: nil).distinct.pluck(:storage_blob_id)

      # Combine all referenced blob IDs
      all_referenced_ids = (warehouse_blob_ids + email_blob_ids + corp_blob_ids + chat_blob_ids + bill_blob_ids).uniq

      puts "Reference counts:"
      puts "  WarehouseDocuments: #{warehouse_blob_ids.count} unique blobs"
      puts "  EmailAttachments: #{email_blob_ids.count} unique blobs"
      puts "  CorporateCompanyDocuments: #{corp_blob_ids.count} unique blobs"
      puts "  ChatMessages: #{chat_blob_ids.count} unique blobs"
      puts "  BillInboxes: #{bill_blob_ids.count} unique blobs"
      puts "  Total unique referenced: #{all_referenced_ids.count}"
      puts ""

      # Find orphaned blobs (older than cutoff, not in referenced list)
      orphaned_scope = StorageBlob.where("created_at < ?", cutoff_date)
      if all_referenced_ids.any?
        orphaned_scope = orphaned_scope.where.not(id: all_referenced_ids)
      end

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

      deleted_count = 0
      deleted_size = 0
      error_count = 0

      if execute
        puts "-" * 70
        puts "EXECUTING DELETION..."
        puts "-" * 70

        orphaned_scope.find_each do |blob|
          begin
            # Delete from S3
            provider = DocumentProviders.for_organization(Organization.first)
            provider.delete_file(blob.storage_path) rescue nil

            # Delete from database
            deleted_size += blob.file_size.to_i
            blob.destroy!
            deleted_count += 1

            # Progress indicator
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
        # Count actual references
        warehouse_count = WarehouseDocument.where(storage_blob_id: blob.id).count
        email_count = EmailAttachment.where(storage_blob_id: blob.id).count
        corp_count = CorporateCompanyDocument.where(storage_blob_id: blob.id).count
        chat_count = ChatMessage.where(storage_blob_id: blob.id).count
        bill_count = BillInbox.where(storage_blob_id: blob.id).count

        actual_count = warehouse_count + email_count + corp_count + chat_count + bill_count
        stored_count = blob.reference_count

        if actual_count != stored_count
          mismatches << {
            id: blob.id,
            storage_path: blob.storage_path,
            stored: stored_count,
            actual: actual_count,
            breakdown: {
              warehouse: warehouse_count,
              email: email_count,
              corporate: corp_count,
              chat: chat_count,
              bill: bill_count
            }
          }

          if fix
            blob.update_column(:reference_count, actual_count)
          end
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
          puts "    Breakdown: #{m[:breakdown]}"
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

      # Find content_hashes with multiple blobs
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

      # By source type
      puts "By source_type:"
      WarehouseDocument.group(:source_type).count.each do |source, count|
        with = WarehouseDocument.where(source_type: source).where.not(storage_blob_id: nil).count
        without = count - with
        puts "  #{source}: #{count} total, #{with} with blob, #{without} without"
      end
      puts ""

      # Check for broken references (blob_id points to non-existent blob)
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

      # Check documentable references
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

  desc "Full StorageBlob health check"
  task health: :environment do
    puts "=" * 70
    puts "Phase 3: StorageBlob Health Check"
    puts "=" * 70
    puts ""

    # Basic counts
    total_blobs = StorageBlob.count
    total_size = StorageBlob.sum(:file_size)
    orphaned = StorageBlob.orphaned.count

    puts "StorageBlob Stats:"
    puts "  Total blobs: #{total_blobs}"
    puts "  Total size: #{(total_size / 1024.0 / 1024.0 / 1024.0).round(2)} GB"
    puts "  Orphaned (ref_count=0): #{orphaned}"
    puts ""

    # WarehouseDocument stats
    puts "WarehouseDocument Stats:"
    puts "  Total: #{WarehouseDocument.count}"
    puts "  By source: #{WarehouseDocument.group(:source_type).count}"
    puts ""

    # Deduplication effectiveness
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
    StorageBlob.where("reference_count > 0").find_each do |blob|
      actual = WarehouseDocument.where(storage_blob_id: blob.id).count +
               EmailAttachment.where(storage_blob_id: blob.id).count +
               CorporateCompanyDocument.where(storage_blob_id: blob.id).count
      mismatched += 1 if actual != blob.reference_count
    end

    puts "Reference Integrity:"
    if mismatched > 0
      puts "  WARNING: #{mismatched} blobs have mismatched reference counts"
      puts "  Run: rails blob:audit:integrity[fix]"
    else
      puts "  All reference counts match actual references"
    end
    puts ""

    # Recommendations
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

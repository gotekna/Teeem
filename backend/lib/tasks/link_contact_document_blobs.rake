# frozen_string_literal: true

# Link WarehouseDocuments to StorageBlobs via ContactDocument storage paths
#
# FRC (Jan 2026): WarehouseDocuments with documentable_type: 'ContactDocument'
# were created but don't have storage_blob_id because ContactDocuments
# themselves don't have StorageBlob records - files are stored directly in S3
# via storage_item_id field.
#
# This task:
# 1. Creates StorageBlob records for ContactDocuments (using storage_item_id as path)
# 2. Links ContactDocument → StorageBlob
# 3. Links WarehouseDocument → StorageBlob
#
# Usage:
#   rails warehouse:link_contact_document_blobs              # Preview (dry run)
#   rails warehouse:link_contact_document_blobs[execute]     # Execute
#
namespace :warehouse do
  desc "Create StorageBlobs from ContactDocument S3 paths and link to WarehouseDocuments"
  task :link_contact_document_blobs, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "preview"
    dry_run = mode != "execute"

    puts "=" * 70
    puts "Link ContactDocument Files to StorageBlob & WarehouseDocument"
    puts "Mode: #{dry_run ? 'PREVIEW (no changes)' : 'EXECUTE (making changes)'}"
    puts "=" * 70
    puts

    # Stats
    stats = {
      cd_processed: 0,
      cd_skipped_no_path: 0,
      cd_skipped_has_blob: 0,
      blobs_created: 0,
      blobs_existing: 0,
      cd_linked: 0,
      wd_linked: 0,
      errors: 0
    }

    # Find ContactDocuments with S3 paths but no storage_blob_id
    contact_docs = ActiveRecord::Base.connection.execute(<<~SQL)
      SELECT cd.id, cd.storage_item_id, cd.storage_path, cd.file_name, cd.file_size,
             cd.content_type, cd.storage_blob_id, c.tenant_id
      FROM contact_documents cd
      LEFT JOIN contacts c ON c.id = cd.contact_id
      WHERE cd.storage_provider = 's3_compatible'
        AND cd.storage_blob_id IS NULL
        AND cd.storage_item_id IS NOT NULL
      ORDER BY cd.id
    SQL

    total = contact_docs.ntuples
    puts "Found #{total} ContactDocuments with S3 paths but no StorageBlob"
    puts

    contact_docs.each do |cd|
      stats[:cd_processed] += 1

      cd_id = cd["id"]
      storage_item_id = cd["storage_item_id"]
      file_name = cd["file_name"]
      file_size = cd["file_size"]
      content_type = cd["content_type"]
      tenant_id = cd["tenant_id"]

      if storage_item_id.blank?
        stats[:cd_skipped_no_path] += 1
        next
      end

      if cd["storage_blob_id"].present?
        stats[:cd_skipped_has_blob] += 1
        next
      end

      # storage_item_id is the actual S3 key (e.g., "corporate/unassigned/file.pdf")
      s3_key = storage_item_id.to_s

      if dry_run
        puts "  [PREVIEW] ContactDocument ##{cd_id}: Would create/find StorageBlob for '#{s3_key}'"

        # Check if blob already exists
        existing = StorageBlob.find_by(storage_path: s3_key)
        if existing
          puts "            └─ Blob exists: ##{existing.id}"
          stats[:blobs_existing] += 1
        else
          puts "            └─ Would create new blob"
          stats[:blobs_created] += 1
        end

        # Find corresponding WarehouseDocuments
        wd_count = WarehouseDocument.where(documentable_type: "ContactDocument", documentable_id: cd_id).count
        puts "            └─ Would link #{wd_count} WarehouseDocument(s)"
        stats[:wd_linked] += wd_count
        stats[:cd_linked] += 1
      else
        begin
          # Find or create StorageBlob
          # Note: content_hash = nil for legacy records (no deduplication without download)
          blob = StorageBlob.find_by(storage_path: s3_key)

          if blob
            stats[:blobs_existing] += 1
          else
            blob = StorageBlob.create!(
              storage_path: s3_key,
              content_hash: nil,  # Legacy record - no hash without download
              original_filename: file_name,
              file_size: file_size.to_i,
              content_type: content_type,
              tenant_id: tenant_id,
              reference_count: 0,
              needs_migration: false,
              file_missing: false
            )
            stats[:blobs_created] += 1
            puts "  [OK] Created StorageBlob ##{blob.id} for '#{s3_key}'"
          end

          # Link ContactDocument → StorageBlob
          ActiveRecord::Base.connection.execute(<<~SQL)
            UPDATE contact_documents SET storage_blob_id = #{blob.id} WHERE id = #{cd_id}
          SQL
          stats[:cd_linked] += 1

          # Link WarehouseDocuments → StorageBlob
          wd_updated = WarehouseDocument
            .where(documentable_type: "ContactDocument", documentable_id: cd_id)
            .where(storage_blob_id: nil)
            .update_all(storage_blob_id: blob.id)
          stats[:wd_linked] += wd_updated

          # Update reference count
          blob.update_column(:reference_count, blob.reference_count + 1 + wd_updated)

          if stats[:cd_processed] % 500 == 0
            puts "  Progress: #{stats[:cd_processed]}/#{total} (#{(stats[:cd_processed] * 100.0 / total).round(1)}%)"
          end
        rescue => e
          stats[:errors] += 1
          puts "  [ERROR] ContactDocument ##{cd_id}: #{e.message}"
        end
      end
    end

    puts
    puts "=" * 70
    puts "Summary"
    puts "=" * 70
    puts "  ContactDocuments processed:    #{stats[:cd_processed]}"
    puts "  ├─ Skipped (no path):          #{stats[:cd_skipped_no_path]}"
    puts "  ├─ Skipped (has blob):         #{stats[:cd_skipped_has_blob]}"
    puts "  ├─ Would link / Linked:        #{stats[:cd_linked]}"
    puts "  └─ Errors:                     #{stats[:errors]}"
    puts
    puts "  StorageBlobs:"
    puts "  ├─ Created (new):              #{stats[:blobs_created]}"
    puts "  └─ Existing (reused):          #{stats[:blobs_existing]}"
    puts
    puts "  WarehouseDocuments linked:     #{stats[:wd_linked]}"
    puts

    if dry_run
      puts "This was a PREVIEW. To execute, run:"
      puts "  rails warehouse:link_contact_document_blobs[execute]"
    else
      puts "Migration complete!"
      puts
      puts "Verify with:"
      puts "  SELECT COUNT(*) FROM warehouse_documents"
      puts "    WHERE documentable_type = 'ContactDocument' AND storage_blob_id IS NULL;"
    end
    puts
  end
end

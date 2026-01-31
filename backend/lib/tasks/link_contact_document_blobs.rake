# frozen_string_literal: true

# Link WarehouseDocuments to their StorageBlobs via ContactDocument
#
# FRC (Jan 2026): WarehouseDocuments with documentable_type: 'ContactDocument'
# were created but their storage_blob_id was never linked from the source
# ContactDocument record. This task copies that link.
#
# Usage:
#   rails warehouse:link_contact_document_blobs              # Preview (dry run)
#   rails warehouse:link_contact_document_blobs[execute]     # Execute
#
namespace :warehouse do
  desc "Link WarehouseDocument storage_blob_id from ContactDocument source (preview by default)"
  task :link_contact_document_blobs, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "preview"
    dry_run = mode != "execute"

    puts "=" * 60
    puts "Link WarehouseDocument StorageBlobs from ContactDocument"
    puts "Mode: #{dry_run ? 'PREVIEW (no changes)' : 'EXECUTE (making changes)'}"
    puts "=" * 60
    puts

    # Find WarehouseDocuments with ContactDocument source but no storage_blob_id
    orphaned_docs = WarehouseDocument
      .where(documentable_type: "ContactDocument")
      .where(storage_blob_id: nil)

    total_orphaned = orphaned_docs.count
    puts "Found #{total_orphaned} WarehouseDocuments with documentable_type: 'ContactDocument' and no storage_blob_id"
    puts

    if total_orphaned == 0
      puts "✅ Nothing to migrate!"
      exit
    end

    # Check how many have matching ContactDocument with storage_blob_id
    linkable_count = 0
    unresolvable_count = 0
    linked_count = 0
    error_count = 0

    orphaned_docs.find_each do |wd|
      # Query contact_documents table directly (model may be deleted)
      cd_result = ActiveRecord::Base.connection.execute(
        "SELECT storage_blob_id, file_name FROM contact_documents WHERE id = #{wd.documentable_id.to_i}"
      )

      if cd_result.ntuples == 0
        unresolvable_count += 1
        puts "  [WARN] WarehouseDocument ##{wd.id}: ContactDocument ##{wd.documentable_id} not found"
        next
      end

      cd_storage_blob_id = cd_result[0]["storage_blob_id"]
      cd_file_name = cd_result[0]["file_name"]

      if cd_storage_blob_id.nil?
        unresolvable_count += 1
        puts "  [WARN] WarehouseDocument ##{wd.id}: ContactDocument ##{wd.documentable_id} has no storage_blob_id"
        next
      end

      linkable_count += 1

      if dry_run
        puts "  [PREVIEW] Would link WarehouseDocument ##{wd.id} → StorageBlob ##{cd_storage_blob_id} (#{cd_file_name})"
      else
        begin
          wd.update_column(:storage_blob_id, cd_storage_blob_id)
          linked_count += 1
          puts "  [OK] Linked WarehouseDocument ##{wd.id} → StorageBlob ##{cd_storage_blob_id} (#{cd_file_name})"
        rescue => e
          error_count += 1
          puts "  [ERROR] WarehouseDocument ##{wd.id}: #{e.message}"
        end
      end
    end

    puts
    puts "=" * 60
    puts "Summary"
    puts "=" * 60
    puts "  Total orphaned:     #{total_orphaned}"
    puts "  Linkable:           #{linkable_count}"
    puts "  Unresolvable:       #{unresolvable_count}"
    if dry_run
      puts "  Would link:         #{linkable_count}"
      puts
      puts "To execute the migration, run:"
      puts "  rails warehouse:link_contact_document_blobs[execute]"
    else
      puts "  Linked:             #{linked_count}"
      puts "  Errors:             #{error_count}"
    end
    puts
  end
end

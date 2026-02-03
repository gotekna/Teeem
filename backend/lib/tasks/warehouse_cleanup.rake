# frozen_string_literal: true

namespace :warehouse do
  desc "Remove duplicate WarehouseDocuments (same blob + same folder)"
  task dedupe: :environment do
    puts "=" * 60
    puts "WAREHOUSE DOCUMENT DEDUPLICATION"
    puts "=" * 60
    puts

    # Find all duplicates across all tenants
    ActsAsTenant.without_tenant do
      duplicates = WarehouseDocument
        .group(:storage_blob_id, :folder)
        .having("COUNT(*) > 1")
        .pluck(:storage_blob_id, :folder)

      puts "Found #{duplicates.count} blob+folder combinations with duplicates"
      puts

      total_removed = 0

      duplicates.each do |blob_id, folder|
        # Get all docs for this blob+folder, ordered by id (keep oldest)
        docs = WarehouseDocument
          .where(storage_blob_id: blob_id, folder: folder)
          .order(:id)
          .to_a

        # Keep the first one, delete the rest
        keep = docs.first
        to_delete = docs[1..]

        puts "  Blob #{blob_id} in '#{folder}':"
        puts "    Keeping WD ##{keep.id}: #{keep.display_name&.truncate(40)}"
        puts "    Removing #{to_delete.count} duplicates: #{to_delete.map(&:id).join(', ')}"

        to_delete.each do |doc|
          # Use delete to skip callbacks (blob should NOT be deleted - still referenced)
          doc.delete
          total_removed += 1
        end
      end

      puts
      puts "=" * 60
      puts "Done! Removed #{total_removed} duplicate WarehouseDocuments"
      puts "=" * 60
    end
  end

  desc "Preview duplicate WarehouseDocuments without removing"
  task dedupe_preview: :environment do
    puts "=" * 60
    puts "WAREHOUSE DOCUMENT DUPLICATES PREVIEW"
    puts "=" * 60
    puts

    ActsAsTenant.without_tenant do
      duplicates = WarehouseDocument
        .group(:storage_blob_id, :folder)
        .having("COUNT(*) > 1")
        .count

      total_extra = 0

      duplicates.each do |(blob_id, folder), count|
        extra = count - 1
        total_extra += extra
        doc = WarehouseDocument.find_by(storage_blob_id: blob_id, folder: folder)
        puts "  #{doc&.display_name&.truncate(50)}"
        puts "    #{count} copies in #{folder} (would remove #{extra})"
        puts
      end

      puts "=" * 60
      puts "Total: #{duplicates.count} files with duplicates"
      puts "       #{total_extra} extra copies would be removed"
      puts "=" * 60
      puts
      puts "Run 'rails warehouse:dedupe' to remove duplicates"
    end
  end
end

# frozen_string_literal: true

namespace :warehouse do
  desc "Backfill download_name for all WarehouseDocuments where it is NULL"
  task backfill_download_names: :environment do
    resolver = SendNameResolver.new
    total = WarehouseDocument.where(download_name: nil).count
    updated = 0
    errors = 0

    puts "Backfilling download_name for #{total} warehouse documents..."

    WarehouseDocument.where(download_name: nil)
      .includes(:documentable, :storage_blob, :warehouse_folder_document_type, :linkable)
      .find_each(batch_size: 500) do |wd|
      begin
        # Clear download_name so SendNameResolver doesn't short-circuit
        wd.download_name = nil
        name = resolver.resolve(wd)
        if name.present? && name != "document"
          wd.update_column(:download_name, name)
          updated += 1
        end
      rescue => e
        errors += 1
      end
      print "\r  Backfilled #{updated}/#{total} (#{errors} errors)" if (updated + errors) % 100 == 0
    end

    puts "\nDone: #{updated} updated, #{errors} errors out of #{total}"
  end
end

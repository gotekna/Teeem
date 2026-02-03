# frozen_string_literal: true

# FRC (Feb 2026): Backfill warehouse_documents.folder with computed paths
#
# Root Cause: Documents created before WarehouseFolder templates were configured
# have incomplete folder paths (e.g., "Teeem Docs/Robert Harder" missing "/2026")
#
# This task recomputes folder paths from documentable.virtual_folder_path for all
# documents whose folder doesn't match the current template output.
#
# Usage:
#   rails warehouse:backfill_folders           # Dry run
#   rails warehouse:backfill_folders[execute]  # Actually update

namespace :warehouse do
  desc "Backfill warehouse_documents.folder with computed paths from templates"
  task :backfill_folders, [:mode] => :environment do |_t, args|
    dry_run = args[:mode] != "execute"

    puts "=" * 60
    puts "Backfilling warehouse_documents.folder paths"
    puts "Mode: #{dry_run ? 'DRY RUN' : 'EXECUTE'}"
    puts "=" * 60

    # Set tenant context (virtual_folder_path methods need WarehouseProvider.instance)
    tenant = Tenant.first
    unless tenant
      puts "ERROR: No tenant found"
      exit 1
    end
    ActsAsTenant.current_tenant = tenant
    puts "Using tenant: #{tenant.name || tenant.id}"

    stats = { updated: 0, skipped: 0, errors: 0, no_change: 0 }

    # Process each source_type separately
    source_types = WarehouseDocument.unscoped.distinct.pluck(:source_type).compact

    source_types.each do |source_type|
      puts "\n--- Processing source_type: #{source_type} ---"

      WarehouseDocument.unscoped
                       .where(source_type: source_type)
                       .find_each do |doc|
        begin
          current_folder = doc.read_attribute(:folder)

          # Try to load documentable (may fail if class was removed)
          documentable = begin
            doc.documentable
          rescue NameError => e
            # Class doesn't exist (e.g., JobDocument was removed)
            nil
          end

          # Compute new folder path
          new_folder = if documentable&.respond_to?(:virtual_folder_path)
                         documentable.virtual_folder_path
                       else
                         nil
                       end

          # Skip if documentable doesn't provide a path
          unless new_folder.present?
            stats[:skipped] += 1
            next
          end

          # Check if update needed
          if current_folder == new_folder
            stats[:no_change] += 1
            next
          end

          puts "  #{doc.id}: #{current_folder.inspect} => #{new_folder.inspect}"

          unless dry_run
            doc.update_column(:folder, new_folder)
          end

          stats[:updated] += 1
        rescue => e
          puts "  ERROR #{doc.id}: #{e.message}"
          stats[:errors] += 1
        end
      end
    end

    puts "\n" + "=" * 60
    puts "Summary:"
    puts "  Updated: #{stats[:updated]}"
    puts "  No change: #{stats[:no_change]}"
    puts "  Skipped (no virtual_folder_path): #{stats[:skipped]}"
    puts "  Errors: #{stats[:errors]}"
    puts "=" * 60

    if dry_run && stats[:updated] > 0
      puts "\nTo apply changes, run:"
      puts "  rails warehouse:backfill_folders[execute]"
    end
  end
end

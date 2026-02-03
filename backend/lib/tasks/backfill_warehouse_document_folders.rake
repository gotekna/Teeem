# frozen_string_literal: true

# FRC (Feb 2026): Backfill warehouse_documents.folder with computed paths
#
# ⚠️ DO NOT RUN - KNOWN ISSUES (Feb 2026)
# =========================================
# This task has critical flaws that cause data quality issues:
#
# 1. TENANT SCOPING: Documents span multiple tenants, but virtual_folder_path
#    requires tenant context. Cross-tenant user/contact lookups return nil,
#    causing paths like "Tasks/Unknown" instead of "Tasks/2236/Attachments".
#
# 2. INFORMATION LOSS: Many computed paths are LESS specific than stored paths:
#    - Task paths lose task IDs (e.g., "Tasks/2336/Attachments" → "Tasks/Unknown")
#    - User paths lose user names when tenant mismatch occurs
#
# 3. NOT NEEDED: The original issue (folders like [[Email Body]] appearing) was
#    fixed in warehouse_type_to_base_folder by filtering internal folders.
#    Existing document folder values are correct for when they were created.
#
# CONCLUSION: Historical documents have correct paths for their creation time.
# New documents get year-based paths from updated templates. No backfill needed.
# =========================================
#
# Original intent was to recompute folder paths from documentable.virtual_folder_path
# for all documents whose folder doesn't match the current template output.
#
# Usage (DRY RUN ONLY - execute mode disabled):
#   rails warehouse:backfill_folders           # Dry run to see what WOULD change

namespace :warehouse do
  desc "Backfill warehouse_documents.folder (DRY RUN ONLY - see file comments for why execute is disabled)"
  task :backfill_folders, [:mode] => :environment do |_t, args|
    dry_run = args[:mode] != "execute"

    # ⚠️ Safety: Block execute mode due to data quality issues
    unless dry_run
      puts "=" * 60
      puts "⚠️  EXECUTE MODE DISABLED"
      puts "=" * 60
      puts "This task has known issues that cause data quality problems."
      puts "See lib/tasks/backfill_warehouse_document_folders.rake for details."
      puts ""
      puts "TL;DR: Cross-tenant scoping causes 'Unknown' in paths,"
      puts "and some computed paths lose information vs stored paths."
      puts ""
      puts "Run dry run to see what WOULD change (won't actually change):"
      puts "  rails warehouse:backfill_folders"
      puts "=" * 60
      exit 1
    end

    puts "=" * 60
    puts "Backfilling warehouse_documents.folder paths"
    puts "Mode: DRY RUN (execute mode disabled)"
    puts "=" * 60

    # Set tenant context (virtual_folder_path methods need WarehouseProvider.instance)
    tenant = Tenant.first
    unless tenant
      puts "ERROR: No tenant found"
      exit 1
    end
    ActsAsTenant.current_tenant = tenant
    puts "Using tenant: #{tenant.name || tenant.id}"
    puts "⚠️  WARNING: Cross-tenant documents will show 'Unknown' due to scoping"

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

    if stats[:updated] > 0
      puts "\n⚠️  Execute mode is disabled (see file comments for why)."
      puts "Historical documents have correct paths for their creation time."
    end
  end
end

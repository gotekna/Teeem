# frozen_string_literal: true

# FRC Fix (Feb 2026): Warehouse tree was showing "No files" for all scopes
# because build_generic_folder_tree queried legacy `folder` column with wrong prefix.
# Fix: source_type scoping + folder_path column. This rake task:
# 1. Adds "user" to virtual_warehouses so tree renders from DB
# 2. Backfills folder_path for docs that don't have it yet

namespace :warehouse do
  desc "Fix warehouse tree: add user to virtual_warehouses + backfill folder_path"
  task fix_tree: :environment do
    puts "=== Warehouse Tree Fix ==="

    # Step 1: Add "user" to virtual_warehouses
    wp = WarehouseProvider.instance
    if wp
      vw = wp.virtual_warehouses || {}
      unless vw["user"] == true
        vw["user"] = true
        wp.update!(virtual_warehouses: vw)
        puts "[1/2] Added 'user' to virtual_warehouses"
      else
        puts "[1/2] 'user' already in virtual_warehouses"
      end
    else
      puts "[1/2] SKIP: No WarehouseProvider found"
    end

    # Step 2: Backfill folder_path for docs missing it
    missing = WarehouseDocument.where(folder_path: [nil, ""])
    total = missing.count
    puts "[2/2] Backfilling folder_path for #{total} documents..."

    if total > 0
      computer = WarehousePathComputer.new
      updated = 0
      errors = 0

      missing.find_each(batch_size: 500) do |doc|
        result = computer.compute(doc)
        if result[:folder_path].present?
          doc.update_columns(
            folder_path: result[:folder_path],
            warehouse_folder_id: result[:warehouse_folder_id],
            path_template_version: result[:path_template_version]
          )
          updated += 1
        end
      rescue => e
        errors += 1
        puts "  ERROR doc #{doc.id}: #{e.message}" if errors <= 10
      end

      puts "  Updated: #{updated}, Errors: #{errors}"
    end

    puts "=== Done ==="
  end
end

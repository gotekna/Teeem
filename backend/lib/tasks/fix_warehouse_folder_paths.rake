# frozen_string_literal: true

# FRC Fix (Feb 2026): Populate missing warehouse_folder.folder_path values
# Root cause: Initial data import didn't include folder_path values
# Pattern: WarehouseType.folder_path_template + "/" + display_name
#
# Usage:
#   rails warehouse:fix_folder_paths           # Dry-run (preview only)
#   rails warehouse:fix_folder_paths[execute]  # Actually update database

namespace :warehouse do
  desc "Fix missing folder_path values in warehouse_folders (dry-run by default)"
  task :fix_folder_paths, [:mode] => :environment do |_t, args|
    mode = args[:mode] || "dry_run"
    execute = mode == "execute"

    puts "=" * 70
    puts execute ? "EXECUTING: Updating warehouse_folder paths" : "DRY RUN: Preview of folder_path updates"
    puts "=" * 70
    puts ""

    # Cache warehouse_type templates
    wt_templates = {}
    WarehouseType.all.each do |wt|
      wt_templates[wt.code] = wt.folder_path_template
    end

    # Find folders missing folder_path
    missing = WarehouseFolder.where(folder_path: [nil, ""])
                             .where(warehouse_enabled: true)
                             .order(:warehouse_type, :parent_id, :order_position)

    if missing.empty?
      puts "All warehouse_folders have folder_path set"
      next
    end

    puts "Found #{missing.count} folders missing folder_path:"
    puts ""

    updated = 0
    skipped = 0
    errors = []

    missing.each do |wf|
      # Get the warehouse_type template
      wt_template = wt_templates[wf.warehouse_type]

      # Skip if no template (can't derive path)
      if wt_template.blank?
        puts "  SKIP: [#{wf.warehouse_type}] #{wf.display_name} - no warehouse_type template"
        skipped += 1
        next
      end

      # Skip internal/system folders with [[...]] syntax
      if wf.display_name&.start_with?("[[") || wf.tab_key&.start_with?("[[")
        puts "  SKIP: [#{wf.warehouse_type}] #{wf.display_name} - internal folder"
        skipped += 1
        next
      end

      # Build the folder_path
      # Pattern: warehouse_type_template + "/" + display_name
      # But if template already ends with display_name, just use template
      new_path = if wt_template.end_with?(wf.display_name)
                   wt_template
                 elsif wt_template.include?("{{")
                   # Template has tokens - append display_name after template
                   "#{wt_template}/#{wf.display_name}"
                 else
                   # Simple template (e.g., "Warehousing") - append display_name
                   "#{wt_template}/#{wf.display_name}"
                 end

      # Check if parent has a path we should inherit from
      if wf.parent_id.present? && wf.parent&.folder_path.present?
        # Child folder - inherit from parent + add own name
        new_path = "#{wf.parent.folder_path}/#{wf.display_name}"
      end

      puts "  #{execute ? 'UPDATE' : 'WOULD UPDATE'}: [#{wf.warehouse_type}] #{wf.display_name}"
      puts "    → #{new_path}"

      if execute
        begin
          wf.update_column(:folder_path, new_path)
          updated += 1
        rescue => e
          errors << { folder: wf, error: e.message }
          puts "    ERROR: #{e.message}"
        end
      else
        updated += 1
      end
    end

    puts ""
    puts "=" * 70
    puts "Summary:"
    puts "  #{execute ? 'Updated' : 'Would update'}: #{updated}"
    puts "  Skipped: #{skipped}"
    puts "  Errors: #{errors.count}" if errors.any?
    puts "=" * 70

    unless execute
      puts ""
      puts "This was a DRY RUN. To apply changes, run:"
      puts "  rails warehouse:fix_folder_paths[execute]"
    end
  end

  desc "Show folders still missing folder_path after fix"
  task verify_folder_paths: :environment do
    missing = WarehouseFolder.where(folder_path: [nil, ""])
                             .where(warehouse_enabled: true)

    if missing.empty?
      puts "All enabled warehouse_folders have folder_path set"
    else
      puts "Still missing folder_path (#{missing.count}):"
      missing.each do |wf|
        puts "  [#{wf.warehouse_type}] #{wf.display_name} (id: #{wf.id})"
      end
    end
  end
end

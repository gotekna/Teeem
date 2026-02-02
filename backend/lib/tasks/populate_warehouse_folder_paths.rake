# frozen_string_literal: true

namespace :warehouse do
  desc "Populate warehouse_folder column with computed full paths for all tabs"
  task populate_folder_paths: :environment do
    puts "=" * 60
    puts "Populating warehouse_folder paths for all tabs"
    puts "=" * 60

    total_updated = 0
    total_skipped = 0
    total_errors = 0

    # Process each tenant
    Tenant.find_each do |tenant|
      puts "\n" + "=" * 60
      puts "TENANT: #{tenant.id} - #{tenant.name}"
      puts "=" * 60

      ActsAsTenant.with_tenant(tenant) do
        updated_count = 0
        skipped_count = 0
        error_count = 0

        # Get the warehouse_folders templates from WarehouseProvider
        provider = WarehouseProvider.for_tenant(tenant)
        templates = provider&.warehouse_folders || {}

        if templates.empty?
          puts "  ⚠️  No warehouse_folders templates found, skipping tenant"
          next
        end

        puts "\nWarehouse type templates:"
        templates.each { |k, v| puts "  #{k}: #{v}" }
        puts ""

        # Process each warehouse type
        WarehouseFolder::WAREHOUSE_TYPES.each do |warehouse_type|
          puts "\n--- Processing #{warehouse_type} ---"

          base_template = templates[warehouse_type]
          unless base_template
            puts "  ⚠️  No template found for #{warehouse_type}, skipping"
            next
          end

          # Get all tabs for this warehouse type, ordered by hierarchy
          tabs = WarehouseFolder.where(warehouse_type: warehouse_type)
                                .includes(:parent)
                                .order(:parent_id, :order_position)

          tabs.each do |tab|
            begin
              # Skip if already has a custom warehouse_folder
              existing = tab.read_attribute(:warehouse_folder)
              if existing.present?
                puts "  ⏭️  #{tab.display_name} - already has path: #{existing}"
                skipped_count += 1
                next
              end

              # Compute the full path
              full_path = compute_full_path(tab, base_template)

              if full_path.present?
                tab.update_column(:warehouse_folder, full_path)
                puts "  ✅ #{tab.display_name} → #{full_path}"
                updated_count += 1
              else
                puts "  ⚠️  #{tab.display_name} - could not compute path"
                skipped_count += 1
              end
            rescue => e
              puts "  ❌ #{tab.display_name} - ERROR: #{e.message}"
              error_count += 1
            end
          end
        end

        puts "\nTenant Summary:"
        puts "  Updated: #{updated_count}"
        puts "  Skipped: #{skipped_count}"
        puts "  Errors: #{error_count}"

        total_updated += updated_count
        total_skipped += skipped_count
        total_errors += error_count
      end
    end

    puts "\n" + "=" * 60
    puts "TOTAL Summary:"
    puts "  Updated: #{total_updated}"
    puts "  Skipped (already set): #{total_skipped}"
    puts "  Errors: #{total_errors}"
    puts "=" * 60
  end

  private

  # Compute the full path for a tab based on its hierarchy
  def compute_full_path(tab, base_template)
    # Build the path from parent hierarchy
    hierarchy = []
    current = tab

    # Walk up the parent chain to build hierarchy
    while current
      hierarchy.unshift(current.display_name)
      current = current.parent
    end

    # The base template typically ends with {{TabName}} or similar
    # We need to replace that with the actual hierarchy

    # Extract the base path (everything before the last placeholder like {{TabName}})
    # e.g., "Corporate/{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}" -> "Corporate/{{CompanyGroup}}/{{CompanyCode}}"
    base_path = base_template.gsub(/\/\{\{TabName\}\}$/, '')
                             .gsub(/\/\{\{[^}]+\}\}$/, '') # Remove any trailing placeholder

    # For root tabs, just use base_path + tab name
    # For nested tabs, use base_path + full hierarchy
    if hierarchy.length == 1
      # Root tab - use template as-is but replace {{TabName}} with display_name
      base_template.gsub(/\{\{TabName\}\}/, tab.display_name)
    else
      # Nested tab - build full path from hierarchy
      # Start with base (without the TabName placeholder)
      [base_path, *hierarchy].join('/').gsub(/\/+/, '/')
    end
  end
end

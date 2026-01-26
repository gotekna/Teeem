# frozen_string_literal: true

# Fix Warehouse entity tabs to have correct folder names and templates
# Run: rails fix_warehouse_tabs:update

namespace :fix_warehouse_tabs do
  desc "Update Warehouse entity tabs with correct folder names and templates"
  task update: :environment do
    puts "Fixing Warehouse entity tabs..."

    # Get all warehouse-type entity tabs
    warehouse_tabs = EntityTab.where(warehouse_type: 'warehouse').where(warehouse_enabled: true)

    puts "Found #{warehouse_tabs.count} warehouse tabs"

    updated = 0
    warehouse_tabs.find_each do |tab|
      # The folder name should be the tab's display_name
      # Set send_name_template to use original filename if not already set
      changes = {}

      if tab.send_name_template.blank?
        changes[:send_name_template] = '{{OriginalFileName}}'
      end

      if changes.any?
        tab.update!(changes)
        updated += 1
        puts "  Updated: #{tab.display_name} (id: #{tab.id})"
      else
        puts "  Skipped: #{tab.display_name} (already configured)"
      end
    end

    puts "\nDone! Updated #{updated} tabs."
  end

  desc "Show current Warehouse entity tab configuration"
  task show: :environment do
    puts "Current Warehouse entity tabs:\n\n"

    warehouse_tabs = EntityTab.where(warehouse_type: 'warehouse').where(warehouse_enabled: true).order(:order_position)

    warehouse_tabs.each do |tab|
      puts "#{tab.display_name} (id: #{tab.id})"
      puts "  warehouse_folder: #{tab.warehouse_folder || '(derived)'}"
      puts "  send_name_template: #{tab.send_name_template || '(not set)'}"
      puts ""
    end

    puts "Total: #{warehouse_tabs.count} tabs"
  end
end

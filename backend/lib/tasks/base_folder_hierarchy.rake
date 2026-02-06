# frozen_string_literal: true

namespace :warehouse_folders do
  desc "Sync parent-child hierarchy from warehouse_folders to warehouse_folders"
  task sync_hierarchy: :environment do
    puts "=" * 60
    puts "Syncing parent-child hierarchy from warehouse_folders to warehouse_folders"
    puts "=" * 60

    # Find all warehouse_folders that have a parent_id set
    child_folders = WarehouseFolder.where.not(parent_id: nil).includes(:parent)

    puts "\nFound #{child_folders.count} warehouse_folders with parent relationships"

    updated_count = 0
    skipped_count = 0
    error_count = 0

    # Group by warehouse_type for cleaner output
    child_folders.group_by(&:warehouse_type).each do |warehouse_type, folders|
      puts "\n[#{warehouse_type.upcase}] Processing #{folders.count} child folders..."

      folders.each do |child_wf|
        parent_wf = child_wf.parent
        next unless parent_wf

        # Find corresponding warehouse_folders by matching tab_key or display_name
        child_bf = WarehouseFolder.joins(:warehouse_type)
                            .where(warehouse_types: { code: warehouse_type })
                            .where("warehouse_folders.name ILIKE ? OR warehouse_folders.name ILIKE ?",
                                   child_wf.tab_key, child_wf.display_name)
                            .first

        parent_bf = WarehouseFolder.joins(:warehouse_type)
                             .where(warehouse_types: { code: warehouse_type })
                             .where("warehouse_folders.name ILIKE ? OR warehouse_folders.name ILIKE ?",
                                    parent_wf.tab_key, parent_wf.display_name)
                             .first

        if child_bf.nil?
          puts "  ⚠️  No warehouse_folder found for child: #{child_wf.display_name} (#{child_wf.tab_key})"
          skipped_count += 1
          next
        end

        if parent_bf.nil?
          puts "  ⚠️  No warehouse_folder found for parent: #{parent_wf.display_name} (#{parent_wf.tab_key})"
          skipped_count += 1
          next
        end

        if child_bf.parent_id == parent_bf.id
          puts "  ✓ Already set: #{child_bf.name} → #{parent_bf.name}"
          skipped_count += 1
          next
        end

        # Update the parent_id
        begin
          child_bf.update!(parent_id: parent_bf.id)
          puts "  ✅ Updated: #{child_bf.name} → #{parent_bf.name}"
          updated_count += 1
        rescue => e
          puts "  ❌ Error updating #{child_bf.name}: #{e.message}"
          error_count += 1
        end
      end
    end

    puts "\n" + "=" * 60
    puts "SUMMARY"
    puts "=" * 60
    puts "Updated: #{updated_count}"
    puts "Skipped: #{skipped_count}"
    puts "Errors:  #{error_count}"
    puts "=" * 60

    # Show final hierarchy
    puts "\nFinal warehouse_folder hierarchy:"
    WarehouseType.includes(warehouse_folders: :children).order(:display_name).each do |wt|
      root_folders = wt.warehouse_folders.where(parent_id: nil).order(:name)
      next if root_folders.empty?

      puts "\n[#{wt.display_name}]"
      root_folders.each do |bf|
        print_folder_tree(bf, 1)
      end
    end
  end

  desc "Show current warehouse_folder hierarchy"
  task show_hierarchy: :environment do
    puts "Current warehouse_folder hierarchy:"
    puts "=" * 60

    WarehouseType.includes(warehouse_folders: :children).order(:display_name).each do |wt|
      root_folders = wt.warehouse_folders.where(parent_id: nil).order(:name)
      next if root_folders.empty?

      puts "\n[#{wt.display_name}] (#{wt.warehouse_folders.count} folders)"
      root_folders.each do |bf|
        print_folder_tree(bf, 1)
      end
    end
  end

  desc "Clear all parent-child relationships from warehouse_folders"
  task clear_hierarchy: :environment do
    count = WarehouseFolder.where.not(parent_id: nil).count
    if count == 0
      puts "No parent-child relationships to clear."
      return
    end

    print "This will clear #{count} parent-child relationships. Continue? (y/N): "
    response = STDIN.gets.chomp.downcase

    if response == 'y'
      WarehouseFolder.update_all(parent_id: nil)
      puts "✅ Cleared all parent-child relationships."
    else
      puts "Cancelled."
    end
  end

  def print_folder_tree(folder, depth)
    indent = "  " * depth
    children_count = folder.children.count
    suffix = children_count > 0 ? " (#{children_count} sub-folders)" : ""
    puts "#{indent}├── #{folder.name}#{suffix}"

    folder.children.order(:name).each do |child|
      print_folder_tree(child, depth + 1)
    end
  end

  desc "Create missing warehouse_folders from warehouse_folders hierarchy"
  task create_missing: :environment do
    puts "=" * 60
    puts "Creating missing warehouse_folders from warehouse_folders"
    puts "=" * 60

    created_count = 0
    skipped_count = 0
    error_count = 0

    # Process each warehouse_folder that has a parent
    WarehouseFolder.where.not(parent_id: nil).includes(:parent).each do |child_wf|
      parent_wf = child_wf.parent
      next unless parent_wf

      wt = WarehouseType.find_by(code: child_wf.warehouse_type)
      next unless wt

      # Check if warehouse_folder already exists for this child
      child_bf = WarehouseFolder.where(warehouse_type: wt)
                          .where("name ILIKE ?", child_wf.display_name)
                          .first

      if child_bf
        skipped_count += 1
        next
      end

      # Find parent warehouse_folder
      parent_bf = WarehouseFolder.where(warehouse_type: wt)
                           .where("name ILIKE ?", parent_wf.display_name)
                           .first

      unless parent_bf
        puts "  ⚠️  No parent warehouse_folder for: #{parent_wf.display_name} → #{child_wf.display_name}"
        skipped_count += 1
        next
      end

      # Create the missing warehouse_folder
      begin
        new_bf = WarehouseFolder.create!(
          warehouse_type: wt,
          parent_id: parent_bf.id,
          name: child_wf.display_name,
          folder_path_template: child_wf.display_name, # Relative path, will be combined with parent
          enabled: true,
          is_system: false,
          order_position: child_wf.order_position || 0
        )
        puts "  ✅ Created: #{parent_bf.name} → #{new_bf.name}"
        created_count += 1
      rescue => e
        puts "  ❌ Error creating #{child_wf.display_name}: #{e.message}"
        error_count += 1
      end
    end

    puts "\n" + "=" * 60
    puts "SUMMARY"
    puts "=" * 60
    puts "Created: #{created_count}"
    puts "Skipped: #{skipped_count}"
    puts "Errors:  #{error_count}"
    puts "=" * 60

    # Now sync hierarchy for newly created folders
    if created_count > 0
      puts "\nSyncing hierarchy for newly created folders..."
      Rake::Task['warehouse_folders:sync_hierarchy'].invoke
    end
  end

  desc "Full sync: create missing warehouse_folders then sync hierarchy"
  task full_sync: :environment do
    Rake::Task['warehouse_folders:create_missing'].invoke
  end
end

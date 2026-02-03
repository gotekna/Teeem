# SSoT (Feb 2026): warehouse_folders table is THE ONE source of truth
# All path templates are stored in warehouse_folders.warehouse_folder column
# NO hardcoded defaults - to create new tenant, copy warehouse_folders from existing tenant

namespace :sync_storage_config do
  desc "Show current warehouse folder paths from database (SSoT)"
  task show: :environment do
    puts "SSoT: warehouse_folders table is THE ONE source of truth"
    puts "\nWarehouse folder paths by type:"

    WarehouseFolder.distinct.pluck(:warehouse_type).sort.each do |warehouse_type|
      folder = WarehouseFolder.find_by(warehouse_type: warehouse_type, parent_id: nil)
      folder ||= WarehouseFolder.where(warehouse_type: warehouse_type).order(:id).first
      path = folder&.warehouse_folder || "(not set)"
      puts "  #{warehouse_type}: #{path}"
    end
  end

  desc "Copy warehouse_folders from one tenant to another (for new tenant setup)"
  task :copy_to_tenant, [:source_tenant_id, :target_tenant_id] => :environment do |_, args|
    source_id = args[:source_tenant_id]&.to_i
    target_id = args[:target_tenant_id]&.to_i

    unless source_id && target_id
      puts "Usage: rails sync_storage_config:copy_to_tenant[source_tenant_id,target_tenant_id]"
      exit 1
    end

    source_folders = WarehouseFolder.where(tenant_id: [source_id, nil])
    puts "Copying #{source_folders.count} warehouse_folders from tenant #{source_id} to #{target_id}..."

    copied = 0
    source_folders.find_each do |folder|
      next if WarehouseFolder.exists?(tenant_id: target_id, warehouse_type: folder.warehouse_type, tab_key: folder.tab_key)

      new_folder = folder.dup
      new_folder.tenant_id = target_id
      new_folder.save!
      copied += 1
    end

    puts "Copied #{copied} warehouse_folders to tenant #{target_id}"
  end
end

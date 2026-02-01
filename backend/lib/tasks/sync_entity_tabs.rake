namespace :sync do
  desc "Sync EntityTabs and linkings from JSON file"
  task entity_tabs: :environment do
    require 'json'

    file_path = Rails.root.join('tmp', 'entity_tabs_export.json')
    unless File.exist?(file_path)
      puts "Error: #{file_path} not found"
      exit 1
    end

    data = JSON.parse(File.read(file_path))
    tabs_data = data['tabs']
    linkings_data = data['linkings']

    puts "Syncing #{tabs_data.count} tabs and #{linkings_data.count} linkings..."

    # First pass: Create all tabs without parents
    created = 0
    updated = 0
    tabs_data.each do |t|
      tab = EntityTab.find_or_initialize_by(scope: t['scope'], tab_key: t['tab_key'])
      was_new = tab.new_record?

      tab.assign_attributes(
        display_name: t['display_name'],
        description: t['description'],
        tab_group: t['tab_group'],
        order_position: t['order_position'],
        enabled: t['enabled'],
        icon_name: t['icon_name'],
        component_name: t['component_name'],
        warehouse_enabled: t['warehouse_enabled'] || t['has_storage_folder'] || t['has_sharepoint_folder'],
        storage_folder_path: t['storage_folder_path'] || t['sharepoint_folder_path'],
        is_system_tab: t['is_system_tab'],
        entity_filters: t['entity_filters'] || []
      )
      tab.save!

      was_new ? created += 1 : updated += 1
    end
    puts "Created #{created} tabs, updated #{updated} tabs"

    # Second pass: Set parent relationships
    parents_set = 0
    tabs_data.each do |t|
      next unless t['parent_key'] && t['parent_scope']

      tab = EntityTab.find_by(scope: t['scope'], tab_key: t['tab_key'])
      parent = EntityTab.find_by(scope: t['parent_scope'], tab_key: t['parent_key'])

      if tab && parent && tab.parent_id != parent.id
        tab.update!(parent_id: parent.id)
        parents_set += 1
      end
    end
    puts "Set #{parents_set} parent relationships"

    # Sync document type linkings
    linkings_created = 0
    linkings_data.each do |l|
      tab = EntityTab.find_by(scope: l['tab_scope'], tab_key: l['tab_key'])
      doc_type = DocumentType.find_by(name: l['doc_type_name'])

      next unless tab && doc_type

      linking = EntityTabDocumentType.find_or_initialize_by(
        entity_tab_id: tab.id,
        document_type_id: doc_type.id
      )

      if linking.new_record?
        linking.is_primary = l['is_primary']
        linking.save!
        linkings_created += 1
      end
    end
    puts "Created #{linkings_created} document type linkings"

    puts "Done!"
  end
end

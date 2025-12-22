class MigrateXeroTabsToEntityTabs < ActiveRecord::Migration[8.0]
  # Phase 2: Migrate XeroFeatureTab to EntityTab (scope: xero)
  # This completes the SSoT unification for Xero tabs

  def up
    # First pass: Create all EntityTab records without parent relationships
    XeroFeatureTab.find_each do |xero_tab|
      EntityTab.create!(
        scope: 'xero',
        tab_key: xero_tab.tab_key,
        display_name: xero_tab.display_name,
        description: xero_tab.description,
        tab_group: xero_tab.tab_group || 'overview',
        order_position: xero_tab.order_position || 0,
        enabled: xero_tab.enabled.nil? ? true : xero_tab.enabled,
        icon_name: xero_tab.icon_name,
        component_name: xero_tab.component_name,
        has_sharepoint_folder: xero_tab.document_folder_id.present?,
        is_system_tab: true  # Xero tabs are system tabs
      )
    end

    # Second pass: Set up parent relationships using parent_key
    XeroFeatureTab.where.not(parent_key: nil).find_each do |xero_tab|
      child = EntityTab.find_by(scope: 'xero', tab_key: xero_tab.tab_key)
      parent = EntityTab.find_by(scope: 'xero', tab_key: xero_tab.parent_key)

      if child && parent
        child.update!(parent_id: parent.id)
      end
    end

    puts "Migrated #{EntityTab.where(scope: 'xero').count} Xero tabs to EntityTab"
  end

  def down
    EntityTab.where(scope: 'xero').destroy_all
  end
end

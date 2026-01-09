# Migrate data from old tab tables to unified EntityTab
# This preserves all customizations while consolidating to SSoT
class MigrateToEntityTabs < ActiveRecord::Migration[8.0]
  def up
    # Track old_id -> new_id mappings for parent relationships
    @document_folder_mapping = {}
    @xero_tab_mapping = {}

    # 1. Sync CorporateEntityTab customizations to EntityTab
    migrate_corporate_entity_tabs

    # 2. Migrate DocumentFolder hierarchy
    migrate_document_folders

    # 3. Migrate JobTab
    migrate_job_tabs

    # 4. Migrate XeroFeatureTab
    migrate_xero_feature_tabs

    # 5. Migrate DocumentTypeFolder join table
    migrate_document_type_folders

    # Log results
    puts "[MigrateToEntityTabs] Migration complete:"
    puts "  EntityTab total: #{EntityTab.count}"
    puts "  EntityTabDocumentType total: #{EntityTabDocumentType.count}"
  end

  def down
    # This migration copies data - rollback just removes migrated records
    # Keep system tabs, remove any that came from migration
    EntityTab.where.not(is_system_tab: true).destroy_all
    EntityTabDocumentType.destroy_all
  end

  private

  def migrate_corporate_entity_tabs
    puts "[MigrateToEntityTabs] Syncing CorporateEntityTab customizations..."

    CorporateEntityTab.find_each do |old|
      # Find existing seeded tab
      existing = EntityTab.find_by(scope: 'corporate_entity', tab_key: old.tab_key)

      if existing
        # Update with any customizations
        existing.update!(
          display_name: old.display_name,
          description: old.description,
          tab_group: old.tab_group,
          entity_filters: old.entity_types || [],
          order_position: old.order_position,
          enabled: old.enabled,
          icon_name: old.icon_name,
          component_name: old.component_name,
          has_sharepoint_folder: old.has_sharepoint_folder || false,
          sharepoint_folder_path: old.sharepoint_folder_path
        )
      else
        # Create new tab (custom tab that wasn't seeded)
        EntityTab.create!(
          scope: 'corporate_entity',
          tab_key: old.tab_key,
          display_name: old.display_name,
          description: old.description,
          tab_group: old.tab_group,
          entity_filters: old.entity_types || [],
          order_position: old.order_position,
          enabled: old.enabled,
          icon_name: old.icon_name,
          component_name: old.component_name,
          has_sharepoint_folder: old.has_sharepoint_folder || false,
          sharepoint_folder_path: old.sharepoint_folder_path,
          is_system_tab: false  # Custom tabs are not system tabs
        )
      end
    end
  end

  def migrate_document_folders
    puts "[MigrateToEntityTabs] Migrating DocumentFolder hierarchy..."

    # First pass: create all folders without parent relationships
    DocumentFolder.where(parent_id: nil).find_each do |old|
      tab_key = old.name.downcase.gsub(/\s+/, '-')

      # Check if already exists (from seeding)
      existing = EntityTab.find_by(scope: 'document', tab_key: tab_key)

      if existing
        # Update existing
        existing.update!(
          display_name: old.name,
          description: old.description,
          order_position: old.order_position,
          entity_filters: old.entity_types || [],
          enabled: old.active,
          has_sharepoint_folder: true,
          sharepoint_folder_path: old.sharepoint_path || old.name.upcase
        )
        @document_folder_mapping[old.id] = existing.id
      else
        # Create new
        new_tab = EntityTab.create!(
          scope: 'document',
          tab_key: tab_key,
          display_name: old.name,
          description: old.description,
          tab_group: 'documents',
          order_position: old.order_position,
          entity_filters: old.entity_types || [],
          enabled: old.active,
          has_sharepoint_folder: true,
          sharepoint_folder_path: old.sharepoint_path || old.name.upcase,
          is_system_tab: false
        )
        @document_folder_mapping[old.id] = new_tab.id
      end
    end

    # Second pass: create child folders with parent relationships
    DocumentFolder.where.not(parent_id: nil).find_each do |old|
      tab_key = old.name.downcase.gsub(/\s+/, '-')
      parent_entity_tab_id = @document_folder_mapping[old.parent_id]

      new_tab = EntityTab.create!(
        scope: 'document',
        tab_key: tab_key,
        display_name: old.name,
        description: old.description,
        tab_group: 'documents',
        parent_id: parent_entity_tab_id,
        order_position: old.order_position,
        entity_filters: old.entity_types || [],
        enabled: old.active,
        has_sharepoint_folder: true,
        sharepoint_folder_path: old.sharepoint_path || old.name.upcase,
        is_system_tab: false
      )
      @document_folder_mapping[old.id] = new_tab.id
    end
  end

  def migrate_job_tabs
    puts "[MigrateToEntityTabs] Migrating JobTab..."

    JobTab.find_each do |old|
      tab_key = old.slug || old.name.downcase.gsub(/\s+/, '-')

      # Check if already exists
      existing = EntityTab.find_by(scope: 'job', tab_key: tab_key)

      if existing
        # Update with customizations
        existing.update!(
          display_name: old.name,
          icon_name: old.icon,
          order_position: old.position,
          enabled: old.is_active
        )
      else
        # Create new
        EntityTab.create!(
          scope: 'job',
          tab_key: tab_key,
          display_name: old.name,
          icon_name: old.icon,
          order_position: old.position,
          enabled: old.is_active,
          is_system_tab: false
        )
      end
    end
  end

  def migrate_xero_feature_tabs
    puts "[MigrateToEntityTabs] Migrating XeroFeatureTab..."

    # Map Xero tab_groups to our standard groups
    # reports -> data, setup -> special, data -> data
    group_mapping = {
      'reports' => 'data',
      'setup' => 'special',
      'data' => 'data'
    }

    XeroFeatureTab.find_each do |old|
      # Skip if parent_key is set - we'll handle hierarchy separately
      next if old.parent_key.present?

      mapped_group = group_mapping[old.tab_group] || 'special'

      new_tab = EntityTab.create!(
        scope: 'xero',
        tab_key: old.tab_key,
        display_name: old.display_name,
        description: old.description,
        tab_group: mapped_group,
        order_position: old.order_position,
        enabled: old.enabled && (old.visible != false),
        icon_name: old.icon_name,
        component_name: old.component_name,
        has_sharepoint_folder: old.document_folder_id.present?,
        sharepoint_folder_path: old.document_folder_id ? DocumentFolder.find_by(id: old.document_folder_id)&.sharepoint_path : nil,
        is_system_tab: true  # Xero tabs are system tabs
      )
      @xero_tab_mapping[old.tab_key] = new_tab.id
    end

    # Second pass: handle child tabs
    XeroFeatureTab.where.not(parent_key: nil).find_each do |old|
      parent_id = @xero_tab_mapping[old.parent_key]
      mapped_group = group_mapping[old.tab_group] || 'special'

      EntityTab.create!(
        scope: 'xero',
        tab_key: old.tab_key,
        display_name: old.display_name,
        description: old.description,
        tab_group: mapped_group,
        parent_id: parent_id,
        order_position: old.order_position,
        enabled: old.enabled && (old.visible != false),
        icon_name: old.icon_name,
        component_name: old.component_name,
        has_sharepoint_folder: old.document_folder_id.present?,
        sharepoint_folder_path: old.document_folder_id ? DocumentFolder.find_by(id: old.document_folder_id)&.sharepoint_path : nil,
        is_system_tab: true
      )
    end
  end

  def migrate_document_type_folders
    puts "[MigrateToEntityTabs] Migrating DocumentTypeFolder join table..."

    # Get all document type folder associations
    if ActiveRecord::Base.connection.table_exists?(:document_type_folders)
      ActiveRecord::Base.connection.execute("SELECT * FROM document_type_folders").each do |row|
        document_type_id = row['document_type_id']
        document_folder_id = row['document_folder_id']

        # Find the new entity_tab_id
        entity_tab_id = @document_folder_mapping[document_folder_id]

        next unless entity_tab_id && document_type_id

        # Check if already exists
        existing = EntityTabDocumentType.find_by(
          entity_tab_id: entity_tab_id,
          document_type_id: document_type_id
        )

        unless existing
          EntityTabDocumentType.create!(
            entity_tab_id: entity_tab_id,
            document_type_id: document_type_id,
            is_primary: false  # We'll set primary separately if needed
          )
        end
      end
    end

    # Also link document types based on their primary_tab field
    DocumentType.where.not(primary_tab: nil).find_each do |dt|
      # Find the entity tab matching the primary_tab
      tab_key = dt.primary_tab.downcase.gsub(/\s+/, '-')
      entity_tab = EntityTab.find_by(scope: 'document', tab_key: tab_key) ||
                   EntityTab.find_by(scope: 'corporate_entity', tab_key: tab_key)

      next unless entity_tab

      # Find or create the link and mark as primary
      link = EntityTabDocumentType.find_or_create_by!(
        entity_tab_id: entity_tab.id,
        document_type_id: dt.id
      )
      link.update!(is_primary: true)
    end
  end
end

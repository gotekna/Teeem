# frozen_string_literal: true

# Migration: Migrate data from warehouse_folders to base_folders
#
# Part of "Eliminate warehouse_folders, Make base_folders Tenant-Specific" refactor.
#
# This migration:
# 1. Copies all warehouse_folder records to base_folders with tenant scoping
# 2. Migrates warehouse_folder_document_types to base_folder_document_types
# 3. Extracts folder segments from full paths
#
# BIG BANG approach: No fallbacks, no hardcoding. Everything computed from SSoT.
#
class MigrateWarehouseFoldersToBaseFolders < ActiveRecord::Migration[7.2]
  def up
    Rails.logger.info "[Migration] Starting warehouse_folders → base_folders migration"

    # Step 1: For each warehouse_folder, create or update corresponding base_folder
    migrate_warehouse_folders_to_base_folders

    # Step 2: Migrate document type links
    migrate_document_type_links

    # Step 3: Set tenant_id on warehouse_types (copy from warehouse_folders)
    set_warehouse_types_tenant

    Rails.logger.info "[Migration] Migration complete"
  end

  def down
    # Clear migrated data (but don't drop tables - that's a separate migration)
    Rails.logger.info "[Migration] Rolling back warehouse_folders → base_folders migration"

    # Remove the migrated base_folder_document_types
    execute "DELETE FROM base_folder_document_types WHERE id > 0"

    # Clear UI columns on base_folders (set to NULL)
    execute <<-SQL
      UPDATE base_folders SET
        tenant_id = NULL,
        folder_path_suffix = NULL,
        tab_key = NULL,
        display_name = NULL,
        display_code = NULL,
        description = NULL,
        tab_group = 'documents',
        icon_name = NULL,
        display_mode = 'both',
        hidden_by_default = false,
        component_name = NULL,
        warehouse_enabled = true,
        is_photo_category = false,
        is_cad_category = false,
        visibility_rule = NULL,
        xero_scope = NULL,
        entity_filters = '{}',
        warehouse_type_override = NULL,
        ui_name_template = NULL,
        download_name_template = NULL,
        uses_custom_path = false,
        is_system_tab = false
    SQL

    # Clear tenant_id from warehouse_types
    execute "UPDATE warehouse_types SET tenant_id = NULL"
  end

  private

  def migrate_warehouse_folders_to_base_folders
    Rails.logger.info "[Migration] Migrating warehouse_folders to base_folders..."

    # Get all warehouse_folders grouped by warehouse_type
    wf_records = execute(<<-SQL)
      SELECT
        wf.id,
        wf.warehouse_type,
        wf.tab_key,
        wf.display_name,
        wf.display_code,
        wf.description,
        wf.tab_group,
        wf.parent_id,
        wf.entity_filters,
        wf.order_position,
        wf.enabled,
        wf.icon_name,
        wf.component_name,
        wf.is_system_tab,
        wf.warehouse_enabled,
        wf.uses_custom_path,
        wf.warehouse_type_override,
        wf.is_photo_category,
        wf.display_mode,
        wf.hidden_by_default,
        wf.is_cad_category,
        wf.xero_scope,
        wf.visibility_rule,
        wf.tenant_id,
        wf.download_name,
        wf.folder_path,
        wf.ui_name,
        wf.base_folder_id
      FROM warehouse_folders wf
      ORDER BY wf.warehouse_type, wf.parent_id NULLS FIRST, wf.order_position
    SQL

    # Build parent mapping (warehouse_folder_id -> base_folder_id)
    wf_to_bf_id = {}

    wf_records.each do |wf|
      # Find or create base_folder for this warehouse_folder
      warehouse_type_id = find_warehouse_type_id(wf['warehouse_type'])
      next unless warehouse_type_id

      # Determine parent_id in base_folders
      bf_parent_id = wf['parent_id'] ? wf_to_bf_id[wf['parent_id'].to_i] : nil

      # Extract folder segment from display_name (the folder's own name, not full path)
      folder_segment = wf['display_name']

      # Extract suffix: if folder_path has dynamic tokens beyond the display_name
      folder_path = wf['folder_path'].to_s
      folder_path_suffix = extract_suffix(folder_path, folder_segment)

      # Check if base_folder already exists (by name and warehouse_type)
      existing_bf = find_existing_base_folder(warehouse_type_id, wf['display_name'])

      if existing_bf
        # Update existing base_folder with warehouse_folder data
        update_base_folder(existing_bf['id'].to_i, wf, bf_parent_id, folder_segment, folder_path_suffix)
        wf_to_bf_id[wf['id'].to_i] = existing_bf['id'].to_i
      else
        # Create new base_folder
        new_bf_id = create_base_folder(wf, warehouse_type_id, bf_parent_id, folder_segment, folder_path_suffix)
        wf_to_bf_id[wf['id'].to_i] = new_bf_id if new_bf_id
      end
    end

    Rails.logger.info "[Migration] Migrated #{wf_to_bf_id.size} warehouse_folders to base_folders"
    @wf_to_bf_mapping = wf_to_bf_id
  end

  def find_warehouse_type_id(warehouse_type_code)
    result = execute("SELECT id FROM warehouse_types WHERE code = '#{warehouse_type_code}' LIMIT 1")
    result.first&.fetch('id', nil)&.to_i
  end

  def find_existing_base_folder(warehouse_type_id, name)
    result = execute(<<-SQL)
      SELECT id FROM base_folders
      WHERE warehouse_type_id = #{warehouse_type_id}
        AND name = #{quote(name)}
      LIMIT 1
    SQL
    result.first
  end

  def extract_suffix(folder_path, display_name)
    return nil if folder_path.blank?

    # If folder_path contains tokens after display_name, extract them as suffix
    # e.g., "Job/{{JobCode}}/Photo/{{Date}}" with display_name "Photo" -> suffix "{{Date}}"
    parts = folder_path.split('/')
    display_idx = parts.find_index(display_name)

    return nil unless display_idx && display_idx < parts.length - 1

    # Everything after display_name is suffix
    suffix_parts = parts[(display_idx + 1)..]
    suffix = suffix_parts.join('/') if suffix_parts.any?

    # Only return if suffix has dynamic tokens
    suffix if suffix&.include?('{{')
  end

  def update_base_folder(bf_id, wf, parent_id, folder_segment, folder_path_suffix)
    execute(<<-SQL)
      UPDATE base_folders SET
        tenant_id = #{wf['tenant_id'] || 'NULL'},
        folder_segment = #{quote(folder_segment)},
        folder_path_suffix = #{folder_path_suffix ? quote(folder_path_suffix) : 'NULL'},
        parent_id = #{parent_id || 'NULL'},
        tab_key = #{quote(wf['tab_key'])},
        display_name = #{quote(wf['display_name'])},
        display_code = #{wf['display_code'] ? quote(wf['display_code']) : 'NULL'},
        description = #{wf['description'] ? quote(wf['description']) : 'NULL'},
        tab_group = #{quote(wf['tab_group'] || 'documents')},
        icon_name = #{wf['icon_name'] ? quote(wf['icon_name']) : 'NULL'},
        display_mode = #{quote(wf['display_mode'] || 'both')},
        hidden_by_default = #{wf['hidden_by_default'] || false},
        component_name = #{wf['component_name'] ? quote(wf['component_name']) : 'NULL'},
        warehouse_enabled = #{wf['warehouse_enabled'].nil? ? true : wf['warehouse_enabled']},
        is_photo_category = #{wf['is_photo_category'] || false},
        is_cad_category = #{wf['is_cad_category'] || false},
        visibility_rule = #{wf['visibility_rule'] ? quote(wf['visibility_rule']) : 'NULL'},
        xero_scope = #{wf['xero_scope'] ? quote(wf['xero_scope']) : 'NULL'},
        entity_filters = #{quote(wf['entity_filters'] || '{}')},
        warehouse_type_override = #{wf['warehouse_type_override'] ? quote(wf['warehouse_type_override']) : 'NULL'},
        ui_name_template = #{wf['ui_name'] ? quote(wf['ui_name']) : 'NULL'},
        download_name_template = #{wf['download_name'] ? quote(wf['download_name']) : 'NULL'},
        uses_custom_path = #{wf['uses_custom_path'] || false},
        is_system_tab = #{wf['is_system_tab'] || false},
        order_position = #{wf['order_position'] || 0},
        enabled = #{wf['enabled'].nil? ? true : wf['enabled']},
        updated_at = NOW()
      WHERE id = #{bf_id}
    SQL
  end

  def create_base_folder(wf, warehouse_type_id, parent_id, folder_segment, folder_path_suffix)
    result = execute(<<-SQL)
      INSERT INTO base_folders (
        warehouse_type_id, name, tenant_id, folder_segment, folder_path_suffix, parent_id,
        tab_key, display_name, display_code, description, tab_group,
        icon_name, display_mode, hidden_by_default, component_name,
        warehouse_enabled, is_photo_category, is_cad_category,
        visibility_rule, xero_scope, entity_filters, warehouse_type_override,
        ui_name_template, download_name_template,
        uses_custom_path, is_system_tab, is_system, enabled, order_position,
        created_at, updated_at
      ) VALUES (
        #{warehouse_type_id},
        #{quote(wf['display_name'])},
        #{wf['tenant_id'] || 'NULL'},
        #{quote(folder_segment)},
        #{folder_path_suffix ? quote(folder_path_suffix) : 'NULL'},
        #{parent_id || 'NULL'},
        #{quote(wf['tab_key'])},
        #{quote(wf['display_name'])},
        #{wf['display_code'] ? quote(wf['display_code']) : 'NULL'},
        #{wf['description'] ? quote(wf['description']) : 'NULL'},
        #{quote(wf['tab_group'] || 'documents')},
        #{wf['icon_name'] ? quote(wf['icon_name']) : 'NULL'},
        #{quote(wf['display_mode'] || 'both')},
        #{wf['hidden_by_default'] || false},
        #{wf['component_name'] ? quote(wf['component_name']) : 'NULL'},
        #{wf['warehouse_enabled'].nil? ? true : wf['warehouse_enabled']},
        #{wf['is_photo_category'] || false},
        #{wf['is_cad_category'] || false},
        #{wf['visibility_rule'] ? quote(wf['visibility_rule']) : 'NULL'},
        #{wf['xero_scope'] ? quote(wf['xero_scope']) : 'NULL'},
        #{quote(wf['entity_filters'] || '{}')},
        #{wf['warehouse_type_override'] ? quote(wf['warehouse_type_override']) : 'NULL'},
        #{wf['ui_name'] ? quote(wf['ui_name']) : 'NULL'},
        #{wf['download_name'] ? quote(wf['download_name']) : 'NULL'},
        #{wf['uses_custom_path'] || false},
        #{wf['is_system_tab'] || false},
        #{wf['is_system_tab'] || false},
        #{wf['enabled'].nil? ? true : wf['enabled']},
        #{wf['order_position'] || 0},
        NOW(), NOW()
      ) RETURNING id
    SQL
    result.first&.fetch('id', nil)&.to_i
  end

  def migrate_document_type_links
    Rails.logger.info "[Migration] Migrating document type links..."

    return unless @wf_to_bf_mapping&.any?

    # Get all warehouse_folder_document_types
    wfdt_records = execute(<<-SQL)
      SELECT
        wfdt.warehouse_folder_id,
        wfdt.document_type_id,
        wfdt.is_primary,
        wfdt.ui_name_template,
        wfdt.download_name_template
      FROM warehouse_folder_document_types wfdt
    SQL

    count = 0
    wfdt_records.each do |wfdt|
      wf_id = wfdt['warehouse_folder_id'].to_i
      bf_id = @wf_to_bf_mapping[wf_id]
      next unless bf_id

      # Check if link already exists
      existing = execute(<<-SQL)
        SELECT id FROM base_folder_document_types
        WHERE base_folder_id = #{bf_id}
          AND document_type_id = #{wfdt['document_type_id']}
        LIMIT 1
      SQL

      if existing.first
        # Update existing link
        execute(<<-SQL)
          UPDATE base_folder_document_types SET
            is_primary = #{wfdt['is_primary'] || false},
            ui_name_template = #{wfdt['ui_name_template'] ? quote(wfdt['ui_name_template']) : 'NULL'},
            download_name_template = #{wfdt['download_name_template'] ? quote(wfdt['download_name_template']) : 'NULL'},
            updated_at = NOW()
          WHERE base_folder_id = #{bf_id}
            AND document_type_id = #{wfdt['document_type_id']}
        SQL
      else
        # Create new link
        execute(<<-SQL)
          INSERT INTO base_folder_document_types (
            base_folder_id, document_type_id, is_primary,
            ui_name_template, download_name_template,
            created_at, updated_at
          ) VALUES (
            #{bf_id},
            #{wfdt['document_type_id']},
            #{wfdt['is_primary'] || false},
            #{wfdt['ui_name_template'] ? quote(wfdt['ui_name_template']) : 'NULL'},
            #{wfdt['download_name_template'] ? quote(wfdt['download_name_template']) : 'NULL'},
            NOW(), NOW()
          )
        SQL
        count += 1
      end
    end

    Rails.logger.info "[Migration] Created #{count} base_folder_document_types links"
  end

  def set_warehouse_types_tenant
    Rails.logger.info "[Migration] Setting tenant_id on warehouse_types..."

    # Get the most common tenant_id from warehouse_folders
    result = execute(<<-SQL)
      SELECT tenant_id, COUNT(*) as cnt
      FROM warehouse_folders
      WHERE tenant_id IS NOT NULL
      GROUP BY tenant_id
      ORDER BY cnt DESC
      LIMIT 1
    SQL

    tenant_id = result.first&.fetch('tenant_id', nil)
    return unless tenant_id

    # Set all warehouse_types to this tenant
    execute("UPDATE warehouse_types SET tenant_id = #{tenant_id} WHERE tenant_id IS NULL")

    Rails.logger.info "[Migration] Set tenant_id = #{tenant_id} on warehouse_types"
  end

  def quote(value)
    ActiveRecord::Base.connection.quote(value)
  end
end

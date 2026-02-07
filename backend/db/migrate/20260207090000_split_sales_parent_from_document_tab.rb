# SSoT: Parent tabs navigate, child tabs store (Feb 2026)
# Sales was both a parent (2 sub-tabs) AND a document store (917 docs, 3 types)
# Split into: Sales (SYS parent) → Sales (DOC child) + Sales Plans + Colours
class SplitSalesParentFromDocumentTab < ActiveRecord::Migration[8.0]
  def up
    sales_parent = execute("SELECT * FROM warehouse_folders WHERE tab_key = 'sales' AND warehouse_type_id = 1 LIMIT 1").first
    return unless sales_parent

    parent_id = sales_parent['id']

    # 1. Create new "Sales" child DOC tab under the parent
    execute <<~SQL
      INSERT INTO warehouse_folders (
        name, warehouse_type_id, tenant_id, tab_key, display_name, display_code, description,
        tab_group, tab_type, parent_id, entity_filters, order_position, enabled,
        icon_name, warehouse_enabled, folder_segment, folder_path_suffix,
        download_name_template, ui_name_template, uses_custom_path,
        warehouse_type_override, display_mode, hidden_by_default,
        is_system, is_mailbox, is_photo_category, is_cad_category,
        created_at, updated_at
      ) VALUES (
        'Sales',
        #{sales_parent['warehouse_type_id']},
        #{sales_parent['tenant_id']},
        'sales-documents',
        'Sales',
        'SAL',
        'Sales documents and quotes',
        'documents',
        'document',
        #{parent_id},
        '{}',
        0,
        true,
        'FileText',
        true,
        '#{sales_parent['folder_segment']}',
        #{sales_parent['folder_path_suffix'] ? "'#{sales_parent['folder_path_suffix']}'" : 'NULL'},
        #{sales_parent['download_name_template'] ? "'#{sales_parent['download_name_template']}'" : 'NULL'},
        #{sales_parent['ui_name_template'] ? "'#{sales_parent['ui_name_template']}'" : 'NULL'},
        #{sales_parent['uses_custom_path'] || false},
        '#{sales_parent['warehouse_type_override'] || 'corporate'}',
        'both',
        false,
        true,
        false, false, false,
        NOW(), NOW()
      )
    SQL

    # Get the new child's ID
    new_child = execute("SELECT id FROM warehouse_folders WHERE tab_key = 'sales-documents' AND parent_id = #{parent_id} LIMIT 1").first
    return unless new_child

    new_child_id = new_child['id']

    # 2. Move document type links from parent to new child
    execute <<~SQL
      UPDATE warehouse_folder_document_types
      SET warehouse_folder_id = #{new_child_id}
      WHERE warehouse_folder_id = #{parent_id}
    SQL

    # 3. Reorder children: Sales (0), Sales Plans (1), Colours (2)
    execute <<~SQL
      UPDATE warehouse_folders
      SET order_position = 1
      WHERE parent_id = #{parent_id} AND tab_key = 'sales-plans'
    SQL

    execute <<~SQL
      UPDATE warehouse_folders
      SET order_position = 2
      WHERE parent_id = #{parent_id} AND tab_key = 'colours'
    SQL

    # 4. Convert parent to SYS navigation tab
    execute <<~SQL
      UPDATE warehouse_folders
      SET tab_type = 'system',
          tab_group = 'data',
          warehouse_enabled = false,
          folder_segment = NULL,
          folder_path_suffix = NULL,
          download_name_template = NULL,
          ui_name_template = NULL,
          icon_name = 'ShoppingCart'
      WHERE id = #{parent_id}
    SQL
  end

  def down
    sales_parent = execute("SELECT id FROM warehouse_folders WHERE tab_key = 'sales' AND warehouse_type_id = 1 AND parent_id IS NULL LIMIT 1").first
    return unless sales_parent

    parent_id = sales_parent['id']
    child = execute("SELECT id FROM warehouse_folders WHERE tab_key = 'sales-documents' AND parent_id = #{parent_id} LIMIT 1").first
    return unless child

    child_id = child['id']

    # Move doc types back to parent
    execute("UPDATE warehouse_folder_document_types SET warehouse_folder_id = #{parent_id} WHERE warehouse_folder_id = #{child_id}")

    # Restore parent as document tab
    execute <<~SQL
      UPDATE warehouse_folders
      SET tab_type = 'document',
          tab_group = 'documents',
          warehouse_enabled = true,
          folder_segment = 'Sales',
          icon_name = ''
      WHERE id = #{parent_id}
    SQL

    # Delete the child
    execute("DELETE FROM warehouse_folders WHERE id = #{child_id}")
  end
end

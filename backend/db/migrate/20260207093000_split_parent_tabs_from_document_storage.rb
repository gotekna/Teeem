# SSoT: Parent tabs navigate, child tabs store (Feb 2026)
# Split 4 parent tabs that were both navigating AND storing documents.
# Creates DOC child tab for each, moves doc types to child, converts parent to SYS.
#
# PreCon (job, id=47): 3 doc types, 6 children → create PreCon Documents child
# Bank (corporate, id=76): 2 doc types, 2 children → create Bank Documents child
# Xero (corporate, id=8): 1 doc type, 8 children → create Xero Documents child
# Photo (job, id=49): 1 doc type, 9 children → create Photo Documents child
class SplitParentTabsFromDocumentStorage < ActiveRecord::Migration[8.0]
  def up
    split_parent_tab(
      tab_key: 'precon',
      warehouse_type_id: 1,
      new_child_tab_key: 'precon-documents',
      new_child_name: 'PreCon Documents',
      new_child_code: 'PRC',
      new_child_description: 'Pre-construction documents',
      new_child_icon: 'FileText',
      parent_new_type: 'system',
      parent_new_icon: 'ClipboardList'
    )

    split_parent_tab(
      tab_key: 'xero-bank',
      warehouse_type_id: 3,
      new_child_tab_key: 'bank-documents',
      new_child_name: 'Bank Documents',
      new_child_code: 'BNK',
      new_child_description: 'Bank statements and documents',
      new_child_icon: 'FileText',
      parent_new_type: nil,  # Already system, don't change
      parent_new_icon: nil
    )

    split_parent_tab(
      tab_key: 'xero',
      warehouse_type_id: 3,
      new_child_tab_key: 'xero-documents',
      new_child_name: 'Xero Documents',
      new_child_code: 'XRO',
      new_child_description: 'Xero-related documents',
      new_child_icon: 'FileText',
      parent_new_type: 'system',
      parent_new_icon: 'file-spreadsheet'
    )

    split_parent_tab(
      tab_key: 'photo',
      warehouse_type_id: 1,
      new_child_tab_key: 'photo-documents',
      new_child_name: 'Photo Documents',
      new_child_code: 'PHD',
      new_child_description: 'Photo-related documents',
      new_child_icon: 'FileText',
      parent_new_type: nil,  # Keep as photo
      parent_new_icon: nil
    )
  end

  def down
    unsplit_parent_tab('precon', 'precon-documents', 1, 'document', 'PreCon', '')
    unsplit_parent_tab('xero-bank', 'bank-documents', 3, nil, nil, nil)
    unsplit_parent_tab('xero', 'xero-documents', 3, 'document', 'Xero', 'file-spreadsheet')
    unsplit_parent_tab('photo', 'photo-documents', 1, nil, nil, nil)
  end

  private

  def split_parent_tab(tab_key:, warehouse_type_id:, new_child_tab_key:, new_child_name:, new_child_code:, new_child_description:, new_child_icon:, parent_new_type:, parent_new_icon:)
    parent = execute("SELECT * FROM warehouse_folders WHERE tab_key = '#{tab_key}' AND warehouse_type_id = #{warehouse_type_id} AND parent_id IS NULL LIMIT 1").first
    return unless parent

    parent_id = parent['id']
    has_doc_types = execute("SELECT COUNT(*) as cnt FROM warehouse_folder_document_types WHERE warehouse_folder_id = #{parent_id}").first['cnt'].to_i
    return if has_doc_types == 0

    folder_segment = parent['folder_segment']
    folder_path_suffix = parent['folder_path_suffix']
    warehouse_type_override = parent['warehouse_type_override'] || 'corporate'

    # Create child DOC tab
    execute <<~SQL
      INSERT INTO warehouse_folders (
        name, warehouse_type_id, tenant_id, tab_key, display_name, display_code, description,
        tab_group, tab_type, parent_id, entity_filters, order_position, enabled,
        icon_name, warehouse_enabled, folder_segment, folder_path_suffix,
        uses_custom_path, warehouse_type_override, display_mode, hidden_by_default,
        is_system, is_mailbox, is_photo_category, is_cad_category,
        created_at, updated_at
      ) VALUES (
        '#{new_child_name}',
        #{parent['warehouse_type_id']},
        #{parent['tenant_id']},
        '#{new_child_tab_key}',
        '#{new_child_name}',
        '#{new_child_code}',
        '#{new_child_description}',
        'documents',
        'document',
        #{parent_id},
        '{}',
        0,
        true,
        '#{new_child_icon}',
        true,
        #{folder_segment ? "'#{folder_segment}'" : 'NULL'},
        #{folder_path_suffix ? "'#{folder_path_suffix}'" : 'NULL'},
        false,
        '#{warehouse_type_override}',
        'both',
        false,
        true,
        false, false, false,
        NOW(), NOW()
      )
    SQL

    new_child = execute("SELECT id FROM warehouse_folders WHERE tab_key = '#{new_child_tab_key}' AND parent_id = #{parent_id} LIMIT 1").first
    return unless new_child

    # Move doc types from parent to child
    execute("UPDATE warehouse_folder_document_types SET warehouse_folder_id = #{new_child['id']} WHERE warehouse_folder_id = #{parent_id}")

    # Convert parent if needed
    if parent_new_type
      execute <<~SQL
        UPDATE warehouse_folders
        SET tab_type = '#{parent_new_type}',
            tab_group = '#{parent_new_type == 'system' ? 'data' : 'documents'}',
            warehouse_enabled = false,
            folder_segment = NULL,
            folder_path_suffix = NULL,
            download_name_template = NULL,
            ui_name_template = NULL
            #{parent_new_icon ? ", icon_name = '#{parent_new_icon}'" : ''}
        WHERE id = #{parent_id}
      SQL
    end
  end

  def unsplit_parent_tab(parent_tab_key, child_tab_key, warehouse_type_id, restore_type, restore_segment, restore_icon)
    parent = execute("SELECT id FROM warehouse_folders WHERE tab_key = '#{parent_tab_key}' AND warehouse_type_id = #{warehouse_type_id} AND parent_id IS NULL LIMIT 1").first
    return unless parent

    child = execute("SELECT id FROM warehouse_folders WHERE tab_key = '#{child_tab_key}' AND parent_id = #{parent['id']} LIMIT 1").first
    return unless child

    # Move doc types back
    execute("UPDATE warehouse_folder_document_types SET warehouse_folder_id = #{parent['id']} WHERE warehouse_folder_id = #{child['id']}")

    # Restore parent if type was changed
    if restore_type
      execute <<~SQL
        UPDATE warehouse_folders
        SET tab_type = '#{restore_type}',
            tab_group = 'documents',
            warehouse_enabled = true,
            folder_segment = '#{restore_segment}'
            #{restore_icon ? ", icon_name = '#{restore_icon}'" : ''}
        WHERE id = #{parent['id']}
      SQL
    end

    # Delete child
    execute("DELETE FROM warehouse_folders WHERE id = #{child['id']}")
  end
end

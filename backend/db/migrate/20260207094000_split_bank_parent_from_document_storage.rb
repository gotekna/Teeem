# SSoT: Bank (corporate, id=76) is a child of Xero (parent_id=8) but also a parent
# with 2 doc types. Move doc types to a new Bank Documents child.
class SplitBankParentFromDocumentStorage < ActiveRecord::Migration[8.0]
  def up
    bank = execute("SELECT * FROM warehouse_folders WHERE tab_key = 'xero-bank' AND warehouse_type_id = 3 LIMIT 1").first
    return unless bank

    bank_id = bank['id']
    has_doc_types = execute("SELECT COUNT(*) as cnt FROM warehouse_folder_document_types WHERE warehouse_folder_id = #{bank_id}").first['cnt'].to_i
    return if has_doc_types == 0

    execute <<~SQL
      INSERT INTO warehouse_folders (
        name, warehouse_type_id, tenant_id, tab_key, display_name, display_code, description,
        tab_group, tab_type, parent_id, entity_filters, order_position, enabled,
        icon_name, warehouse_enabled, folder_segment,
        uses_custom_path, warehouse_type_override, display_mode, hidden_by_default,
        is_system, is_mailbox, is_photo_category, is_cad_category,
        created_at, updated_at
      ) VALUES (
        'Bank Documents',
        #{bank['warehouse_type_id']},
        #{bank['tenant_id']},
        'bank-documents',
        'Bank Documents',
        'BNK',
        'Bank statements and documents',
        'documents',
        'document',
        #{bank_id},
        '{}',
        0,
        true,
        'FileText',
        true,
        'Bank',
        false,
        '#{bank['warehouse_type_override'] || 'corporate'}',
        'both',
        false,
        true,
        false, false, false,
        NOW(), NOW()
      )
    SQL

    new_child = execute("SELECT id FROM warehouse_folders WHERE tab_key = 'bank-documents' AND parent_id = #{bank_id} LIMIT 1").first
    return unless new_child

    execute("UPDATE warehouse_folder_document_types SET warehouse_folder_id = #{new_child['id']} WHERE warehouse_folder_id = #{bank_id}")
  end

  def down
    bank = execute("SELECT id FROM warehouse_folders WHERE tab_key = 'xero-bank' AND warehouse_type_id = 3 LIMIT 1").first
    return unless bank

    child = execute("SELECT id FROM warehouse_folders WHERE tab_key = 'bank-documents' AND parent_id = #{bank['id']} LIMIT 1").first
    return unless child

    execute("UPDATE warehouse_folder_document_types SET warehouse_folder_id = #{bank['id']} WHERE warehouse_folder_id = #{child['id']}")
    execute("DELETE FROM warehouse_folders WHERE id = #{child['id']}")
  end
end

# frozen_string_literal: true

class AddTeeemDocsEntityTab < ActiveRecord::Migration[8.0]
  def up
    # Add entity tab for Teeem Docs (user scope) - allows configuring Display Name and Send Name
    # SSoT: EntityTab is THE ONE place for tab configuration per scope
    EntityTab.create!(
      warehouse_type: 'user',
      tab_key: 'my_docs',
      display_name: 'My Documents',
      description: 'Personal user documents stored in Teeem Docs folder',
      tab_group: 'documents',
      order_position: 0,
      enabled: true,
      icon_name: 'FolderHeart',
      is_system_tab: true,
      warehouse_enabled: true,
      warehouse_folder: '{{Folder}}',
      send_name_template: '{{OriginalFileName}}'
    )
  end

  def down
    EntityTab.where(warehouse_type: 'user', tab_key: 'my_docs').destroy_all
  end
end

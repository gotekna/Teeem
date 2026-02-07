# SSoT: Enforce tab_type classification rules across all warehouse_folders
#
# Two independent axes:
#   is_system (boolean) = who created the tab (system vs user)
#   tab_type (string)   = what the tab DOES
#
# Rule 1: Parents with children → tab_type='system' (navigation only)
#   Fixes: Photo (10 children), FBA (5 children), Site (1 child)
#
# Rule 2: Leaf system tabs that store files → tab_type='document'
#   Fixes: Task Attachments, Task Responses, Bank Statements, etc.
#   (keeps is_system=true since they're system-created)
class ConvertSiteParentToSystem < ActiveRecord::Migration[8.0]
  def up
    # Rule 1: Fix parents with children that aren't system
    execute <<~SQL
      UPDATE warehouse_folders
      SET tab_type = 'system',
          tab_group = 'data',
          is_photo_category = false,
          is_cad_category = false,
          is_mailbox = false
      WHERE id IN (SELECT DISTINCT parent_id FROM warehouse_folders WHERE parent_id IS NOT NULL)
        AND tab_type != 'system'
    SQL

    # Rule 2: Fix leaf system tabs that store files → document
    execute <<~SQL
      UPDATE warehouse_folders
      SET tab_type = 'document',
          tab_group = 'documents'
      WHERE tab_type = 'system'
        AND id NOT IN (SELECT DISTINCT parent_id FROM warehouse_folders WHERE parent_id IS NOT NULL)
        AND id IN (SELECT DISTINCT warehouse_folder_id FROM warehouse_folder_document_types)
    SQL
  end

  def down
    # Not reversible - data was incorrect before, no safe way to restore
    raise ActiveRecord::IrreversibleMigration
  end
end

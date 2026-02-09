# frozen_string_literal: true

# SSoT: tab_type is THE ONE field for warehouse folder behavior type
#
# Derivation from existing booleans:
#   is_mailbox=true                        → 'mailbox'
#   is_photo_category=true                 → 'photo'
#   is_cad_category=true                   → 'revit'
#   tab_group='documents' && none of above → 'document'
#   everything else                        → 'system'
#
# Old booleans (is_mailbox, is_photo_category, is_cad_category) kept for
# backward compatibility during transition. A before_save callback on the
# model keeps them in sync.
class AddTabTypeToWarehouseFolders < ActiveRecord::Migration[8.0]
  def up
    add_column :warehouse_folders, :tab_type, :string, default: 'document', null: false

    # Populate tab_type from existing boolean flags
    execute <<~SQL
      UPDATE warehouse_folders
      SET tab_type = CASE
        WHEN is_mailbox = true THEN 'mailbox'
        WHEN is_photo_category = true THEN 'photo'
        WHEN is_cad_category = true THEN 'revit'
        WHEN tab_group = 'documents' THEN 'document'
        ELSE 'system'
      END
    SQL

    add_index :warehouse_folders, :tab_type
  end

  def down
    remove_index :warehouse_folders, :tab_type
    remove_column :warehouse_folders, :tab_type
  end
end

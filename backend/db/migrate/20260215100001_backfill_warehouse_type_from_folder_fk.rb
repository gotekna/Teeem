# frozen_string_literal: true

# Backfill warehouse_type AND folder_path on warehouse_documents from the FK chain.
#
# Previously both were derived from hardcoded CASE statements.
# Now they come from the FK chain:
#   warehouse_document.warehouse_folder_id → warehouse_folder → warehouse_type → code
#   warehouse_document.warehouse_folder_id → warehouse_folder → full_folder_path template → expanded
#
class BackfillWarehouseTypeFromFolderFk < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def up
    # Step 1: Update warehouse_type from FK chain (fast SQL)
    updated_wt = execute(<<-SQL.squish).cmd_tuples
      UPDATE warehouse_documents wd
      SET warehouse_type = wt.code
      FROM warehouse_folders wf
      INNER JOIN warehouse_types wt ON wt.id = wf.warehouse_type_id
      WHERE wd.warehouse_folder_id = wf.id
        AND (wd.warehouse_type IS DISTINCT FROM wt.code)
    SQL
    say "Updated #{updated_wt} warehouse_type values from FK chain"

    # Step 2: Rematerialize folder_path from FK chain (needs token expansion via Ruby)
    all_folder_ids = WarehouseFolder.where(warehouse_enabled: true).pluck(:id)
    updated_fp = WarehousePathComputer.rematerialize_for_folders(all_folder_ids)
    say "Rematerialized #{updated_fp} folder_path values from FK chain"
  end

  def down
    # No-op
  end
end

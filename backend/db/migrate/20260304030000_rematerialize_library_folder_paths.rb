# frozen_string_literal: true

# FRC (Mar 2026): Library docs were stored with folder_path = "STD Build Contract"
# instead of "Library/STD Build Contract". Root cause: create_library_document passed
# folder_path explicitly, bypassing materialize_folder_path callback which would have
# computed the correct path via WarehouseFolder → full_folder_path → "Library/...".
#
# Two cases to fix:
# 1. Docs WITH warehouse_folder_id → rematerialize via FK chain (WarehousePathComputer)
# 2. Docs WITHOUT warehouse_folder_id but WITH folder_path → prefix with "Library/"
class RematerializeLibraryFolderPaths < ActiveRecord::Migration[7.1]
  def up
    # Case 1: Docs linked to a warehouse folder - rematerialize via FK chain
    library_folder_ids = WarehouseFolder
      .joins(:warehouse_type)
      .where(warehouse_types: { code: "library" })
      .pluck(:id)

    if library_folder_ids.any?
      updated = WarehousePathComputer.rematerialize_for_folders(library_folder_ids)
      puts "Case 1: Rematerialized #{updated} library documents via FK chain"
    else
      puts "Case 1: No library warehouse folders found"
    end

    # Case 2: Docs without warehouse_folder_id that have a bare folder_path (no "Library/" prefix)
    # These were uploaded with explicit folder_path metadata but no warehouse_folder_id FK.
    orphan_count = WarehouseDocument
      .where(source_type: "library", warehouse_folder_id: nil)
      .where.not(folder_path: [nil, ""])
      .where("folder_path NOT LIKE 'Library/%'")
      .update_all("folder_path = 'Library/' || folder_path")
    puts "Case 2: Prefixed #{orphan_count} library documents with 'Library/'"
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end

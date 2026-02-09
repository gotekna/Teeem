# FRC (Feb 2026): Warehouse documents (source_type='warehouse') had folder_path='Email'
# because WarehousePathComputer.source_type_to_warehouse_type_code was missing the
# 'warehouse' mapping. It fell through to 'unassigned', which computed 'Email' paths.
#
# Root cause: Missing case in source_type_to_warehouse_type_code mapping.
# Fix: Added 'warehouse' → 'warehouse' mapping. Now recompute all affected paths.
class RecomputeWarehouseDocumentFolderPaths < ActiveRecord::Migration[7.2]
  def up
    # Recompute folder_path for all source_type='warehouse' documents
    # These were incorrectly set to 'Email' due to the missing mapping
    docs = WarehouseDocument.unscoped.where(source_type: "warehouse")
    computer = WarehousePathComputer.new

    updated = 0
    docs.find_each do |doc|
      new_path = computer.compute(doc)[:folder_path]
      next if new_path.blank? || doc.folder_path == new_path

      doc.update_columns(folder_path: new_path)
      updated += 1
    end

    say "Recomputed folder_path for #{updated} warehouse documents"
  end

  def down
    # Not reversible - the old paths were wrong
    say "Not reversible - previous folder_path values were incorrect"
  end
end

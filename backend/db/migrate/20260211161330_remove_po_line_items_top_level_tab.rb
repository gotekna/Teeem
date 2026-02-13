# frozen_string_literal: true

# Remove the "Purchase Order Lines" top-level job tab.
# PO Line Items are now a sub-tab within the Purchase Orders tab (frontend-only),
# so the WarehouseFolder record is no longer needed.
class RemovePoLineItemsTopLevelTab < ActiveRecord::Migration[7.2]
  def up
    execute(<<-SQL.squish)
      DELETE FROM warehouse_folders
      WHERE tab_key = 'purchase-order-lines'
    SQL

    puts "  ✅ Removed 'purchase-order-lines' WarehouseFolder tabs (now a sub-tab in Purchase Orders)"
  end

  def down
    # No-op: the original migration can recreate if needed
  end
end

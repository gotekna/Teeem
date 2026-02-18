# frozen_string_literal: true

# Remove the "Purchase Order Lines" primary nav tab from all tenants.
# Line Items is already accessible as a sub-tab under Purchase Orders.
class RemovePurchaseOrderLinesPrimaryTab < ActiveRecord::Migration[7.2]
  def up
    execute("DELETE FROM warehouse_folders WHERE tab_key = 'purchase-order-lines'")
    puts "  ✅ Removed 'purchase-order-lines' primary nav tab from all tenants"
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
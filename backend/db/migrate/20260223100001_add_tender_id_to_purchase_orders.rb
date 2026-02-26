# frozen_string_literal: true

# Add tender_id directly to purchase_orders for manual POs that aren't linked
# to a Schedule Master task. This allows manual POs to be assigned a tender
# section directly, so they appear in the Tender Builder.
#
# SSoT priority for tender assignment:
# 1. PO.tender_id (direct assignment, used for manual POs)
# 2. SmTask.tender_id (synced from template)
# 3. SmScheduleMaster.tender_id (template source, fallback)
class AddTenderIdToPurchaseOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :purchase_orders, :tender_id, :integer
    add_index :purchase_orders, :tender_id
  end
end

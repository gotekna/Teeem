# SSoT Cleanup: PurchaseOrder should ONLY link to SmTask (job-level)
# Template references belong ONLY on SmTask.sm_template_row_id
#
# Before: PO -> SmTemplateRow (WRONG) and PO -> SmTask (correct)
# After:  PO -> SmTask -> SmTemplateRow (clean hierarchy)
#
class RemoveTemplateRowFromPurchaseOrders < ActiveRecord::Migration[8.0]
  def up
    # Remove the redundant template row links
    remove_column :purchase_orders, :sm_template_row_id, if_exists: true
    remove_column :purchase_orders, :unreal_task_template_id, if_exists: true
  end

  def down
    # Restore columns for rollback
    add_column :purchase_orders, :sm_template_row_id, :bigint
    add_column :purchase_orders, :unreal_task_template_id, :integer
    add_index :purchase_orders, :sm_template_row_id
  end
end

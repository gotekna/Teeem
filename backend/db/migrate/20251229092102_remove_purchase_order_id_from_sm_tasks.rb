# frozen_string_literal: true

# SSoT Option B: Remove bidirectional PO-Task link
#
# Before this migration:
# - PurchaseOrder.sm_task_id → SmTask (primary, keep)
# - SmTask.purchase_order_id → PurchaseOrder (legacy, remove)
#
# After this migration:
# - PurchaseOrder.sm_task_id → SmTask (THE ONE link)
# - Use task.linked_purchase_order for reverse lookup
#
# IMPORTANT: Run backup task before migrating:
#   bundle exec rake po_task:backup
#
class RemovePurchaseOrderIdFromSmTasks < ActiveRecord::Migration[8.0]
  def up
    # Verify all POs have sm_task_id set correctly before removing the reverse column
    # This is a safety check - the bidirectional sync should have kept them in sync
    orphaned_count = execute(<<-SQL).first["count"]
      SELECT COUNT(*) as count
      FROM sm_tasks t
      WHERE t.purchase_order_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM purchase_orders po
        WHERE po.id = t.purchase_order_id
        AND po.sm_task_id = t.id
      )
    SQL

    if orphaned_count.to_i > 0
      raise "Found #{orphaned_count} orphaned PO-Task links. Run 'rake po_task:verify' to investigate."
    end

    # Remove the legacy column
    remove_column :sm_tasks, :purchase_order_id

    say "Removed purchase_order_id from sm_tasks - SSoT is now PurchaseOrder.sm_task_id"
  end

  def down
    # Restore the column
    add_reference :sm_tasks, :purchase_order, foreign_key: true, index: true

    # Restore the data from the primary link
    execute(<<-SQL)
      UPDATE sm_tasks t
      SET purchase_order_id = po.id
      FROM purchase_orders po
      WHERE po.sm_task_id = t.id
    SQL

    say "Restored purchase_order_id column and synced from PurchaseOrder.sm_task_id"
  end
end

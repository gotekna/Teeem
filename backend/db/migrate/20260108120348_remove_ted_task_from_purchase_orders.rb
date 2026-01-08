# frozen_string_literal: true

# SSoT Migration: Remove redundant ted_task column
#
# ted_task was a TEXT field storing task name as denormalized data.
# SSoT: Task info now comes from sm_task_id → SmTask.name relationship.
#
# Before this migration:
# - ted_task: TEXT (redundant)
# - sm_task_id: FK to sm_tasks (SSoT)
#
# After this migration:
# - sm_task_id: FK to sm_tasks (SSoT) - THE source of truth
#
class RemoveTedTaskFromPurchaseOrders < ActiveRecord::Migration[8.0]
  def up
    remove_column :purchase_orders, :ted_task, :text
  end

  def down
    add_column :purchase_orders, :ted_task, :text
  end
end

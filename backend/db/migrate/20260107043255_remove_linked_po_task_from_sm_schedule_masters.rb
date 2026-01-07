class RemoveLinkedPoTaskFromSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    remove_column :sm_schedule_masters, :linked_po_task_id, :bigint
  end
end

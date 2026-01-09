class AddSmTaskIdToPurchaseOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :purchase_orders, :sm_task_id, :bigint
    add_index :purchase_orders, :sm_task_id

    # Backfill from existing SmTask.purchase_order_id relationship
    reversible do |dir|
      dir.up do
        # Only run backfill if sm_tasks table exists (production has it, local dev may not)
        if table_exists?(:sm_tasks)
          execute <<-SQL
            UPDATE purchase_orders po
            SET sm_task_id = (
              SELECT id FROM sm_tasks
              WHERE sm_tasks.purchase_order_id = po.id
              LIMIT 1
            )
            WHERE EXISTS (
              SELECT 1 FROM sm_tasks
              WHERE sm_tasks.purchase_order_id = po.id
            )
          SQL
        end
      end
    end
  end
end

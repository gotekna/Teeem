class AddSmTaskIdToPurchaseOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :purchase_orders, :sm_task_id, :bigint
  end
end

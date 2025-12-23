class AddUnrealFieldsToPurchaseOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :purchase_orders, :source, :string
    add_column :purchase_orders, :unreal_task_template_id, :integer
  end
end

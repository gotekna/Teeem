# frozen_string_literal: true

class AddBudgetLockdownToPurchaseOrders < ActiveRecord::Migration[7.0]
  def change
    add_column :purchase_orders, :budget_locked_at, :datetime
    add_column :purchase_orders, :budget_locked_by_id, :bigint
    add_column :purchase_orders, :budget_unlocked_at, :datetime
    add_column :purchase_orders, :budget_unlocked_by_id, :bigint
    add_column :purchase_orders, :budget_unlock_reason, :string

    add_foreign_key :purchase_orders, :users, column: :budget_locked_by_id
    add_foreign_key :purchase_orders, :users, column: :budget_unlocked_by_id

    add_index :purchase_orders, :budget_locked_at
  end
end

class AddDirectionToEmailWarehouses < ActiveRecord::Migration[8.0]
  def change
    add_column :email_warehouses, :direction, :string
    add_index :email_warehouses, :direction
  end
end

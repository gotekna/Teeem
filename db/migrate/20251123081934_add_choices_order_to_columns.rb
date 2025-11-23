class AddChoicesOrderToColumns < ActiveRecord::Migration[8.0]
  def change
    add_column :columns, :choices_order, :text
  end
end

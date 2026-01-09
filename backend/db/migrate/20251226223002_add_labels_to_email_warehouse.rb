class AddLabelsToEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    add_column :email_warehouse, :labels, :string, array: true, default: []
    add_index :email_warehouse, :labels, using: 'gin'
  end
end

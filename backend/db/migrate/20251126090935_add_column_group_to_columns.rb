class AddColumnGroupToColumns < ActiveRecord::Migration[8.0]
  def change
    add_column :columns, :column_group, :string
  end
end

class AddGroupByColumnToTableViews < ActiveRecord::Migration[8.0]
  def change
    add_column :table_views, :group_by_column, :string
  end
end

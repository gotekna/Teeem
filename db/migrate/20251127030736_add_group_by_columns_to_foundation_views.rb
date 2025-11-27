class AddGroupByColumnsToFoundationViews < ActiveRecord::Migration[8.0]
  def change
    add_column :foundation_views, :group_by_columns, :json
  end
end

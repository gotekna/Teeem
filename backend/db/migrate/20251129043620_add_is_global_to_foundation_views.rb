class AddIsGlobalToFoundationViews < ActiveRecord::Migration[8.0]
  def change
    add_column :foundation_views, :is_global, :boolean, default: false, null: false
  end
end

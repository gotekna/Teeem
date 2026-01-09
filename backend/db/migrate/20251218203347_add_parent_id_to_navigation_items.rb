class AddParentIdToNavigationItems < ActiveRecord::Migration[8.0]
  def change
    add_reference :navigation_items, :parent, null: true, foreign_key: { to_table: :navigation_items }
    add_column :navigation_items, :is_collapsed_default, :boolean, default: true
  end
end

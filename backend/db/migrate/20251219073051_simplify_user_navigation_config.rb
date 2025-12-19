class SimplifyUserNavigationConfig < ActiveRecord::Migration[8.0]
  def change
    # Remove columns that are now controlled by NavigationItem (SSoT)
    # User config should only store collapse preference
    remove_index :user_navigation_configs, [:user_id, :position]
    remove_column :user_navigation_configs, :position, :integer
    remove_column :user_navigation_configs, :parent_id, :integer
    remove_column :user_navigation_configs, :is_hidden, :boolean
  end
end

class SimplifyUserNavigationConfig < ActiveRecord::Migration[8.0]
  def change
    # Remove columns that are now controlled by NavigationItem (SSoT)
    # User config should only store collapse preference

    # Only remove index if it exists (may not exist on production)
    if index_exists?(:user_navigation_configs, [:user_id, :position])
      remove_index :user_navigation_configs, [:user_id, :position]
    end

    # Remove columns if they exist
    if column_exists?(:user_navigation_configs, :position)
      remove_column :user_navigation_configs, :position, :integer
    end

    if column_exists?(:user_navigation_configs, :parent_id)
      remove_column :user_navigation_configs, :parent_id, :integer
    end

    if column_exists?(:user_navigation_configs, :is_hidden)
      remove_column :user_navigation_configs, :is_hidden, :boolean
    end
  end
end

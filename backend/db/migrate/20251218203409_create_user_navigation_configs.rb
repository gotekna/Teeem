class CreateUserNavigationConfigs < ActiveRecord::Migration[8.0]
  def change
    create_table :user_navigation_configs do |t|
      t.references :user, null: false, foreign_key: true
      t.references :navigation_item, null: false, foreign_key: true
      t.integer :position, null: false, default: 0
      t.integer :parent_id  # For user-specific nesting override
      t.boolean :is_hidden, default: false
      t.boolean :is_collapsed, default: true
      t.timestamps
    end

    add_index :user_navigation_configs, [:user_id, :navigation_item_id], unique: true, name: 'idx_user_nav_config_unique'
    add_index :user_navigation_configs, [:user_id, :position]
  end
end

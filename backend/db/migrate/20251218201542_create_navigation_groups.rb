class CreateNavigationGroups < ActiveRecord::Migration[8.0]
  def change
    create_table :navigation_groups do |t|
      t.string :name, null: false
      t.string :icon, default: "Folder"
      t.integer :position, null: false, default: 0
      t.boolean :is_active, default: true
      t.boolean :is_collapsible, default: true
      t.string :visible_to_roles, array: true, default: []
      t.timestamps
    end

    add_index :navigation_groups, :position
    add_index :navigation_groups, :is_active
    add_index :navigation_groups, :visible_to_roles, using: :gin
  end
end

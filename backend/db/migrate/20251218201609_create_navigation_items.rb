class CreateNavigationItems < ActiveRecord::Migration[8.0]
  def change
    create_table :navigation_items do |t|
      t.references :navigation_group, foreign_key: true, null: true
      t.string :name, null: false
      t.string :href, null: false
      t.string :icon, null: false
      t.string :badge_key
      t.integer :position, null: false, default: 0
      t.boolean :is_active, default: true
      t.string :visible_to_roles, array: true, default: []
      t.timestamps
    end

    add_index :navigation_items, :position
    add_index :navigation_items, :href, unique: true
    add_index :navigation_items, :is_active
    add_index :navigation_items, :visible_to_roles, using: :gin
  end
end

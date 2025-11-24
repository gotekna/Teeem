class CreateFeatureTrackers < ActiveRecord::Migration[8.0]
  def change
    create_table :feature_trackers do |t|
      t.string :chapter, null: false
      t.string :feature_name, null: false
      t.text :detail_point_1
      t.text :detail_point_2
      t.text :detail_point_3
      t.boolean :system_complete, default: false, null: false
      t.boolean :dev_checked, default: false, null: false
      t.boolean :tester_checked, default: false, null: false
      t.boolean :user_checked, default: false, null: false
      t.integer :sort_order, default: 0, null: false

      t.timestamps
    end

    add_index :feature_trackers, :chapter
    add_index :feature_trackers, :sort_order
  end
end

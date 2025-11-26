class CreateFeatureChapters < ActiveRecord::Migration[8.0]
  def change
    create_table :feature_chapters do |t|
      t.integer :chapter_number, null: false
      t.string :name, null: false
      t.text :description
      t.integer :sort_order, default: 0, null: false

      t.timestamps
    end

    add_index :feature_chapters, :chapter_number, unique: true
    add_index :feature_chapters, :sort_order
  end
end

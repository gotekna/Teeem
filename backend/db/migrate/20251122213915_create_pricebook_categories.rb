class CreatePricebookCategories < ActiveRecord::Migration[8.0]
  def change
    create_table :pricebook_categories do |t|
      t.string :name, null: false
      t.string :display_name
      t.string :color, default: '#6B7280'
      t.string :icon
      t.integer :position, default: 0
      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :pricebook_categories, :name, unique: true
    add_index :pricebook_categories, :position
    add_index :pricebook_categories, :is_active
  end
end

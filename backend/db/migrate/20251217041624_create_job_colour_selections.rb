class CreateJobColourSelections < ActiveRecord::Migration[8.0]
  def change
    create_table :job_colour_selections do |t|
      t.references :job, null: false, foreign_key: { to_table: :jobs }
      t.string :category_key, null: false
      t.string :item_key, null: false
      t.references :pricebook_item, foreign_key: { to_table: :pricebook }
      t.string :colour_name
      t.string :colour_code
      t.string :colour_brand
      t.text :notes
      t.integer :position, default: 0

      t.timestamps
    end

    add_index :job_colour_selections, [:job_id, :category_key, :item_key], unique: true, name: 'idx_job_colours_unique'
  end
end

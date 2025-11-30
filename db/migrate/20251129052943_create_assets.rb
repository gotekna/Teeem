class CreateAssets < ActiveRecord::Migration[8.0]
  def change
    create_table :assets do |t|
      t.references :company, null: false, foreign_key: true
      t.string :name
      t.string :asset_type
      t.string :status
      t.decimal :purchase_price
      t.date :purchase_date
      t.date :sale_date
      t.decimal :current_book_value
      t.string :make
      t.string :model
      t.text :description
      t.text :notes

      t.timestamps
    end
  end
end

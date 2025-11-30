class CreateDividends < ActiveRecord::Migration[8.0]
  def change
    create_table :dividends do |t|
      t.references :company, null: false, foreign_key: true
      t.date :declaration_date, null: false
      t.date :record_date  # Who is entitled
      t.date :payment_date
      t.decimal :total_amount, precision: 12, scale: 2, null: false
      t.decimal :franking_percentage, precision: 5, scale: 2, default: 0
      t.string :dividend_type  # interim, final, special
      t.string :status, default: 'declared'  # declared, paid, cancelled
      t.text :notes

      t.timestamps
    end
    add_index :dividends, :declaration_date
    add_index :dividends, :status
    add_index :dividends, :dividend_type
  end
end

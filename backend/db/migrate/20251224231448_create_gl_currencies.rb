# frozen_string_literal: true

class CreateGlCurrencies < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_currencies do |t|
      t.references :corporate, null: false, foreign_key: true

      # Currency Identity
      t.string :code, null: false          # "AUD", "USD", "NZD", "GBP"
      t.string :name, null: false          # "Australian Dollar"
      t.string :symbol                     # "$", "US$", "£"

      # Status
      t.boolean :is_base_currency, default: false  # Only one per company
      t.boolean :active, default: true

      # Decimal places (most currencies use 2)
      t.integer :decimal_places, default: 2

      t.timestamps
    end

    # Unique constraint: one currency code per company
    add_index :gl_currencies, [:corporate_id, :code], unique: true

    # Only one base currency per company
    add_index :gl_currencies, [:corporate_id, :is_base_currency],
              unique: true, where: 'is_base_currency = true',
              name: 'idx_gl_currencies_base_currency'
  end
end

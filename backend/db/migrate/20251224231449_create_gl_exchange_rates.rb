# frozen_string_literal: true

class CreateGlExchangeRates < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_exchange_rates do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :gl_currency, null: false, foreign_key: true

      # Rate Identity
      t.date :effective_date, null: false

      # Exchange rate to base currency
      # e.g., if AUD is base and rate is 0.65 for USD, 1 USD = 0.65 AUD
      t.decimal :rate, precision: 15, scale: 6, null: false

      # Source of rate (for audit)
      t.string :source                    # 'manual', 'xero', 'rba', 'xe'

      t.timestamps
    end

    # Unique constraint: one rate per currency per date per company
    add_index :gl_exchange_rates, [:corporate_company_id, :gl_currency_id, :effective_date],
              unique: true, name: 'idx_gl_exchange_rates_unique'

    # Performance index for date lookups
    add_index :gl_exchange_rates, [:gl_currency_id, :effective_date]
  end
end

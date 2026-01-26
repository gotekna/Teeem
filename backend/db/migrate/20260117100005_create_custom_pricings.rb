# frozen_string_literal: true

# Multi-tenancy Phase 3.5: Create CustomPricing model
# Allows per-customer pricing overrides (vs default tiered %)
class CreateCustomPricings < ActiveRecord::Migration[8.0]
  def change
    create_table :custom_pricings do |t|
      t.references :contact, null: false, foreign_key: true, index: { unique: true }

      # Pricing type: 'default', 'percentage', 'flat_fee', 'per_job'
      t.string :pricing_type, default: 'default', null: false

      # For percentage pricing (overrides tiered %)
      t.decimal :custom_percentage, precision: 5, scale: 2

      # For flat fee pricing (monthly)
      t.decimal :monthly_fee, precision: 10, scale: 2

      # For per-job pricing
      t.decimal :per_job_fee, precision: 10, scale: 2

      # GST handling
      t.boolean :gst_included, default: false

      # Notes about why custom pricing
      t.text :notes

      t.timestamps
    end

    add_index :custom_pricings, :pricing_type
  end
end

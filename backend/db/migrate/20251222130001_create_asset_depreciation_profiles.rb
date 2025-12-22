# World-Class Asset Register - Phase 1: Asset Depreciation Profiles
class CreateAssetDepreciationProfiles < ActiveRecord::Migration[8.0]
  def change
    create_table :asset_depreciation_profiles do |t|
      t.references :asset, null: false, foreign_key: true, index: { unique: true }

      # Cost basis
      t.decimal :depreciable_cost, precision: 14, scale: 2, null: false
      t.decimal :residual_value, precision: 14, scale: 2, default: 0

      # Depreciation methods (book vs tax can differ)
      t.string :book_method, null: false, default: "straight_line"
      t.string :tax_method, null: false, default: "diminishing_value"

      # Effective life
      t.decimal :effective_life_years, precision: 5, scale: 2
      t.decimal :book_rate, precision: 8, scale: 4      # Calculated: 100/life
      t.decimal :tax_rate, precision: 8, scale: 4       # Calculated: 200/life

      # Dates
      t.date :depreciation_start_date, null: false

      # Low-value pool (assets < $1,000)
      t.boolean :in_low_value_pool, default: false
      t.date :pool_entry_date

      # Division 43 (property/buildings)
      t.boolean :is_division_43, default: false
      t.decimal :division_43_rate, precision: 5, scale: 2   # 2.5 or 4.0

      # Instant write-off
      t.boolean :instant_writeoff_applied, default: false
      t.date :instant_writeoff_date

      t.timestamps
    end

    add_index :asset_depreciation_profiles, :book_method
    add_index :asset_depreciation_profiles, :tax_method
  end
end

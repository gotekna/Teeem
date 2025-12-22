# World-Class Asset Register - Phase 1: Asset Depreciation Schedules
class CreateAssetDepreciationSchedules < ActiveRecord::Migration[8.0]
  def change
    create_table :asset_depreciation_schedules do |t|
      t.references :asset, null: false, foreign_key: true

      # Financial year period
      t.string :financial_year, null: false              # "FY2025"
      t.date :period_start, null: false
      t.date :period_end, null: false
      t.integer :days_held, null: false
      t.integer :days_in_year, null: false, default: 365

      # Book depreciation
      t.decimal :book_opening_wdv, precision: 14, scale: 2
      t.decimal :book_depreciation, precision: 14, scale: 2
      t.decimal :book_closing_wdv, precision: 14, scale: 2
      t.decimal :book_accumulated, precision: 14, scale: 2

      # Tax depreciation
      t.decimal :tax_opening_wdv, precision: 14, scale: 2
      t.decimal :tax_depreciation, precision: 14, scale: 2
      t.decimal :tax_closing_wdv, precision: 14, scale: 2
      t.decimal :tax_accumulated, precision: 14, scale: 2

      # Methods used (recorded for audit trail)
      t.string :book_method_applied
      t.string :tax_method_applied

      # Status tracking
      t.string :status, default: "draft"   # draft, calculated, finalized
      t.datetime :finalized_at
      t.references :finalized_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :asset_depreciation_schedules, [:asset_id, :financial_year], unique: true, name: "idx_asset_dep_schedules_asset_fy"
    add_index :asset_depreciation_schedules, [:financial_year, :status], name: "idx_asset_dep_schedules_fy_status"
  end
end

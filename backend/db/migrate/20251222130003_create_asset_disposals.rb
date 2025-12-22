# World-Class Asset Register - Phase 1: Asset Disposals
class CreateAssetDisposals < ActiveRecord::Migration[8.0]
  def change
    create_table :asset_disposals do |t|
      t.references :asset, null: false, foreign_key: true, index: { unique: true }
      t.references :user, null: false, foreign_key: true   # Who recorded disposal

      # Disposal details
      t.date :disposal_date, null: false
      t.date :settlement_date                              # When sale settled
      t.string :disposal_type, null: false                 # sale, trade_in, scrapped, lost, stolen

      # Financial values
      t.decimal :sale_proceeds, precision: 14, scale: 2, default: 0
      t.decimal :disposal_costs, precision: 14, scale: 2, default: 0   # Agent fees, etc.
      t.decimal :net_proceeds, precision: 14, scale: 2                  # Calculated

      # Book values at disposal
      t.decimal :book_wdv_at_disposal, precision: 14, scale: 2, null: false
      t.decimal :tax_wdv_at_disposal, precision: 14, scale: 2, null: false

      # Gain/Loss calculations
      t.decimal :book_gain_loss, precision: 14, scale: 2, null: false
      t.decimal :tax_gain_loss, precision: 14, scale: 2, null: false
      t.decimal :balancing_adjustment, precision: 14, scale: 2           # Tax impact

      # Trade-in details (if applicable)
      t.references :replacement_asset, foreign_key: { to_table: :assets }
      t.decimal :trade_in_value, precision: 14, scale: 2

      t.text :notes

      t.timestamps
    end

    add_index :asset_disposals, :disposal_date
    add_index :asset_disposals, :disposal_type
  end
end

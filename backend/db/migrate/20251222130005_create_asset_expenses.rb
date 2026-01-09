# World-Class Asset Register - Phase 1: Asset Expenses
class CreateAssetExpenses < ActiveRecord::Migration[8.0]
  def change
    create_table :asset_expenses do |t|
      t.references :asset, null: false, foreign_key: true
      t.references :user, foreign_key: true                          # Who recorded it
      t.references :financial_transaction, foreign_key: true         # Link to existing

      t.date :expense_date, null: false
      t.string :expense_type, null: false                            # fuel, repair, registration, toll, parking, insurance, other
      t.decimal :amount, precision: 12, scale: 2, null: false
      t.string :description
      t.string :vendor
      t.string :reference                                            # Receipt/invoice number

      # Xero sync tracking
      t.string :xero_invoice_id
      t.datetime :synced_to_xero_at

      # Active Storage will handle the receipt attachment
      # In model: has_one_attached :receipt

      t.timestamps
    end

    add_index :asset_expenses, [:asset_id, :expense_date], name: "idx_asset_expenses_asset_date"
    add_index :asset_expenses, :expense_type
    add_index :asset_expenses, :xero_invoice_id
  end
end

class CreateXeroChartOfAccounts < ActiveRecord::Migration[8.0]
  def change
    create_table :xero_chart_of_accounts do |t|
      t.references :company_group, foreign_key: true  # Group-level standard COA
      t.string :account_code, null: false
      t.string :account_name, null: false
      t.string :account_type  # Bank, Current Asset, Revenue, etc.
      t.string :tax_type  # GST on Income, BAS Excluded, etc.
      t.text :description
      t.boolean :active, default: true

      t.timestamps
    end
    add_index :xero_chart_of_accounts, [ :company_group_id, :account_code ],
              unique: true, name: 'idx_xero_coa_group_code'
    add_index :xero_chart_of_accounts, :account_code
    add_index :xero_chart_of_accounts, :account_type
    add_index :xero_chart_of_accounts, :active
  end
end

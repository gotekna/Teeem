class CreateAccountMappings < ActiveRecord::Migration[8.0]
  def change
    create_table :account_mappings do |t|
      t.references :accounting_integration, null: false, foreign_key: true
      t.references :keepr_account, null: false, foreign_key: { to_table: :keepr_accounts }

      # External account details
      t.string :external_account_id, null: false
      t.string :external_account_name
      t.string :external_account_code
      t.boolean :is_active, default: true

      t.timestamps
    end

    # Ensure unique mapping per integration
    add_index :account_mappings, [:accounting_integration_id, :keepr_account_id],
              unique: true, name: 'index_account_mappings_uniqueness'
    add_index :account_mappings, :external_account_id
    add_index :account_mappings, :is_active
  end
end

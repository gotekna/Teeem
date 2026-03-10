class CreatePropertySettings < ActiveRecord::Migration[7.1]
  def change
    create_table :property_settings do |t|
      t.bigint :tenant_id, null: false
      t.bigint :xero_credential_id
      t.string :trading_name

      t.timestamps
    end

    add_index :property_settings, :tenant_id, unique: true
    add_index :property_settings, :xero_credential_id
    add_foreign_key :property_settings, :xero_credentials
    add_foreign_key :property_settings, :tenants
  end
end

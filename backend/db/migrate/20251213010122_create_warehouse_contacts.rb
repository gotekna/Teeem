# frozen_string_literal: true

# Creates warehouse_contacts table for storing raw Xero contact data
# This follows the warehouse pattern established by WarehouseBankTransaction
# Contact data syncs to this table first, then optionally links to TEEEM Contact
class CreateWarehouseContacts < ActiveRecord::Migration[8.0]
  def change
    create_table :warehouse_contacts do |t|
      # External identifiers
      t.string :xero_id, null: false
      t.string :tenant_id, null: false
      t.string :source, default: "xero", null: false

      # Denormalized Xero contact data
      t.string :name
      t.string :first_name
      t.string :last_name
      t.string :email_address
      t.string :phone_number
      t.string :abn
      t.string :tax_number
      t.string :account_number
      t.string :contact_status
      t.string :currency_code

      # Contact type flags
      t.boolean :is_customer, default: false
      t.boolean :is_supplier, default: false

      # Addresses and phones (JSONB for flexibility)
      t.jsonb :addresses, default: []
      t.jsonb :phones, default: []

      # Banking details
      t.string :bank_account_details
      t.string :batch_payments_bank_account_name
      t.string :batch_payments_bank_account_number
      t.string :batch_payments_bank_bsb

      # Optional link to TEEEM Contact (for business operations)
      t.references :contact, foreign_key: true, null: true

      # Sync tracking
      t.datetime :xero_updated_at
      t.datetime :last_synced_at
      t.jsonb :raw_data

      t.timestamps

      # Unique constraint on xero_id + tenant_id
      t.index [:xero_id, :tenant_id], unique: true, name: "idx_warehouse_contacts_xero_tenant"
      t.index :tenant_id
      t.index :contact_id
      t.index :email_address
      t.index :name
      t.index [:is_customer, :tenant_id], name: "idx_warehouse_contacts_customers"
      t.index [:is_supplier, :tenant_id], name: "idx_warehouse_contacts_suppliers"
    end
  end
end

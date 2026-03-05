class CreatePropertyBills < ActiveRecord::Migration[8.0]
  def change
    create_table :property_bills do |t|
      t.bigint :tenant_id, null: false
      t.references :property, null: false, foreign_key: true
      t.references :tenancy, foreign_key: true

      t.string :bill_type, null: false # cleaning, maintenance, utilities, insurance, rates, body_corporate, other
      t.string :description
      t.decimal :amount, precision: 10, scale: 2, null: false
      t.decimal :tax_amount, precision: 10, scale: 2, default: 0
      t.date :bill_date, null: false
      t.date :due_date
      t.string :charge_to, null: false, default: "owner" # owner, tenant, government_ndis
      t.string :status, null: false, default: "draft" # draft, approved, invoiced, paid

      t.bigint :gl_invoice_id # FK to Gl::Invoice when invoiced
      t.references :supplier_contact, foreign_key: { to_table: :contacts }

      t.text :notes
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :property_bills, :tenant_id
    add_index :property_bills, :bill_type
    add_index :property_bills, :status
    add_index :property_bills, :charge_to
    add_index :property_bills, [:property_id, :status]
  end
end

class CreateNdisClaims < ActiveRecord::Migration[7.1]
  def change
    create_table :ndis_claims do |t|
      t.bigint :tenant_id, null: false
      t.references :property, null: false, foreign_key: true
      t.references :tenancy, null: false, foreign_key: true
      t.references :contact, foreign_key: true  # SDA participant

      t.string :ndis_participant_number
      t.string :service_booking_number
      t.date :claim_period_start, null: false
      t.date :claim_period_end, null: false
      t.string :support_item_number    # SDA line item code
      t.decimal :quantity, precision: 6, scale: 2   # days
      t.decimal :unit_price, precision: 10, scale: 2  # daily rate
      t.decimal :total_amount, precision: 10, scale: 2
      t.decimal :gst_amount, precision: 10, scale: 2
      t.string :status, default: "draft"
      t.string :ndia_reference
      t.text :rejection_reason
      t.string :rejection_code
      t.datetime :submitted_at
      t.datetime :approved_at
      t.datetime :paid_at
      t.decimal :paid_amount, precision: 10, scale: 2
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :ndis_claims, :tenant_id
    add_index :ndis_claims, [:property_id, :claim_period_start]
    add_index :ndis_claims, :status
    add_index :ndis_claims, :ndia_reference, unique: true, where: "ndia_reference IS NOT NULL"
  end
end

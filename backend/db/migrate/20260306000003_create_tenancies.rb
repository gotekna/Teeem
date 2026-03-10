class CreateTenancies < ActiveRecord::Migration[8.0]
  def change
    create_table :tenancies do |t|
      t.bigint :tenant_id, null: false
      t.references :property, null: false, foreign_key: true

      # Tenancy details
      t.string :tenancy_type, null: false, default: "fixed_term" # fixed_term, periodic, sda
      t.string :status, null: false, default: "draft" # draft, active, expiring, expired, terminated

      t.date :start_date, null: false
      t.date :end_date
      t.integer :lease_term_months

      # Rent
      t.decimal :weekly_rent, precision: 10, scale: 2, null: false
      t.string :rent_frequency, null: false, default: "weekly" # weekly, fortnightly, monthly
      t.decimal :bond_amount, precision: 10, scale: 2
      t.boolean :bond_lodged, default: false, null: false
      t.string :bond_reference

      # SDA-specific fields
      t.references :sda_participant_contact, foreign_key: { to_table: :contacts }
      t.string :sda_plan_number # NDIS plan reference
      t.decimal :sda_weekly_rate, precision: 10, scale: 2 # From NDIS price guide
      t.decimal :participant_rent_contribution, precision: 10, scale: 2 # Capped at 25% DSP + CRA
      t.decimal :ndia_payment_amount, precision: 10, scale: 2 # sda_weekly_rate - participant_contribution

      # Recurring invoice links (GL module)
      t.bigint :rent_recurring_invoice_id
      t.bigint :sda_recurring_invoice_id

      t.text :notes
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :tenancies, :tenant_id
    add_index :tenancies, :status
    add_index :tenancies, :tenancy_type
    add_index :tenancies, [:property_id, :status]
    add_index :tenancies, :start_date
    add_index :tenancies, :end_date
  end
end

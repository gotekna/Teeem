class CreateSaasBillingRecords < ActiveRecord::Migration[8.0]
  def change
    create_table :saas_billing_records do |t|
      t.references :contact, null: false, foreign_key: true  # The SaaS customer
      t.date :billing_period_start, null: false
      t.date :billing_period_end, null: false
      t.decimal :turnover_reported, precision: 15, scale: 2
      t.decimal :fee_calculated, precision: 12, scale: 2
      t.decimal :effective_rate, precision: 5, scale: 4
      t.string :status, default: 'pending'  # pending, invoiced, paid
      t.references :gl_invoice, foreign_key: { to_table: :gl_invoices }, null: true
      t.jsonb :tier_breakdown, default: {}  # Store tier calculations

      t.timestamps
    end

    add_index :saas_billing_records, :status
    add_index :saas_billing_records, [:billing_period_start, :billing_period_end], name: 'index_saas_billing_on_period'
  end
end

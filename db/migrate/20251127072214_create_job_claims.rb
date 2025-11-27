class CreateJobClaims < ActiveRecord::Migration[8.0]
  def change
    create_table :job_claims do |t|
      t.references :job, null: false, foreign_key: true
      t.string :invoice_number
      t.text :description
      t.decimal :amount, precision: 15, scale: 2
      t.decimal :amount_paid, precision: 15, scale: 2, default: 0
      t.decimal :amount_due, precision: 15, scale: 2
      t.string :status, default: 'draft'
      t.date :date
      t.date :due_date
      t.string :xero_invoice_id
      t.string :xero_contact_id
      t.string :contact_name
      t.references :contact, foreign_key: true, null: true

      t.timestamps
    end

    add_index :job_claims, :xero_invoice_id, unique: true
    add_index :job_claims, :invoice_number
    add_index :job_claims, :status
  end
end

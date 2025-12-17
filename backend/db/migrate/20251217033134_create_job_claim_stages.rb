class CreateJobClaimStages < ActiveRecord::Migration[8.0]
  def change
    create_table :job_claim_stages do |t|
      t.references :job, null: false, foreign_key: true
      t.references :claim_stage_template, foreign_key: true
      t.references :external_invoice, foreign_key: true
      t.string :name, null: false
      t.decimal :percentage, precision: 5, scale: 2
      t.decimal :expected_amount, precision: 12, scale: 2
      t.integer :sequence_order, default: 0, null: false
      t.string :description

      # Matching status
      t.string :match_status, default: "unmatched", null: false
      t.datetime :matched_at

      # Payment tracking (denormalized from ExternalInvoice)
      t.string :payment_status, default: "pending", null: false
      t.decimal :amount_invoiced, precision: 12, scale: 2, default: 0
      t.decimal :amount_paid, precision: 12, scale: 2, default: 0
      t.date :payment_date

      # Customization flag
      t.boolean :is_custom, default: false, null: false
      t.timestamps

      t.index [:job_id, :sequence_order], name: "idx_job_claim_stages_ordering"
      t.index [:job_id, :external_invoice_id], name: "idx_job_claim_stages_invoice", unique: true
      t.index :match_status
      t.index :payment_status
    end
  end
end

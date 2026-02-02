# frozen_string_literal: true

class CreateGlProgressClaims < ActiveRecord::Migration[7.1]
  def change
    create_table :gl_progress_claims do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :invoice, foreign_key: { to_table: :gl_invoices }
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :approved_by, foreign_key: { to_table: :users }

      # Claim identification
      t.string :claim_number, null: false
      t.integer :claim_sequence, null: false, default: 1  # Claim #1, #2, etc.
      t.date :claim_date, null: false
      t.date :period_from
      t.date :period_to

      # Values
      t.decimal :contract_value, precision: 15, scale: 2, null: false
      t.decimal :variations_approved, precision: 15, scale: 2, default: 0
      t.decimal :adjusted_contract_value, precision: 15, scale: 2  # contract + variations

      # Progress
      t.decimal :previous_claimed_pct, precision: 5, scale: 2, default: 0  # Previous claims %
      t.decimal :this_claim_pct, precision: 5, scale: 2, null: false  # This claim %
      t.decimal :total_claimed_pct, precision: 5, scale: 2  # Cumulative %

      t.decimal :previous_claimed_amount, precision: 15, scale: 2, default: 0
      t.decimal :this_claim_amount, precision: 15, scale: 2, null: false
      t.decimal :total_claimed_amount, precision: 15, scale: 2

      # Retainage (retention held by client)
      t.decimal :retainage_pct, precision: 5, scale: 2, default: 0
      t.decimal :retainage_amount, precision: 15, scale: 2, default: 0
      t.decimal :retainage_released, precision: 15, scale: 2, default: 0

      # GST
      t.decimal :gst_amount, precision: 15, scale: 2, default: 0

      # Final amounts
      t.decimal :net_claim_amount, precision: 15, scale: 2  # This claim - retainage
      t.decimal :total_payable, precision: 15, scale: 2  # Net + GST

      # Status
      t.string :status, null: false, default: "draft", limit: 20
      t.datetime :submitted_at
      t.datetime :approved_at
      t.datetime :certified_at
      t.text :notes

      t.timestamps
    end

    add_index :gl_progress_claims, [:corporate_id, :job_id, :claim_sequence],
              unique: true, name: "idx_progress_claims_sequence"
    add_index :gl_progress_claims, [:corporate_id, :claim_number],
              unique: true, name: "idx_progress_claims_number"
    add_index :gl_progress_claims, [:status], name: "idx_progress_claims_status"

    # Progress claim line items (for detailed breakdown)
    create_table :gl_progress_claim_lines do |t|
      t.references :progress_claim, null: false, foreign_key: { to_table: :gl_progress_claims }

      t.string :description, null: false
      t.string :category  # e.g., "Preliminaries", "Structure", "Finishes"
      t.integer :sort_order, default: 0

      # Values
      t.decimal :contract_value, precision: 15, scale: 2, null: false
      t.decimal :previous_pct, precision: 5, scale: 2, default: 0
      t.decimal :this_pct, precision: 5, scale: 2, null: false
      t.decimal :total_pct, precision: 5, scale: 2
      t.decimal :this_claim_amount, precision: 15, scale: 2

      t.timestamps
    end

    add_index :gl_progress_claim_lines, [:progress_claim_id, :sort_order], name: "idx_progress_claim_lines_sort"
  end
end

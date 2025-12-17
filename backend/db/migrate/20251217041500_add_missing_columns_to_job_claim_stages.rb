# frozen_string_literal: true

class AddMissingColumnsToJobClaimStages < ActiveRecord::Migration[8.0]
  def change
    # Add missing columns to job_claim_stages
    add_reference :job_claim_stages, :job, null: false, foreign_key: true unless column_exists?(:job_claim_stages, :job_id)
    add_reference :job_claim_stages, :claim_stage_template, foreign_key: true unless column_exists?(:job_claim_stages, :claim_stage_template_id)
    add_reference :job_claim_stages, :external_invoice, foreign_key: true unless column_exists?(:job_claim_stages, :external_invoice_id)

    unless column_exists?(:job_claim_stages, :name)
      add_column :job_claim_stages, :name, :string, null: false
    end

    unless column_exists?(:job_claim_stages, :percentage)
      add_column :job_claim_stages, :percentage, :decimal, precision: 5, scale: 2
    end

    unless column_exists?(:job_claim_stages, :expected_amount)
      add_column :job_claim_stages, :expected_amount, :decimal, precision: 12, scale: 2
    end

    unless column_exists?(:job_claim_stages, :sequence_order)
      add_column :job_claim_stages, :sequence_order, :integer, default: 0, null: false
    end

    unless column_exists?(:job_claim_stages, :description)
      add_column :job_claim_stages, :description, :string
    end

    unless column_exists?(:job_claim_stages, :match_status)
      add_column :job_claim_stages, :match_status, :string, default: "unmatched", null: false
    end

    unless column_exists?(:job_claim_stages, :matched_at)
      add_column :job_claim_stages, :matched_at, :datetime
    end

    unless column_exists?(:job_claim_stages, :payment_status)
      add_column :job_claim_stages, :payment_status, :string, default: "pending", null: false
    end

    unless column_exists?(:job_claim_stages, :amount_invoiced)
      add_column :job_claim_stages, :amount_invoiced, :decimal, precision: 12, scale: 2, default: 0
    end

    unless column_exists?(:job_claim_stages, :amount_paid)
      add_column :job_claim_stages, :amount_paid, :decimal, precision: 12, scale: 2, default: 0
    end

    unless column_exists?(:job_claim_stages, :payment_date)
      add_column :job_claim_stages, :payment_date, :date
    end

    unless column_exists?(:job_claim_stages, :is_custom)
      add_column :job_claim_stages, :is_custom, :boolean, default: false, null: false
    end

    # Add indexes if they don't exist
    unless index_exists?(:job_claim_stages, [:job_id, :sequence_order])
      add_index :job_claim_stages, [:job_id, :sequence_order], name: "idx_job_claim_stages_ordering"
    end

    unless index_exists?(:job_claim_stages, [:job_id, :external_invoice_id])
      add_index :job_claim_stages, [:job_id, :external_invoice_id], name: "idx_job_claim_stages_invoice", unique: true
    end

    unless index_exists?(:job_claim_stages, :match_status)
      add_index :job_claim_stages, :match_status
    end

    unless index_exists?(:job_claim_stages, :payment_status)
      add_index :job_claim_stages, :payment_status
    end
  end
end

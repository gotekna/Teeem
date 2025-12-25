class AddRetainageToJobClaimStages < ActiveRecord::Migration[8.0]
  def change
    # Add retainage tracking to job claim stages
    # Retainage (also called retention) is a portion withheld until project completion
    # Common in construction contracts (typically 5-10%)

    add_column :job_claim_stages, :retainage_percentage, :decimal, precision: 5, scale: 2, default: 0
    add_column :job_claim_stages, :retainage_amount, :decimal, precision: 15, scale: 2, default: 0
    add_column :job_claim_stages, :retainage_released_at, :datetime
    add_reference :job_claim_stages, :retainage_release_invoice, foreign_key: { to_table: :gl_invoices }, null: true

    # Also add to jobs table to set default retainage for new stages
    add_column :jobs, :default_retainage_percentage, :decimal, precision: 5, scale: 2, default: 0

    # Add index for querying unreleased retainage
    add_index :job_claim_stages, :retainage_released_at, where: "retainage_amount > 0 AND retainage_released_at IS NULL", name: "idx_unreleased_retainage"
  end
end

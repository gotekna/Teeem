class AddClaimSequenceNumberToJobClaimStages < ActiveRecord::Migration[8.0]
  def change
    add_column :job_claim_stages, :claim_sequence_number, :integer
  end
end

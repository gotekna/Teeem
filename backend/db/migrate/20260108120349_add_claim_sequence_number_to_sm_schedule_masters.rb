class AddClaimSequenceNumberToSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_schedule_masters, :claim_sequence_number, :integer
  end
end

class AddJobClaimStageToSmTasks < ActiveRecord::Migration[8.0]
  def change
    # nullable - only claim tasks have this link
    add_reference :sm_tasks, :job_claim_stage, null: true, foreign_key: true
  end
end

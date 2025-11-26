class AddJobStageToJobs < ActiveRecord::Migration[8.0]
  def change
    add_reference :jobs, :job_stage, null: true, foreign_key: true
  end
end

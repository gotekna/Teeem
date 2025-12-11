class AddJobStageIdToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :job_stage_id, :integer
    add_index :jobs, :job_stage_id
    add_foreign_key :jobs, :job_stages, column: :job_stage_id, on_delete: :nullify
  end
end

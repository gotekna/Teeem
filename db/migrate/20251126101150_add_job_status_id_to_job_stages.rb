class AddJobStatusIdToJobStages < ActiveRecord::Migration[8.0]
  def change
    add_column :job_stages, :job_status_id, :integer
    add_index :job_stages, :job_status_id
    add_foreign_key :job_stages, :job_statuses, column: :job_status_id, on_delete: :nullify
  end
end

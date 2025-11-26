class AddJobStatusIdToJobStages < ActiveRecord::Migration[8.0]
  def change
    # Column and index already exist from manual migration run
    # Only add if they don't exist
    unless column_exists?(:job_stages, :job_status_id)
      add_column :job_stages, :job_status_id, :integer
    end
    unless index_exists?(:job_stages, :job_status_id)
      add_index :job_stages, :job_status_id
    end
  end
end

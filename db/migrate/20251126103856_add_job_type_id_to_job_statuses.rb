class AddJobTypeIdToJobStatuses < ActiveRecord::Migration[8.0]
  def change
    # Only run if job_statuses table exists (may not exist in all environments)
    return unless table_exists?(:job_statuses)

    unless column_exists?(:job_statuses, :job_type_id)
      add_column :job_statuses, :job_type_id, :integer
    end
    unless index_exists?(:job_statuses, :job_type_id)
      add_index :job_statuses, :job_type_id
    end
  end
end

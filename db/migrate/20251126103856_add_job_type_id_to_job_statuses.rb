class AddJobTypeIdToJobStatuses < ActiveRecord::Migration[8.0]
  def change
    # Table is named job_status (singular), not job_statuses
    return unless table_exists?(:job_status)

    unless column_exists?(:job_status, :job_type_id)
      add_column :job_status, :job_type_id, :integer
    end
    unless index_exists?(:job_status, :job_type_id)
      add_index :job_status, :job_type_id
    end
  end
end

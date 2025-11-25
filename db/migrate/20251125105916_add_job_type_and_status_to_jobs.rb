class AddJobTypeAndStatusToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :job_type_id, :bigint
    add_column :jobs, :job_status_id, :bigint

    add_index :jobs, :job_type_id
    add_index :jobs, :job_status_id

    add_foreign_key :jobs, :job_types, on_delete: :nullify
    add_foreign_key :jobs, :job_statuses, on_delete: :nullify
  end
end

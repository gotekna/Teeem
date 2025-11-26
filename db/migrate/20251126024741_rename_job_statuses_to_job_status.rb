class RenameJobStatusesToJobStatus < ActiveRecord::Migration[8.0]
  def change
    rename_table :job_statuses, :job_status
  end
end

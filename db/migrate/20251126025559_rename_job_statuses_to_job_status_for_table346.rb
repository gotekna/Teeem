class RenameJobStatusesToJobStatusForTable346 < ActiveRecord::Migration[8.0]
  def change
    # The primary key constraint is already named job_status_pkey due to custom sequence naming
    # So we just rename the table directly with execute to avoid Rails trying to rename the constraint
    execute "ALTER TABLE job_statuses RENAME TO job_status"
  end
end

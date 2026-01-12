class RenameErrorsToErrorDetailsInBackgroundJobProgress < ActiveRecord::Migration[8.0]
  def change
    rename_column :background_job_progress, :errors, :error_details
  end
end

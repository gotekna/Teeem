class RemoveUnusedColumnsFromJobs < ActiveRecord::Migration[8.0]
  def change
    remove_column :jobs, :design_name, :string
    remove_column :jobs, :design_id, :bigint
    remove_column :jobs, :ted_number, :string
    remove_column :jobs, :site_supervisor_email, :string
    remove_column :jobs, :onedrive_folders_created_at, :datetime
    remove_column :jobs, :job_stage_id, :bigint
    remove_column :jobs, :stage, :string
  end
end

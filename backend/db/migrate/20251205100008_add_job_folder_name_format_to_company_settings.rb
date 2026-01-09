class AddJobFolderNameFormatToCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :company_settings, :job_folder_name_format, :jsonb
  end
end

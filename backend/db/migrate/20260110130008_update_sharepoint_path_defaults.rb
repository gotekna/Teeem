class UpdateSharepointPathDefaults < ActiveRecord::Migration[8.0]
  def up
    # Update existing data: Change "TEEEM Jobs" to "Jobs"
    execute <<-SQL
      UPDATE corporate_company_settings
      SET sharepoint_jobs_path = 'Jobs'
      WHERE sharepoint_jobs_path = 'TEEEM Jobs';
    SQL

    execute <<-SQL
      UPDATE corporate_company_settings
      SET job_documents_base_path = 'Jobs'
      WHERE job_documents_base_path = 'TEEEM Jobs';
    SQL

    execute <<-SQL
      UPDATE corporate_company_settings
      SET sharepoint_company_path = 'Corporate'
      WHERE sharepoint_company_path = '00 TEEEM PRIVATE';
    SQL

    # Change column defaults
    change_column_default :corporate_settings, :sharepoint_jobs_path, from: "TEEEM Jobs", to: "Jobs"
    change_column_default :corporate_settings, :job_documents_base_path, from: "TEEEM Jobs", to: "Jobs"
  end

  def down
    # Revert column defaults
    change_column_default :corporate_settings, :sharepoint_jobs_path, from: "Jobs", to: "TEEEM Jobs"
    change_column_default :corporate_settings, :job_documents_base_path, from: "Jobs", to: "TEEEM Jobs"

    # Don't revert data - would lose user customizations
  end
end

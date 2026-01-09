class UpdateSharePointPathsToTeeem < ActiveRecord::Migration[8.0]
  def up
    # Update document_folders to use /Teeem prefix (SSoT)
    execute <<-SQL
      UPDATE document_folders
      SET sharepoint_path = REPLACE(sharepoint_path, '/Corporate/', '/Teeem/Companies/')
      WHERE sharepoint_path LIKE '/Corporate/%';
    SQL

    # Update corporate_company_settings base paths to use /Teeem prefix (SSoT)
    execute <<-SQL
      UPDATE corporate_company_settings
      SET company_documents_base_path = '/Teeem/Companies'
      WHERE company_documents_base_path = '00 TEEEM PRIVATE' OR company_documents_base_path IS NULL;
    SQL

    execute <<-SQL
      UPDATE corporate_company_settings
      SET people_documents_base_path = '/Teeem/Director IDs'
      WHERE people_documents_base_path LIKE '%Corporate/People%' OR people_documents_base_path IS NULL;
    SQL

    execute <<-SQL
      UPDATE corporate_company_settings
      SET job_documents_base_path = '/Teeem/Jobs'
      WHERE job_documents_base_path = 'TEEEM Jobs' OR job_documents_base_path IS NULL;
    SQL
  end

  def down
    # Revert to old paths if needed
    execute <<-SQL
      UPDATE document_folders
      SET sharepoint_path = REPLACE(sharepoint_path, '/Teeem/Companies/', '/Corporate/')
      WHERE sharepoint_path LIKE '/Teeem/Companies/%';
    SQL

    execute <<-SQL
      UPDATE corporate_company_settings
      SET company_documents_base_path = '00 TEEEM PRIVATE'
      WHERE company_documents_base_path = '/Teeem/Companies';
    SQL

    execute <<-SQL
      UPDATE corporate_company_settings
      SET people_documents_base_path = 'teeem/Corporate/People'
      WHERE people_documents_base_path = '/Teeem/Director IDs';
    SQL

    execute <<-SQL
      UPDATE corporate_company_settings
      SET job_documents_base_path = 'TEEEM Jobs'
      WHERE job_documents_base_path = '/Teeem/Jobs';
    SQL
  end
end

class UpdateSharePointPathTemplateToTeeem < ActiveRecord::Migration[8.0]
  def up
    # SSoT Consolidation: Update company path template to use /Teeem/Companies/
    # This is the Single Source of Truth - folder paths are computed from this template
    execute <<-SQL
      UPDATE system_settings
      SET setting_value = '/Teeem/Companies/{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}'
      WHERE setting_key = 'sharepoint_path_template_company';
    SQL

    # Update People path to match new structure
    execute <<-SQL
      UPDATE system_settings
      SET setting_value = '/Teeem/People/{{ContactName}}'
      WHERE setting_key = 'sharepoint_path_template_people';
    SQL

    # Insert if doesn't exist (for fresh installs)
    execute <<-SQL
      INSERT INTO system_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
      SELECT 'sharepoint_path_template_company', '/Teeem/Companies/{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}', 'string', 'SharePoint path template for company documents (SSoT)', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'sharepoint_path_template_company');
    SQL

    execute <<-SQL
      INSERT INTO system_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
      SELECT 'sharepoint_path_template_people', '/Teeem/People/{{ContactName}}', 'string', 'SharePoint path template for people documents', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'sharepoint_path_template_people');
    SQL

    execute <<-SQL
      INSERT INTO system_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
      SELECT 'sharepoint_path_template_job', '/Teeem/Jobs/{{JobCode}}/{{Category}}', 'string', 'SharePoint path template for job documents', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'sharepoint_path_template_job');
    SQL
  end

  def down
    execute <<-SQL
      UPDATE system_settings
      SET setting_value = '/Corporate/{{CompanyGroup}}{{CompanyCode}}/{{Folder}}'
      WHERE setting_key = 'sharepoint_path_template_company';
    SQL
  end
end

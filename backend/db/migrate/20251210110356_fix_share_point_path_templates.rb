class FixSharePointPathTemplates < ActiveRecord::Migration[8.0]
  def up
    # Fix company path - add missing slash between placeholders
    execute <<-SQL
      UPDATE system_settings
      SET setting_value = '/Corporate/{{CompanyCode}}/{{Folder}}'
      WHERE setting_key = 'sharepoint_path_template_company';
    SQL

    # Fix job path - add missing slash
    execute <<-SQL
      UPDATE system_settings
      SET setting_value = '/Jobs/{{JobCode}}/{{Category}}'
      WHERE setting_key = 'sharepoint_path_template_job';
    SQL

    # Fix people path
    execute <<-SQL
      UPDATE system_settings
      SET setting_value = '/Contacts/{{ContactName}}'
      WHERE setting_key = 'sharepoint_path_template_people';
    SQL

    # Fix xero path
    execute <<-SQL
      UPDATE system_settings
      SET setting_value = '/Corporate/XERO Auto'
      WHERE setting_key = 'sharepoint_path_template_xero';
    SQL
  end

  def down
    # Revert to old values if needed
    execute <<-SQL
      UPDATE system_settings
      SET setting_value = '/Teeem/Companies/{{CompanyCode}}/{{Folder}}'
      WHERE setting_key = 'sharepoint_path_template_company';
    SQL
  end
end

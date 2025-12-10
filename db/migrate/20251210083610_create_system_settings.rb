class CreateSystemSettings < ActiveRecord::Migration[8.0]
  def change
    create_table :system_settings do |t|
      t.string :setting_key, null: false
      t.text :setting_value
      t.string :setting_type, default: "string"
      t.text :description
      t.timestamps
    end

    add_index :system_settings, :setting_key, unique: true

    # Seed default SharePoint folder path templates
    reversible do |dir|
      dir.up do
        execute <<-SQL
          INSERT INTO system_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
          VALUES
            ('sharepoint_path_template_company', '/Corporate/{{CompanyCode}}/{{Folder}}', 'string', 'SharePoint folder path template for company documents', NOW(), NOW()),
            ('sharepoint_path_template_job', '/Jobs/{{JobCode}}/{{Category}}', 'string', 'SharePoint folder path template for job documents', NOW(), NOW()),
            ('sharepoint_path_template_people', '/Contacts/{{ContactName}}', 'string', 'SharePoint folder path template for people documents', NOW(), NOW()),
            ('sharepoint_path_template_xero', '/Corporate/XERO Auto', 'string', 'SharePoint folder path template for XERO auto documents', NOW(), NOW());
        SQL
      end
    end
  end
end

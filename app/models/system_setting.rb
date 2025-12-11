# System-wide application settings stored as key-value pairs
#
# This model provides a flexible way to store application-wide settings
# that can be modified through the UI without requiring code changes.
#
# Usage:
#   SystemSetting.get('sharepoint_path_template_company')
#   SystemSetting.set('sharepoint_path_template_company', '/Teeem/Companies/{{CompanyCode}}/{{Folder}}')
#
class SystemSetting < ApplicationRecord
  validates :setting_key, presence: true, uniqueness: true
  validates :setting_type, inclusion: { in: %w[string integer boolean json] }

  # Get a setting value by key
  # Returns nil if not found
  def self.get(key)
    setting = find_by(setting_key: key)
    return nil unless setting

    case setting.setting_type
    when "integer"
      setting.setting_value.to_i
    when "boolean"
      setting.setting_value == "true"
    when "json"
      JSON.parse(setting.setting_value) rescue nil
    else
      setting.setting_value
    end
  end

  # Set a setting value by key
  # Creates the setting if it doesn't exist
  def self.set(key, value, type: "string", description: nil)
    setting = find_or_initialize_by(setting_key: key)
    setting.setting_value = value.to_s
    setting.setting_type = type
    setting.description = description if description
    setting.save!
    setting
  end

  # Get all SharePoint path templates
  def self.sharepoint_path_templates
    {
      company: get("sharepoint_path_template_company") || "/Corporate/{{CompanyCode}}/{{Folder}}",
      job: get("sharepoint_path_template_job") || "/Jobs/{{JobCode}}/{{Category}}",
      people: get("sharepoint_path_template_people") || "/Contacts/{{ContactName}}"
    }
  end

  # Update SharePoint path templates
  def self.update_sharepoint_path_templates(templates)
    set("sharepoint_path_template_company", templates[:company]) if templates[:company]
    set("sharepoint_path_template_job", templates[:job]) if templates[:job]
    set("sharepoint_path_template_people", templates[:people]) if templates[:people]
  end
end

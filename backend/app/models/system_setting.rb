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

  # ============================================================================
  # DEPRECATED: SharePoint Methods - Use CorporateCompanySetting instead
  # ============================================================================
  # These methods are deprecated and will be removed in a future version.
  # The SSoT for SharePoint configuration is now CorporateCompanySetting.
  # ============================================================================

  # DEPRECATED: Use CorporateCompanySetting.sharepoint_config[:templates] instead
  def self.sharepoint_path_templates
    Rails.logger.warn "[DEPRECATED] SystemSetting.sharepoint_path_templates is deprecated. Use CorporateCompanySetting.sharepoint_config instead."
    config = CorporateCompanySetting.sharepoint_config
    {
      company: "#{config[:root_path]}/#{config[:paths][:company]}/#{config[:templates][:company]}".gsub(/\/+/, "/"),
      job: "#{config[:root_path]}/#{config[:paths][:jobs]}/#{config[:templates][:job]}".gsub(/\/+/, "/"),
      people: "#{config[:root_path]}/#{config[:paths][:people]}/#{config[:templates][:people]}".gsub(/\/+/, "/")
    }
  end

  # DEPRECATED: Use CorporateCompanySetting.company_path or job_path instead
  def self.compute_folder_path(folder, scope: :company)
    Rails.logger.warn "[DEPRECATED] SystemSetting.compute_folder_path is deprecated. Use CorporateCompanySetting path methods instead."
    template = sharepoint_path_templates[scope]
    return nil unless template

    folder_path = build_folder_hierarchy_path(folder)
    template.gsub("{{Folder}}", folder_path)
  end

  # Build folder path from hierarchy (e.g., "Xero/BankStatements" for a sub-folder)
  def self.build_folder_hierarchy_path(folder)
    return folder.name unless folder.respond_to?(:parent) && folder.parent

    parts = []
    current = folder
    while current
      parts.unshift(current.name.gsub(/\s+/, "")) # Remove spaces for path
      current = current.respond_to?(:parent) ? current.parent : nil
    end
    parts.join("/")
  end

  # DEPRECATED: Use CorporateCompanySetting API PATCH /api/v1/corporate_company_settings/sharepoint
  def self.update_sharepoint_path_templates(templates)
    Rails.logger.warn "[DEPRECATED] SystemSetting.update_sharepoint_path_templates is deprecated. Use CorporateCompanySetting instead."
    # For backwards compatibility, update CorporateCompanySetting
    setting = CorporateCompanySetting.instance

    # Extract template parts from full paths (if provided as full paths)
    if templates[:company]
      template_part = extract_template_suffix(templates[:company])
      setting.sharepoint_company_template = template_part if template_part
    end
    if templates[:job]
      template_part = extract_template_suffix(templates[:job])
      setting.sharepoint_job_template = template_part if template_part
    end
    if templates[:people]
      template_part = extract_template_suffix(templates[:people])
      setting.sharepoint_people_template = template_part if template_part
    end

    setting.save!
  end

  # Helper to extract template suffix from a full path
  def self.extract_template_suffix(full_path)
    # Try to extract the placeholder part
    if full_path =~ /(\{\{[^}]+\}\}.*)/
      return $1
    end
    nil
  end
end

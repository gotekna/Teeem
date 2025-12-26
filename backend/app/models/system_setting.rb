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

    # Extract base path and template parts from full paths
    if templates[:company]
      base_path, template_part = extract_path_parts(templates[:company])
      setting.sharepoint_company_path = base_path if base_path.present?
      setting.sharepoint_company_template = template_part if template_part.present?
    end
    if templates[:job]
      base_path, template_part = extract_path_parts(templates[:job])
      setting.sharepoint_jobs_path = base_path if base_path.present?
      setting.sharepoint_job_template = template_part if template_part.present?
    end
    if templates[:people]
      base_path, template_part = extract_path_parts(templates[:people])
      setting.sharepoint_people_path = base_path if base_path.present?
      setting.sharepoint_people_template = template_part if template_part.present?
    end

    setting.save!
  end

  # Helper to extract base path and template from a full path
  # e.g., "/Jobs/{{JobCode}}/{{Category}}" => ["Jobs", "{{JobCode}}/{{Category}}"]
  def self.extract_path_parts(full_path)
    return [nil, nil] if full_path.blank?

    # Find the index of the first placeholder
    placeholder_index = full_path.index('{{')
    if placeholder_index
      # Find the last slash before the first placeholder
      base_portion = full_path[0...placeholder_index]
      last_slash = base_portion.rindex('/')

      if last_slash
        base_path = full_path[0...last_slash]
        template_part = full_path[(last_slash + 1)..]
      else
        # No slash before placeholder - entire string is template
        base_path = nil
        template_part = full_path
      end

      # Remove leading slash for storage (CorporateCompanySetting stores relative paths)
      base_path = base_path.sub(/^\//, '') if base_path.present?
      base_path = nil if base_path.blank?

      return [base_path, template_part]
    end

    # No placeholders found - treat whole thing as base path
    [full_path.sub(/^\//, ''), nil]
  end

  # DEPRECATED: Kept for backwards compatibility
  def self.extract_template_suffix(full_path)
    _, template = extract_path_parts(full_path)
    template
  end
end

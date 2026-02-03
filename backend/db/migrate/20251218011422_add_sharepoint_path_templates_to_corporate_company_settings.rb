class AddSharepointPathTemplatesToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    # Path templates define how documents are organized within each scope folder
    # Templates use placeholders like {{JobCode}}, {{Category}}, {{CompanyCode}}, etc.
    # Full path = root_path + scope_path + resolved_template
    # e.g., /Shared Documents/TEEEM Jobs/JOB-001/Plans
    add_column :corporate_settings, :sharepoint_job_template, :string,
               default: "{{JobCode}}/{{Category}}"
    add_column :corporate_settings, :sharepoint_company_template, :string,
               default: "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}"
    add_column :corporate_settings, :sharepoint_people_template, :string,
               default: "{{ContactName}}/{{Category}}"
    add_column :corporate_settings, :sharepoint_contacts_template, :string,
               default: "{{ContactName}}/{{Category}}"

    # Data migration: If SystemSetting has existing templates, migrate them
    reversible do |dir|
      dir.up do
        # Only run if SystemSetting table exists (may not in fresh installs)
        if ActiveRecord::Base.connection.table_exists?(:system_settings)
          migrate_from_system_settings
        end
      end
    end
  end

  private

  def migrate_from_system_settings
    # Get existing templates from SystemSetting (if any)
    existing_job = SystemSetting.get("sharepoint_path_template_job")
    existing_company = SystemSetting.get("sharepoint_path_template_company")
    existing_people = SystemSetting.get("sharepoint_path_template_people")

    return unless existing_job || existing_company || existing_people

    # Extract just the template suffix from full paths
    # e.g., "/Teeem/Jobs/{{JobCode}}/{{Category}}" -> "{{JobCode}}/{{Category}}"
    setting = CorporateCompanySetting.instance

    if existing_job.present?
      # Extract template part (everything after the base folder)
      template_part = extract_template_part(existing_job, %w[Jobs TEEEM\ Jobs])
      setting.sharepoint_job_template = template_part if template_part.present?
    end

    if existing_company.present?
      template_part = extract_template_part(existing_company, %w[Companies 00\ TEEEM\ PRIVATE])
      setting.sharepoint_company_template = template_part if template_part.present?
    end

    if existing_people.present?
      template_part = extract_template_part(existing_people, %w[People Corporate/People])
      setting.sharepoint_people_template = template_part if template_part.present?
    end

    setting.save! if setting.changed?
  rescue => e
    # Don't fail migration if data migration fails
    Rails.logger.warn "[Migration] Failed to migrate SystemSetting templates: #{e.message}"
  end

  def extract_template_part(full_path, base_folder_patterns)
    # Try to find and remove the base folder from the path
    base_folder_patterns.each do |pattern|
      if full_path.include?(pattern)
        parts = full_path.split(pattern)
        return parts.last.sub(/^\//, '') if parts.length > 1
      end
    end
    # If no pattern matched, try to extract the placeholder portion
    # Look for first {{placeholder}}
    if full_path =~ /(\{\{[^}]+\}\}.*)/
      return $1
    end
    nil
  end
end

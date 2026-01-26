# frozen_string_literal: true

# Remove legacy sharepoint_*_template columns from corporate_company_settings
#
# SSoT Migration:
# - Template paths are now stored in StorageConfiguration.templates (JSONB)
# - These columns were deprecated and only used as fallbacks
# - All template data has been migrated to StorageConfiguration
#
# Legacy columns being removed:
# - sharepoint_job_template
# - sharepoint_company_template
# - sharepoint_people_template
# - sharepoint_contacts_template
# - sharepoint_task_template
#
class RemoveLegacySharepointTemplateColumns < ActiveRecord::Migration[8.0]
  def up
    # First, ensure StorageConfiguration has the templates (idempotent)
    # This is a safety net in case migration runs before data was migrated
    if defined?(StorageConfiguration) && defined?(CorporateCompanySetting)
      setting = CorporateCompanySetting.first
      config = StorageConfiguration.first

      if setting && config && config.templates.blank?
        config.update!(
          templates: {
            job: setting.read_attribute(:sharepoint_job_template) || "{{JobCode}}/{{Category}}",
            corporate_entity: setting.read_attribute(:sharepoint_company_template) || "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
            people: setting.read_attribute(:sharepoint_people_template) || "{{ContactName}}/{{Category}}",
            contacts: setting.read_attribute(:sharepoint_contacts_template) || "{{ContactName}}/{{Category}}",
            task: setting.read_attribute(:sharepoint_task_template) || "{{TaskId}}/{{Category}}"
          }
        )
      end
    end

    # Remove the legacy columns
    remove_column :corporate_company_settings, :sharepoint_job_template, :string
    remove_column :corporate_company_settings, :sharepoint_company_template, :string
    remove_column :corporate_company_settings, :sharepoint_people_template, :string
    remove_column :corporate_company_settings, :sharepoint_contacts_template, :string
    remove_column :corporate_company_settings, :sharepoint_task_template, :string
  end

  def down
    # Re-add columns for rollback
    add_column :corporate_company_settings, :sharepoint_job_template, :string, default: "{{JobCode}}/{{Category}}"
    add_column :corporate_company_settings, :sharepoint_company_template, :string, default: "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}"
    add_column :corporate_company_settings, :sharepoint_people_template, :string, default: "{{ContactName}}/{{Category}}"
    add_column :corporate_company_settings, :sharepoint_contacts_template, :string, default: "{{ContactName}}/{{Category}}"
    add_column :corporate_company_settings, :sharepoint_task_template, :string

    # Restore data from StorageConfiguration if available
    if defined?(StorageConfiguration) && defined?(CorporateCompanySetting)
      config = StorageConfiguration.first
      setting = CorporateCompanySetting.first

      if config && setting && config.templates.present?
        setting.update!(
          sharepoint_job_template: config.templates["job"],
          sharepoint_company_template: config.templates["corporate_entity"],
          sharepoint_people_template: config.templates["people"],
          sharepoint_contacts_template: config.templates["contacts"],
          sharepoint_task_template: config.templates["task"]
        )
      end
    end
  end
end

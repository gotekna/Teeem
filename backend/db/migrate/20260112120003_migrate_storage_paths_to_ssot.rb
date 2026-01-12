# frozen_string_literal: true

# SSoT Migration: Move storage paths from CorporateCompanySetting to StorageConfiguration
#
# BEFORE: CorporateCompanySetting.sharepoint_* columns hold the actual paths
#         StorageConfiguration.paths holds defaults
#         StorageConfiguration.to_config_hash reads from CorporateCompanySetting (bandaid)
#
# AFTER:  StorageConfiguration.paths/templates hold the actual values (SSoT)
#         CorporateCompanySetting.sharepoint_* columns are deprecated (ignored)
#
class MigrateStoragePathsToSsot < ActiveRecord::Migration[7.1]
  def up
    # Get existing configuration sources
    ccs = CorporateCompanySetting.first
    sc = StorageConfiguration.first

    return unless ccs && sc

    Rails.logger.info "[SSoT Migration] Migrating storage paths from CorporateCompanySetting to StorageConfiguration"

    # Migrate paths - copy actual values from CorporateCompanySetting
    new_paths = {
      "jobs" => ccs.sharepoint_jobs_path.presence || "Jobs",
      "tasks" => ccs.sharepoint_tasks_path.presence || "Tasks",
      "corporate" => ccs.sharepoint_company_path.presence || "Corporate",
      "people" => ccs.sharepoint_people_path.presence || "Corporate/People",
      "contacts" => ccs.sharepoint_contacts_path.presence || "Contacts",
      "emails" => sc.paths&.dig("emails") || "Emails",
      "accounts" => sc.paths&.dig("accounts") || "Accounts"
    }

    # Migrate templates - copy actual values from CorporateCompanySetting
    new_templates = {
      "job" => ccs.sharepoint_job_template.presence || "{{JobCode}}/{{Category}}",
      "task" => ccs.sharepoint_task_template.presence || "Task-{{TaskId}}/{{Category}}",
      "corporate" => ccs.sharepoint_company_template.presence || "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}",
      "people" => ccs.sharepoint_people_template.presence || "{{ContactName}}/{{Category}}",
      "contacts" => ccs.sharepoint_contacts_template.presence || "{{ContactName}}/{{Category}}",
      "account" => sc.templates&.dig("account") || "{{Source}}/{{ContactName}}/{{Category}}"
    }

    # Migrate root path
    new_root_path = ccs.sharepoint_root_path.presence || "/Shared Documents"

    # Update StorageConfiguration with actual values
    sc.update!(
      paths: new_paths,
      templates: new_templates,
      root_path: new_root_path
    )

    Rails.logger.info "[SSoT Migration] Complete. StorageConfiguration is now the SSoT for storage paths."
    Rails.logger.info "[SSoT Migration] Paths: #{new_paths.inspect}"
    Rails.logger.info "[SSoT Migration] Templates: #{new_templates.inspect}"
    Rails.logger.info "[SSoT Migration] Root: #{new_root_path}"
  end

  def down
    # No rollback needed - the data still exists in CorporateCompanySetting
    Rails.logger.info "[SSoT Migration] Rollback: No action needed. CorporateCompanySetting still has the data."
  end
end

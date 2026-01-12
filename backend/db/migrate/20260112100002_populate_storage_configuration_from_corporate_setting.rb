# frozen_string_literal: true

# Phase 4: Populate StorageConfiguration.connection_config from CorporateCompanySetting
#
# This migration moves the SharePoint connection config (site_id, drive_id, etc.)
# from CorporateCompanySetting to StorageConfiguration.connection_config
#
# SSoT Architecture:
# - CorporateCompanySetting.sharepoint_* columns → DEPRECATED (Phase 5 removal)
# - StorageConfiguration.connection_config → THE ONE SSoT for connection details
#
class PopulateStorageConfigurationFromCorporateSetting < ActiveRecord::Migration[8.0]
  def up
    # Get the company setting with SharePoint config
    setting = CorporateCompanySetting.first
    return unless setting

    # Get or create storage configuration
    org = Organization.first
    return unless org

    # Determine provider type - default to sharepoint if not in allowed list
    allowed_providers = %w[sharepoint s3 wasabi local]
    provider = org.document_provider
    provider = "sharepoint" unless allowed_providers.include?(provider)

    # Default paths and templates (inline since model constants were removed for SSoT simplification)
    default_paths = {
      "jobs" => "Jobs", "tasks" => "Tasks", "emails" => "Emails",
      "people" => "People", "accounts" => "Accounts",
      "contacts" => "Contacts", "corporate" => "Corporate"
    }
    default_templates = {
      "job" => "{{JobCode}}/{{Category}}", "task" => "Task-{{TaskId}}/{{Category}}",
      "people" => "{{ContactName}}/{{Category}}", "account" => "{{Source}}/{{ContactName}}/{{Category}}",
      "contacts" => "{{ContactName}}/{{Category}}", "corporate" => "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}"
    }

    storage_config = StorageConfiguration.find_or_create_by!(organization: org) do |sc|
      sc.provider_type = provider
      sc.status = "disconnected"
      sc.root_path = setting.sharepoint_root_path.presence || "/Shared Documents"
      sc.paths = default_paths
      sc.templates = default_templates
    end

    # Populate connection_config from CorporateCompanySetting
    connection_config = {
      "site_id" => setting.sharepoint_site_id,
      "drive_id" => setting.sharepoint_drive_id,
      "site_url" => setting.sharepoint_site_url,
      "drive_name" => setting.sharepoint_drive_name
    }.compact

    # Populate paths from CorporateCompanySetting
    paths = {
      "jobs" => setting.sharepoint_jobs_path.presence || "Jobs",
      "corporate" => setting.sharepoint_company_path.presence || "Corporate",
      "people" => setting.sharepoint_people_path.presence || "People",
      "contacts" => setting.sharepoint_contacts_path.presence || "Contacts",
      "tasks" => setting.sharepoint_tasks_path.presence || "Tasks",
      "accounts" => "Accounts",
      "emails" => "Emails"
    }

    # Populate templates from CorporateCompanySetting
    templates = {
      "job" => setting.sharepoint_job_template.presence || "{{JobCode}}/{{Category}}",
      "corporate" => setting.sharepoint_company_template.presence || "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}",
      "people" => setting.sharepoint_people_template.presence || "{{ContactName}}/{{Category}}",
      "contacts" => setting.sharepoint_contacts_template.presence || "{{ContactName}}/{{Category}}",
      "task" => setting.sharepoint_task_template.presence || "Task-{{TaskId}}/{{Category}}",
      "account" => "{{Source}}/{{ContactName}}/{{Category}}"
    }

    # Update storage configuration
    storage_config.update!(
      connection_config: connection_config,
      root_path: setting.sharepoint_root_path.presence || "/Shared Documents",
      paths: paths,
      templates: templates,
      status: connection_config["site_id"].present? ? "connected" : "disconnected"
    )

    Rails.logger.info "[Migration] Populated StorageConfiguration from CorporateCompanySetting"
    Rails.logger.info "[Migration] connection_config: #{connection_config.inspect}"
  end

  def down
    # No-op: We don't want to delete data on rollback
    # The CorporateCompanySetting still has the original data
  end
end

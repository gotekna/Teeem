# frozen_string_literal: true

# SSoT Cleanup: Remove duplicate storage configuration columns
#
# These columns are duplicated in StorageConfiguration (THE ONE SSoT).
#
# DELETED from corporate_company_settings:
# - sharepoint_site_url
# - sharepoint_site_id
# - sharepoint_drive_id
# - sharepoint_drive_name
# - sharepoint_jobs_path
# - sharepoint_people_path
# - sharepoint_company_path
# - sharepoint_contacts_path
# - sharepoint_tasks_path
# - contact_documents_path
# - company_documents_base_path
# - people_documents_base_path
# - job_documents_base_path
#
# THE ONE: StorageConfiguration.instance.paths / StorageConfiguration.instance.connection_config
#
class RemoveDuplicateStorageColumnsFromCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def up
    # SharePoint connection config (now in StorageConfiguration.connection_config)
    remove_column :corporate_settings, :sharepoint_site_url, if_exists: true
    remove_column :corporate_settings, :sharepoint_site_id, if_exists: true
    remove_column :corporate_settings, :sharepoint_drive_id, if_exists: true
    remove_column :corporate_settings, :sharepoint_drive_name, if_exists: true

    # SharePoint paths (now in StorageConfiguration.paths)
    remove_column :corporate_settings, :sharepoint_jobs_path, if_exists: true
    remove_column :corporate_settings, :sharepoint_people_path, if_exists: true
    remove_column :corporate_settings, :sharepoint_company_path, if_exists: true
    remove_column :corporate_settings, :sharepoint_contacts_path, if_exists: true
    remove_column :corporate_settings, :sharepoint_tasks_path, if_exists: true

    # Legacy document paths (now in StorageConfiguration.paths)
    remove_column :corporate_settings, :contact_documents_path, if_exists: true
    remove_column :corporate_settings, :company_documents_base_path, if_exists: true
    remove_column :corporate_settings, :people_documents_base_path, if_exists: true
    remove_column :corporate_settings, :job_documents_base_path, if_exists: true

    Rails.logger.info "[SSoT] Removed 13 duplicate storage columns from corporate_company_settings"
  end

  def down
    # Restore columns (data is lost - use StorageConfiguration)
    add_column :corporate_settings, :sharepoint_site_url, :string
    add_column :corporate_settings, :sharepoint_site_id, :string
    add_column :corporate_settings, :sharepoint_drive_id, :string
    add_column :corporate_settings, :sharepoint_drive_name, :string
    add_column :corporate_settings, :sharepoint_jobs_path, :string, default: "Jobs"
    add_column :corporate_settings, :sharepoint_people_path, :string, default: "Corporate/People"
    add_column :corporate_settings, :sharepoint_company_path, :string, default: "00 TEEEM PRIVATE"
    add_column :corporate_settings, :sharepoint_contacts_path, :string, default: "Contacts"
    add_column :corporate_settings, :sharepoint_tasks_path, :string
    add_column :corporate_settings, :contact_documents_path, :string
    add_column :corporate_settings, :company_documents_base_path, :string, default: "00 TEEEM PRIVATE"
    add_column :corporate_settings, :people_documents_base_path, :string, default: "teeem/Corporate/People"
    add_column :corporate_settings, :job_documents_base_path, :string, default: "Jobs"
  end
end

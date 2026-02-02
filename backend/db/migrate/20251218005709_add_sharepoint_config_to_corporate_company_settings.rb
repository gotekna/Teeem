class AddSharepointConfigToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    # SharePoint Site configuration (SSoT for all SharePoint operations)
    add_column :corporate_settings, :sharepoint_site_url, :string
    add_column :corporate_settings, :sharepoint_site_id, :string
    add_column :corporate_settings, :sharepoint_drive_id, :string
    add_column :corporate_settings, :sharepoint_drive_name, :string

    # Root path - all document paths are relative to this (SSoT)
    add_column :corporate_settings, :sharepoint_root_path, :string, default: "/Shared Documents"

    # Sub-paths for different document types (relative to root)
    # These override the existing base_path columns when SharePoint is configured
    add_column :corporate_settings, :sharepoint_jobs_path, :string, default: "TEEEM Jobs"
    add_column :corporate_settings, :sharepoint_people_path, :string, default: "Corporate/People"
    add_column :corporate_settings, :sharepoint_company_path, :string, default: "00 TEEEM PRIVATE"
    add_column :corporate_settings, :sharepoint_contacts_path, :string, default: "Contacts"
  end
end

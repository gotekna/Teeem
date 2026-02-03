# frozen_string_literal: true

# SSoT Cleanup: Rename all "onedrive" columns to "sharepoint"
# We only use SharePoint, "OneDrive" terminology is legacy/incorrect
class RenameOnedriveToSharepoint < ActiveRecord::Migration[8.0]
  def change
    # Cases table
    rename_column :cases, :onedrive_folder_id, :sharepoint_folder_id
    rename_column :cases, :onedrive_folder_path, :sharepoint_folder_path

    # Corporate Companies table
    rename_column :corporate_companies, :onedrive_folder_id, :sharepoint_folder_id
    rename_column :corporate_companies, :onedrive_folder_path, :sharepoint_folder_path

    # Company Documents table (legacy, distinct from corporate_company_documents)
    rename_column :company_documents, :onedrive_download_url, :sharepoint_download_url
    rename_column :company_documents, :expected_onedrive_path, :expected_sharepoint_path

    # Corporate Company Documents table
    rename_column :corporate_documents, :onedrive_download_url, :sharepoint_download_url
    rename_column :corporate_documents, :expected_onedrive_path, :expected_sharepoint_path

    # Job Documents table
    rename_column :job_documents, :onedrive_item_id, :sharepoint_item_id
    rename_column :job_documents, :onedrive_drive_id, :sharepoint_drive_id

    # Jobs table
    rename_column :jobs, :onedrive_folder_creation_status, :sharepoint_folder_status
  end
end

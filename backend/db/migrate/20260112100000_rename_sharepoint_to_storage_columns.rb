# frozen_string_literal: true

# Phase 2: Rename provider-specific columns to provider-agnostic names
#
# SSoT: StorageConfiguration is now THE source for all storage config.
# Column names should be provider-agnostic to support SharePoint, S3, Wasabi, etc.
#
# This migration renames:
# - entity_tabs: sharepoint_folder_* → storage_folder_*
# - jobs: sharepoint_folder_* → storage_folder_*
# - cases: sharepoint_folder_* → storage_folder_*
# - corporate_companies: sharepoint_folder_* → storage_folder_*
#
# NOTE: We do NOT rename sharepoint_file_id columns - those are actual
# SharePoint file references that need to stay as provider-specific identifiers.
#
class RenameSharepointToStorageColumns < ActiveRecord::Migration[7.2]
  def up
    # ========================================
    # entity_tabs
    # ========================================
    rename_column :entity_tabs, :has_sharepoint_folder, :has_storage_folder
    rename_column :entity_tabs, :sharepoint_folder_path, :storage_folder_path
    rename_column :entity_tabs, :sharepoint_folder_id, :storage_folder_id
    rename_column :entity_tabs, :sharepoint_path_type, :storage_path_type

    # Rename index (if it exists with old name)
    if index_exists?(:entity_tabs, :storage_folder_id, name: "index_entity_tabs_on_sharepoint_folder_id")
      rename_index :entity_tabs, "index_entity_tabs_on_sharepoint_folder_id", "index_entity_tabs_on_storage_folder_id"
    elsif !index_exists?(:entity_tabs, :storage_folder_id)
      add_index :entity_tabs, :storage_folder_id, name: "index_entity_tabs_on_storage_folder_id"
    end

    # ========================================
    # jobs
    # ========================================
    rename_column :jobs, :sharepoint_folder_status, :storage_folder_status
    rename_column :jobs, :sharepoint_folder_id, :storage_folder_id

    # Rename indexes
    if index_exists?(:jobs, :storage_folder_id, name: "index_jobs_on_sharepoint_folder_id")
      rename_index :jobs, "index_jobs_on_sharepoint_folder_id", "index_jobs_on_storage_folder_id"
    elsif !index_exists?(:jobs, :storage_folder_id)
      add_index :jobs, :storage_folder_id, name: "index_jobs_on_storage_folder_id"
    end

    if index_exists?(:jobs, :storage_folder_status, name: "index_jobs_on_sharepoint_folder_status")
      rename_index :jobs, "index_jobs_on_sharepoint_folder_status", "index_jobs_on_storage_folder_status"
    elsif !index_exists?(:jobs, :storage_folder_status)
      add_index :jobs, :storage_folder_status, name: "index_jobs_on_storage_folder_status"
    end

    # ========================================
    # cases
    # ========================================
    rename_column :cases, :sharepoint_folder_id, :storage_folder_id
    rename_column :cases, :sharepoint_folder_path, :storage_folder_path

    if index_exists?(:cases, :storage_folder_id, name: "index_cases_on_sharepoint_folder_id")
      rename_index :cases, "index_cases_on_sharepoint_folder_id", "index_cases_on_storage_folder_id"
    elsif !index_exists?(:cases, :storage_folder_id)
      add_index :cases, :storage_folder_id, name: "index_cases_on_storage_folder_id"
    end

    # ========================================
    # corporate_companies
    # ========================================
    rename_column :corporate_companies, :sharepoint_folder_id, :storage_folder_id
    rename_column :corporate_companies, :sharepoint_folder_path, :storage_folder_path
    rename_column :corporate_companies, :sharepoint_folder_url, :storage_folder_url
    rename_column :corporate_companies, :sharepoint_folder_name, :storage_folder_name

    if index_exists?(:corporate_companies, :storage_folder_id, name: "index_corporate_companies_on_sharepoint_folder_id")
      rename_index :corporate_companies, "index_corporate_companies_on_sharepoint_folder_id", "index_corporate_companies_on_storage_folder_id"
    elsif !index_exists?(:corporate_companies, :storage_folder_id)
      add_index :corporate_companies, :storage_folder_id, name: "index_corporate_companies_on_storage_folder_id"
    end
  end

  def down
    # ========================================
    # corporate_companies
    # ========================================
    rename_column :corporate_companies, :storage_folder_id, :sharepoint_folder_id
    rename_column :corporate_companies, :storage_folder_path, :sharepoint_folder_path
    rename_column :corporate_companies, :storage_folder_url, :sharepoint_folder_url
    rename_column :corporate_companies, :storage_folder_name, :sharepoint_folder_name

    if index_exists?(:corporate_companies, :sharepoint_folder_id, name: "index_corporate_companies_on_storage_folder_id")
      rename_index :corporate_companies, "index_corporate_companies_on_storage_folder_id", "index_corporate_companies_on_sharepoint_folder_id"
    end

    # ========================================
    # cases
    # ========================================
    rename_column :cases, :storage_folder_id, :sharepoint_folder_id
    rename_column :cases, :storage_folder_path, :sharepoint_folder_path

    if index_exists?(:cases, :sharepoint_folder_id, name: "index_cases_on_storage_folder_id")
      rename_index :cases, "index_cases_on_storage_folder_id", "index_cases_on_sharepoint_folder_id"
    end

    # ========================================
    # jobs
    # ========================================
    rename_column :jobs, :storage_folder_status, :sharepoint_folder_status
    rename_column :jobs, :storage_folder_id, :sharepoint_folder_id

    if index_exists?(:jobs, :sharepoint_folder_id, name: "index_jobs_on_storage_folder_id")
      rename_index :jobs, "index_jobs_on_storage_folder_id", "index_jobs_on_sharepoint_folder_id"
    end

    if index_exists?(:jobs, :sharepoint_folder_status, name: "index_jobs_on_storage_folder_status")
      rename_index :jobs, "index_jobs_on_storage_folder_status", "index_jobs_on_sharepoint_folder_status"
    end

    # ========================================
    # entity_tabs
    # ========================================
    rename_column :entity_tabs, :has_storage_folder, :has_sharepoint_folder
    rename_column :entity_tabs, :storage_folder_path, :sharepoint_folder_path
    rename_column :entity_tabs, :storage_folder_id, :sharepoint_folder_id
    rename_column :entity_tabs, :storage_path_type, :sharepoint_path_type

    if index_exists?(:entity_tabs, :sharepoint_folder_id, name: "index_entity_tabs_on_storage_folder_id")
      rename_index :entity_tabs, "index_entity_tabs_on_storage_folder_id", "index_entity_tabs_on_sharepoint_folder_id"
    end
  end
end

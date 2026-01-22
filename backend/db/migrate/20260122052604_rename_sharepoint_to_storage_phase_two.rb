# frozen_string_literal: true

# Phase 2: Rename remaining SharePoint-specific columns to provider-agnostic names
#
# SSoT: StorageConfiguration is THE source for all storage config.
# Column names should be provider-agnostic to support SharePoint, S3, Wasabi, etc.
#
# This migration renames columns in:
# - document_templates
# - e_signature_requests
# - attachments
# - email_attachments
# - synced_emails
#
# NOTE: We do NOT rename sharepoint columns in these tables (too deeply embedded):
# - job_documents (sharepoint_item_id, sharepoint_drive_id, sharepoint_file_id, sharepoint_web_url)
# - corporate_company_documents (sharepoint_file_id, sharepoint_download_url, expected_sharepoint_path)
# - bill_inboxes (sharepoint_file_id)
# - plan_folder_scans (sharepoint_file_id)
#
class RenameSharepointToStoragePhaseTwo < ActiveRecord::Migration[8.0]
  def change
    # ========================================
    # document_templates
    # ========================================
    rename_column :document_templates, :sharepoint_site_id, :storage_site_id
    rename_column :document_templates, :sharepoint_drive_id, :storage_drive_id
    rename_column :document_templates, :sharepoint_item_id, :storage_item_id
    rename_column :document_templates, :sharepoint_path, :storage_path

    # ========================================
    # e_signature_requests
    # ========================================
    rename_column :e_signature_requests, :sharepoint_site_id, :storage_site_id
    rename_column :e_signature_requests, :sharepoint_drive_id, :storage_drive_id
    rename_column :e_signature_requests, :original_sharepoint_file_id, :original_storage_file_id
    rename_column :e_signature_requests, :signed_sharepoint_file_id, :signed_storage_file_id
    # NOTE: certificate_sharepoint_file_id doesn't exist - was never created

    # ========================================
    # attachments
    # ========================================
    rename_column :attachments, :sharepoint_file_id, :storage_file_id
    rename_column :attachments, :sharepoint_path, :storage_path

    # Rename index
    if index_exists?(:attachments, :storage_file_id, name: "index_attachments_on_sharepoint_file_id")
      rename_index :attachments, "index_attachments_on_sharepoint_file_id", "index_attachments_on_storage_file_id"
    end

    # ========================================
    # email_attachments
    # ========================================
    rename_column :email_attachments, :sharepoint_path, :storage_path

    # ========================================
    # synced_emails
    # ========================================
    rename_column :synced_emails, :sharepoint_email_file_id, :storage_email_file_id
    rename_column :synced_emails, :sharepoint_email_path, :storage_email_path
  end
end

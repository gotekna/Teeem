# frozen_string_literal: true

# Rename ALL SharePoint-specific columns to provider-agnostic names
#
# SSoT: StorageConfiguration is THE source for all storage config.
# Column names should be provider-agnostic to support SharePoint, S3, Wasabi, etc.
#
class RenameRemainingSharepointColumns < ActiveRecord::Migration[8.0]
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

    # ========================================
    # e_signature_certificates
    # ========================================
    rename_column :e_signature_certificates, :certificate_sharepoint_file_id, :certificate_storage_file_id

    # ========================================
    # attachments
    # ========================================
    rename_column :attachments, :sharepoint_file_id, :storage_file_id
    rename_column :attachments, :sharepoint_path, :storage_path

    # ========================================
    # email_attachments
    # ========================================
    rename_column :email_attachments, :sharepoint_path, :storage_path

    # ========================================
    # synced_emails
    # ========================================
    rename_column :synced_emails, :sharepoint_email_file_id, :storage_email_file_id
    rename_column :synced_emails, :sharepoint_email_path, :storage_email_path

    # ========================================
    # corporate_company_documents
    # ========================================
    rename_column :corporate_documents, :expected_sharepoint_path, :expected_storage_path
    rename_column :corporate_documents, :sharepoint_file_id, :storage_file_id
    rename_column :corporate_documents, :sharepoint_download_url, :storage_download_url

    # ========================================
    # contact_documents
    # ========================================
    rename_column :contact_documents, :sharepoint_item_id, :storage_item_id
    rename_column :contact_documents, :sharepoint_file_id, :storage_file_id

    # ========================================
    # bill_inboxes
    # ========================================
    rename_column :bill_inboxes, :sharepoint_file_id, :storage_file_id

    # ========================================
    # chat_messages
    # ========================================
    rename_column :chat_messages, :sharepoint_file_id, :storage_file_id

    # ========================================
    # financial_transactions
    # ========================================
    rename_column :financial_transactions, :sharepoint_file_id, :storage_file_id

    # ========================================
    # document_folders
    # ========================================
    rename_column :document_folders, :sharepoint_path, :storage_path

    # ========================================
    # document_tasks
    # ========================================
    rename_column :document_tasks, :sharepoint_url, :storage_url

    # ========================================
    # corporate_entity_tabs
    # ========================================
    rename_column :corporate_entity_tabs, :has_sharepoint_folder, :has_storage_folder
    rename_column :corporate_entity_tabs, :sharepoint_folder_path, :storage_folder_path

    # ========================================
    # job_documents (has unique index on sharepoint_item_id)
    # ========================================
    rename_column :job_documents, :sharepoint_item_id, :storage_item_id
    rename_column :job_documents, :sharepoint_drive_id, :storage_drive_id
    rename_column :job_documents, :sharepoint_file_id, :storage_file_id
    rename_column :job_documents, :sharepoint_web_url, :storage_web_url

    # ========================================
    # job_plan_revisions
    # ========================================
    rename_column :job_plan_revisions, :sharepoint_file_id, :storage_file_id
    rename_column :job_plan_revisions, :sharepoint_web_url, :storage_web_url
    rename_column :job_plan_revisions, :sharepoint_folder_status, :storage_folder_status

    # ========================================
    # pay_now_requests
    # ========================================
    rename_column :pay_now_requests, :sharepoint_file_id, :storage_file_id
    rename_column :pay_now_requests, :proof_photos_sharepoint_ids, :proof_photos_storage_ids

    # ========================================
    # plan_folder_scans (has unique index)
    # ========================================
    rename_column :plan_folder_scans, :sharepoint_file_id, :storage_file_id
  end
end

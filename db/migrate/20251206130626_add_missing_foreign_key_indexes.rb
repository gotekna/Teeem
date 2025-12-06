class AddMissingForeignKeyIndexes < ActiveRecord::Migration[8.0]
  def change
    # High-impact tables (frequently queried)
    add_index :contacts, :sys_type_id, if_not_exists: true
    add_index :contacts, :parent_id, if_not_exists: true
    add_index :contacts, :contact_region_id, if_not_exists: true
    add_index :contacts, :linked_company_id, if_not_exists: true

    add_index :chat_messages, :recipient_user_id, if_not_exists: true
    add_index :chat_messages, :contact_id, if_not_exists: true
    add_index :chat_messages, :case_id, if_not_exists: true

    add_index :purchase_orders, :xero_invoice_id, if_not_exists: true
    add_index :purchase_orders, :created_by_id, if_not_exists: true
    add_index :purchase_orders, :approved_by_id, if_not_exists: true

    add_index :jobs, :xero_tracking_option_id, if_not_exists: true
    add_index :jobs, :archived_by_id, if_not_exists: true

    # Medium-impact tables
    add_index :cases, :onedrive_folder_id, if_not_exists: true
    add_index :companies, :onedrive_folder_id, if_not_exists: true

    add_index :company_documents, :user_validated_by_id, if_not_exists: true
    add_index :document_duplicate_reviews, :resolved_by_id, if_not_exists: true
    add_index :director_onboarding_requests, :director_id, if_not_exists: true

    add_index :email_warehouse, :user_classification_by_id, if_not_exists: true

    add_index :job_claims, :xero_contact_id, if_not_exists: true
    add_index :bank_transactions, :xero_contact_id, if_not_exists: true

    add_index :job_documents, :onedrive_drive_id, if_not_exists: true
    add_index :job_documents, :version_id, if_not_exists: true
    add_index :job_documents, :rename_approved_by_id, if_not_exists: true

    # Lower-impact but still useful
    add_index :bug_hunter_test_runs, :template_id, if_not_exists: true
    add_index :gold_standard_table, :user_id, if_not_exists: true
    add_index :leads, :contract_id, if_not_exists: true

    add_index :price_histories, :changed_by_user_id, if_not_exists: true
    add_index :pricebook, :image_file_id, if_not_exists: true
    add_index :pricebook, :spec_file_id, if_not_exists: true
    add_index :pricebook, :qr_code_file_id, if_not_exists: true

    add_index :schedule_template_rows, :linked_template_id, if_not_exists: true
    add_index :sm_settings, :default_template_id, if_not_exists: true
    add_index :sm_template_rows, :created_by_id, if_not_exists: true
    add_index :sm_template_rows, :updated_by_id, if_not_exists: true
    add_index :sm_templates, :created_by_id, if_not_exists: true
    add_index :sm_templates, :updated_by_id, if_not_exists: true

    add_index :whs_inductions, :whs_induction_template_id, if_not_exists: true

    # OneDrive/OAuth tables
    add_index :one_drive_credentials, :root_folder_id, if_not_exists: true
    add_index :organization_one_drive_credentials, :drive_id, if_not_exists: true
    add_index :organization_one_drive_credentials, :root_folder_id, if_not_exists: true
    add_index :organization_microsoft_app_credentials, :setup_by_id, if_not_exists: true
  end
end

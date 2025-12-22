# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2025_12_22_110000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pg_stat_statements"
  enable_extension "pg_trgm"

  create_table "account_mappings", force: :cascade do |t|
    t.bigint "accounting_integration_id", null: false
    t.bigint "keepr_account_id", null: false
    t.string "external_account_id", null: false
    t.string "external_account_name"
    t.string "external_account_code"
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["accounting_integration_id", "keepr_account_id"], name: "index_account_mappings_uniqueness", unique: true
    t.index ["accounting_integration_id"], name: "index_account_mappings_on_accounting_integration_id"
    t.index ["external_account_id"], name: "index_account_mappings_on_external_account_id"
    t.index ["is_active"], name: "index_account_mappings_on_is_active"
    t.index ["keepr_account_id"], name: "index_account_mappings_on_keepr_account_id"
  end

  create_table "accounting_integrations", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.string "system_type", null: false
    t.text "oauth_token"
    t.text "refresh_token"
    t.datetime "token_expires_at"
    t.string "organization_id"
    t.string "tenant_id"
    t.datetime "last_sync_at"
    t.string "sync_status"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "account_mappings", default: {}
    t.jsonb "sync_settings", default: {}
    t.text "sync_error_message"
    t.index ["contact_id", "system_type"], name: "index_accounting_integrations_on_contact_id_and_system_type", unique: true
    t.index ["contact_id"], name: "index_accounting_integrations_on_contact_id"
    t.index ["last_sync_at"], name: "index_accounting_integrations_on_last_sync_at"
    t.index ["system_type"], name: "index_accounting_integrations_on_system_type"
  end

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "agent_definitions", force: :cascade do |t|
    t.string "agent_id", null: false
    t.string "name", null: false
    t.string "agent_type", null: false
    t.string "focus", null: false
    t.string "model", default: "sonnet"
    t.text "purpose"
    t.text "capabilities"
    t.text "when_to_use"
    t.text "tools_available"
    t.text "success_criteria"
    t.text "example_invocations"
    t.text "important_notes"
    t.integer "total_runs", default: 0
    t.integer "successful_runs", default: 0
    t.integer "failed_runs", default: 0
    t.datetime "last_run_at"
    t.string "last_status"
    t.text "last_message"
    t.jsonb "last_run_details", default: {}
    t.jsonb "metadata", default: {}
    t.boolean "active", default: true
    t.integer "priority", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.bigint "last_run_by_id"
    t.string "last_run_by_name"
    t.string "created_by_name"
    t.string "updated_by_name"
    t.string "category"
    t.integer "last_run_tokens"
    t.integer "total_tokens"
    t.index ["active"], name: "index_agent_definitions_on_active"
    t.index ["agent_id"], name: "index_agent_definitions_on_agent_id", unique: true
    t.index ["agent_type"], name: "index_agent_definitions_on_agent_type"
    t.index ["created_by_id"], name: "index_agent_definitions_on_created_by_id"
    t.index ["last_run_by_id"], name: "index_agent_definitions_on_last_run_by_id"
    t.index ["updated_by_id"], name: "index_agent_definitions_on_updated_by_id"
  end

  create_table "ai_processing_logs", force: :cascade do |t|
    t.string "service_type", null: false
    t.string "processable_type"
    t.bigint "processable_id"
    t.string "input_identifier"
    t.jsonb "ocr_result"
    t.jsonb "pattern_result"
    t.jsonb "ai_result"
    t.string "final_type"
    t.integer "final_confidence"
    t.string "decision_method"
    t.boolean "user_corrected", default: false
    t.string "corrected_to"
    t.bigint "corrected_by_id"
    t.datetime "corrected_at"
    t.integer "ocr_duration_ms"
    t.integer "ai_duration_ms"
    t.integer "total_duration_ms"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["corrected_by_id"], name: "index_ai_processing_logs_on_corrected_by_id"
    t.index ["created_at"], name: "index_ai_processing_logs_on_created_at"
    t.index ["processable_type", "processable_id"], name: "index_ai_processing_logs_on_processable"
    t.index ["service_type", "user_corrected"], name: "index_ai_processing_logs_on_service_type_and_user_corrected"
    t.index ["service_type"], name: "index_ai_processing_logs_on_service_type"
  end

  create_table "ai_service_configs", force: :cascade do |t|
    t.string "service_type", null: false
    t.string "display_name", null: false
    t.boolean "ocr_enabled", default: true
    t.integer "ai_threshold", default: 80
    t.string "ai_model", default: "sonnet"
    t.boolean "ai_always", default: false
    t.boolean "active", default: true
    t.jsonb "extra_config", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["service_type"], name: "index_ai_service_configs_on_service_type", unique: true
  end

  create_table "asset_insurances", force: :cascade do |t|
    t.bigint "asset_id", null: false
    t.string "policy_number"
    t.string "insurer_name"
    t.string "broker_name"
    t.string "broker_contact_name"
    t.string "broker_email"
    t.string "broker_phone"
    t.date "start_date"
    t.date "renewal_date"
    t.string "payment_frequency"
    t.decimal "premium_amount", precision: 10, scale: 2
    t.decimal "coverage_amount", precision: 12, scale: 2
    t.decimal "excess_amount", precision: 10, scale: 2
    t.string "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["asset_id"], name: "index_asset_insurances_on_asset_id"
    t.index ["renewal_date"], name: "index_asset_insurances_on_renewal_date"
    t.index ["status"], name: "index_asset_insurances_on_status"
  end

  create_table "asset_service_histories", force: :cascade do |t|
    t.bigint "asset_id", null: false
    t.bigint "user_id"
    t.date "service_date", null: false
    t.string "service_type"
    t.string "service_provider"
    t.text "description"
    t.decimal "cost", precision: 10, scale: 2
    t.integer "odometer_reading"
    t.integer "hours_reading"
    t.integer "next_service_km"
    t.integer "next_service_hours"
    t.date "next_service_date"
    t.string "invoice_url"
    t.string "document_url"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["asset_id"], name: "index_asset_service_histories_on_asset_id"
    t.index ["service_date"], name: "index_asset_service_histories_on_service_date"
    t.index ["service_type"], name: "index_asset_service_histories_on_service_type"
    t.index ["user_id"], name: "index_asset_service_histories_on_user_id"
  end

  create_table "assets", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "name"
    t.string "asset_type"
    t.string "status"
    t.decimal "purchase_price"
    t.date "purchase_date"
    t.date "sale_date"
    t.decimal "current_book_value"
    t.string "make"
    t.string "model"
    t.text "description"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "abbreviation"
    t.index ["abbreviation"], name: "index_assets_on_abbreviation"
    t.index ["company_id"], name: "index_assets_on_company_id"
  end

  create_table "attachments", force: :cascade do |t|
    t.string "sharepoint_file_id", null: false
    t.string "sharepoint_path", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.bigint "file_size"
    t.string "content_hash", null: false
    t.bigint "organization_microsoft_app_credential_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["content_hash"], name: "index_attachments_on_content_hash", unique: true
    t.index ["organization_microsoft_app_credential_id"], name: "index_attachments_on_org_cred_id"
    t.index ["sharepoint_file_id"], name: "index_attachments_on_sharepoint_file_id"
  end

  create_table "balance_sheet_reports", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "company_name", null: false
    t.string "company_code"
    t.string "financial_year", null: false
    t.date "report_date"
    t.decimal "total_assets", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_liabilities", precision: 15, scale: 2, default: "0.0"
    t.decimal "net_assets", precision: 15, scale: 2, default: "0.0"
    t.jsonb "report_data"
    t.string "cloudinary_public_id"
    t.string "cloudinary_url"
    t.string "file_name"
    t.integer "file_size"
    t.string "status", default: "pending"
    t.datetime "generated_at"
    t.text "error_message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_code"], name: "index_balance_sheet_reports_on_company_code"
    t.index ["company_id", "financial_year"], name: "idx_bs_reports_unique", unique: true
    t.index ["company_id"], name: "index_balance_sheet_reports_on_company_id"
    t.index ["financial_year"], name: "index_balance_sheet_reports_on_financial_year"
    t.index ["status"], name: "index_balance_sheet_reports_on_status"
  end

  create_table "bank_accounts", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "institution_name"
    t.string "bsb"
    t.string "account_number"
    t.string "account_name"
    t.text "description"
    t.date "date_opened"
    t.date "date_closed"
    t.string "status", default: "active"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "xero_account_id"
    t.string "bank_code"
    t.string "aba_user_name", limit: 26
    t.string "aba_user_number", limit: 6
    t.string "aba_file_description", limit: 12
    t.boolean "is_ap_enabled", default: false
    t.integer "next_aba_sequence", default: 1
    t.string "bank_feed_name"
    t.index ["company_id", "is_ap_enabled"], name: "idx_bank_accounts_company_ap"
    t.index ["company_id", "status"], name: "index_bank_accounts_on_company_id_and_status"
    t.index ["company_id"], name: "index_bank_accounts_on_company_id"
    t.index ["status"], name: "index_bank_accounts_on_status"
    t.index ["xero_account_id"], name: "index_bank_accounts_on_xero_account_id"
  end

  create_table "bank_statement_reports", id: :serial, force: :cascade do |t|
    t.string "bank_account_id", null: false
    t.string "bank_account_name", null: false
    t.string "financial_year", null: false
    t.integer "month"
    t.integer "year"
    t.string "report_type", default: "monthly"
    t.date "period_start"
    t.date "period_end"
    t.integer "transaction_count", default: 0
    t.decimal "total_in", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_out", precision: 15, scale: 2, default: "0.0"
    t.decimal "net_change", precision: 15, scale: 2, default: "0.0"
    t.string "cloudinary_public_id"
    t.string "cloudinary_url"
    t.string "file_name"
    t.integer "file_size"
    t.datetime "generated_at", precision: nil
    t.string "status", default: "pending"
    t.text "error_message"
    t.datetime "created_at", precision: nil, default: -> { "now()" }, null: false
    t.datetime "updated_at", precision: nil, default: -> { "now()" }, null: false
    t.string "bank_code"
    t.string "account_number"
    t.string "company_code"
    t.index ["bank_account_id", "financial_year", "month"], name: "idx_bank_reports_unique", unique: true
    t.index ["bank_code"], name: "index_bank_statement_reports_on_bank_code"
    t.index ["company_code"], name: "index_bank_statement_reports_on_company_code"
  end

  create_table "bank_statement_templates", force: :cascade do |t|
    t.string "bank_code"
    t.string "bank_name"
    t.string "primary_color"
    t.string "secondary_color"
    t.string "text_on_primary"
    t.string "account_type"
    t.string "date_format"
    t.jsonb "detection_patterns"
    t.string "layout_style"
    t.boolean "is_active"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "reference_image_path"
    t.index ["bank_code"], name: "index_bank_statement_templates_on_bank_code"
  end

  create_table "bank_transactions", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "bank_account_id"
    t.string "xero_transaction_id", null: false
    t.string "transaction_type"
    t.date "transaction_date", null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.string "reference"
    t.text "description"
    t.string "contact_name"
    t.string "xero_contact_id"
    t.string "status"
    t.string "line_amount_types"
    t.boolean "is_reconciled", default: false
    t.string "currency_code", default: "AUD"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bank_account_id", "transaction_date"], name: "idx_on_bank_account_id_transaction_date_4b5f834392"
    t.index ["bank_account_id"], name: "index_bank_transactions_on_bank_account_id"
    t.index ["company_id", "transaction_date"], name: "index_bank_transactions_on_company_id_and_transaction_date"
    t.index ["company_id"], name: "index_bank_transactions_on_company_id"
    t.index ["status"], name: "index_bank_transactions_on_status"
    t.index ["xero_contact_id"], name: "index_bank_transactions_on_xero_contact_id"
    t.index ["xero_transaction_id"], name: "index_bank_transactions_on_xero_transaction_id", unique: true
  end

  create_table "batch_operations", force: :cascade do |t|
    t.bigint "job_id"
    t.bigint "user_id"
    t.string "operation_type", null: false
    t.string "status", default: "pending", null: false
    t.string "current_step"
    t.string "current_item_name"
    t.integer "total_items", default: 0
    t.integer "processed_items", default: 0
    t.jsonb "items_completed", default: []
    t.jsonb "operation_errors", default: []
    t.jsonb "metadata", default: {}
    t.text "error_message"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id", "operation_type"], name: "index_batch_operations_on_job_id_and_operation_type"
    t.index ["job_id"], name: "index_batch_operations_on_job_id"
    t.index ["operation_type"], name: "index_batch_operations_on_operation_type"
    t.index ["status", "operation_type"], name: "index_batch_operations_on_status_and_operation_type"
    t.index ["status"], name: "index_batch_operations_on_status"
    t.index ["user_id"], name: "index_batch_operations_on_user_id"
  end

  create_table "bill_inboxes", force: :cascade do |t|
    t.string "source", default: "email", null: false
    t.string "email_message_id"
    t.bigint "email_warehouse_id"
    t.bigint "corporate_company_id"
    t.bigint "detected_company_id"
    t.bigint "supplier_id"
    t.string "supplier_name_raw"
    t.string "supplier_abn_raw"
    t.string "invoice_number"
    t.date "invoice_date"
    t.date "due_date"
    t.decimal "subtotal", precision: 15, scale: 2
    t.decimal "tax_amount", precision: 15, scale: 2
    t.decimal "total_amount", precision: 15, scale: 2
    t.string "currency", default: "AUD"
    t.jsonb "line_items", default: []
    t.jsonb "ai_extraction_result", default: {}
    t.decimal "ai_confidence", precision: 5, scale: 4
    t.datetime "extracted_at"
    t.bigint "matched_purchase_order_id"
    t.string "match_status", default: "unmatched"
    t.decimal "variance_amount", precision: 15, scale: 2
    t.string "variance_reason"
    t.string "status", default: "pending", null: false
    t.bigint "bpmn_process_instance_id"
    t.bigint "approved_by_id"
    t.datetime "approved_at"
    t.text "rejection_reason"
    t.bigint "external_invoice_id"
    t.string "xero_invoice_id"
    t.datetime "synced_to_xero_at"
    t.string "original_filename"
    t.string "content_type"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "ocr_extraction_result"
    t.jsonb "comparison_data"
    t.jsonb "contact_comparison_data", default: {}
    t.string "sharepoint_file_id"
    t.index ["approved_by_id"], name: "index_bill_inboxes_on_approved_by_id"
    t.index ["corporate_company_id", "status"], name: "index_bill_inboxes_on_corporate_company_id_and_status"
    t.index ["corporate_company_id"], name: "index_bill_inboxes_on_corporate_company_id"
    t.index ["email_message_id"], name: "index_bill_inboxes_on_email_message_id", unique: true, where: "(email_message_id IS NOT NULL)"
    t.index ["external_invoice_id"], name: "index_bill_inboxes_on_external_invoice_id"
    t.index ["match_status"], name: "index_bill_inboxes_on_match_status"
    t.index ["matched_purchase_order_id"], name: "index_bill_inboxes_on_matched_purchase_order_id"
    t.index ["sharepoint_file_id"], name: "index_bill_inboxes_on_sharepoint_file_id"
    t.index ["status"], name: "index_bill_inboxes_on_status"
    t.index ["supplier_id", "invoice_number"], name: "index_bill_inboxes_on_supplier_id_and_invoice_number", unique: true, where: "(invoice_number IS NOT NULL)"
    t.index ["supplier_id"], name: "index_bill_inboxes_on_supplier_id"
  end

  create_table "bill_payment_batches", force: :cascade do |t|
    t.bigint "corporate_company_id", null: false
    t.bigint "bank_account_id", null: false
    t.string "batch_reference", null: false
    t.string "status", default: "draft", null: false
    t.date "payment_date", null: false
    t.decimal "total_amount", precision: 15, scale: 2, default: "0.0"
    t.integer "payment_count", default: 0
    t.string "aba_file_name"
    t.text "aba_file_content"
    t.datetime "aba_generated_at"
    t.string "aba_sequence_number"
    t.string "processing_description"
    t.string "self_balancing_reference"
    t.bigint "created_by_id"
    t.bigint "approved_by_id"
    t.datetime "approved_at"
    t.bigint "bpmn_process_instance_id"
    t.datetime "submitted_to_bank_at"
    t.datetime "completed_at"
    t.text "bank_response"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["approved_by_id"], name: "index_bill_payment_batches_on_approved_by_id"
    t.index ["bank_account_id"], name: "index_bill_payment_batches_on_bank_account_id"
    t.index ["batch_reference"], name: "index_bill_payment_batches_on_batch_reference", unique: true
    t.index ["corporate_company_id", "status"], name: "index_bill_payment_batches_on_corporate_company_id_and_status"
    t.index ["corporate_company_id"], name: "index_bill_payment_batches_on_corporate_company_id"
    t.index ["created_by_id"], name: "index_bill_payment_batches_on_created_by_id"
    t.index ["payment_date"], name: "index_bill_payment_batches_on_payment_date"
    t.index ["status"], name: "index_bill_payment_batches_on_status"
  end

  create_table "bill_payments", force: :cascade do |t|
    t.bigint "bill_payment_batch_id", null: false
    t.bigint "bill_inbox_id", null: false
    t.bigint "purchase_order_id"
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.string "status", default: "pending", null: false
    t.string "payee_name"
    t.string "payee_bsb"
    t.string "payee_account_number"
    t.string "payment_reference", limit: 18
    t.string "remittance_email"
    t.boolean "send_remittance", default: true
    t.datetime "remittance_sent_at"
    t.string "xero_payment_id"
    t.datetime "synced_to_xero_at"
    t.string "sync_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bill_inbox_id"], name: "index_bill_payments_on_bill_inbox_id"
    t.index ["bill_payment_batch_id", "bill_inbox_id"], name: "idx_bill_payments_batch_inbox_unique", unique: true
    t.index ["bill_payment_batch_id"], name: "index_bill_payments_on_bill_payment_batch_id"
    t.index ["purchase_order_id"], name: "index_bill_payments_on_purchase_order_id"
    t.index ["status"], name: "index_bill_payments_on_status"
  end

  create_table "bpmn_edges", force: :cascade do |t|
    t.bigint "bpmn_process_id", null: false
    t.string "edge_key", null: false
    t.bigint "source_node_id", null: false
    t.bigint "target_node_id", null: false
    t.string "name"
    t.text "condition_expression"
    t.boolean "is_default", default: false
    t.jsonb "style", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bpmn_process_id", "edge_key"], name: "index_bpmn_edges_on_bpmn_process_id_and_edge_key", unique: true
    t.index ["bpmn_process_id"], name: "index_bpmn_edges_on_bpmn_process_id"
    t.index ["source_node_id"], name: "index_bpmn_edges_on_source_node_id"
    t.index ["target_node_id"], name: "index_bpmn_edges_on_target_node_id"
  end

  create_table "bpmn_nodes", force: :cascade do |t|
    t.bigint "bpmn_process_id", null: false
    t.string "node_type", null: false
    t.string "node_key", null: false
    t.string "name"
    t.text "description"
    t.float "position_x", default: 0.0
    t.float "position_y", default: 0.0
    t.jsonb "config", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bpmn_process_id", "node_key"], name: "index_bpmn_nodes_on_bpmn_process_id_and_node_key", unique: true
    t.index ["bpmn_process_id"], name: "index_bpmn_nodes_on_bpmn_process_id"
    t.index ["node_type"], name: "index_bpmn_nodes_on_node_type"
  end

  create_table "bpmn_process_instances", force: :cascade do |t|
    t.bigint "bpmn_process_id", null: false
    t.bigint "workflow_instance_id"
    t.string "subject_type", null: false
    t.bigint "subject_id", null: false
    t.string "status", default: "active"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.jsonb "variables", default: {}
    t.text "error_message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bpmn_process_id"], name: "index_bpmn_process_instances_on_bpmn_process_id"
    t.index ["status"], name: "index_bpmn_process_instances_on_status"
    t.index ["subject_type", "subject_id"], name: "index_bpmn_process_instances_on_subject_type_and_subject_id"
    t.index ["workflow_instance_id"], name: "index_bpmn_process_instances_on_workflow_instance_id"
  end

  create_table "bpmn_processes", force: :cascade do |t|
    t.bigint "workflow_definition_id"
    t.string "name", null: false
    t.text "description"
    t.integer "version", default: 1
    t.text "bpmn_xml"
    t.jsonb "canvas_data", default: {}
    t.boolean "is_published", default: false
    t.datetime "published_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "svg_preview"
    t.index ["is_published"], name: "index_bpmn_processes_on_is_published"
    t.index ["name"], name: "index_bpmn_processes_on_name"
    t.index ["workflow_definition_id"], name: "index_bpmn_processes_on_workflow_definition_id"
  end

  create_table "bpmn_task_instances", force: :cascade do |t|
    t.bigint "bpmn_token_id", null: false
    t.bigint "bpmn_node_id", null: false
    t.string "task_type", null: false
    t.string "status", default: "pending"
    t.string "assigned_to_type"
    t.bigint "assigned_to_id"
    t.datetime "due_date"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.jsonb "form_data", default: {}
    t.jsonb "execution_result", default: {}
    t.text "error_message"
    t.integer "retry_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "assigned_to_role"
    t.datetime "reminded_at"
    t.datetime "overdue_reminded_at"
    t.index ["assigned_to_type", "assigned_to_id"], name: "idx_on_assigned_to_type_assigned_to_id_c36150f21d"
    t.index ["bpmn_node_id"], name: "index_bpmn_task_instances_on_bpmn_node_id"
    t.index ["bpmn_token_id"], name: "index_bpmn_task_instances_on_bpmn_token_id"
    t.index ["status"], name: "index_bpmn_task_instances_on_status"
  end

  create_table "bpmn_tokens", force: :cascade do |t|
    t.bigint "bpmn_process_instance_id", null: false
    t.bigint "current_node_id", null: false
    t.bigint "parent_token_id"
    t.string "status", default: "active"
    t.datetime "arrived_at"
    t.datetime "completed_at"
    t.jsonb "data", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bpmn_process_instance_id"], name: "index_bpmn_tokens_on_bpmn_process_instance_id"
    t.index ["current_node_id"], name: "index_bpmn_tokens_on_current_node_id"
    t.index ["parent_token_id"], name: "index_bpmn_tokens_on_parent_token_id"
    t.index ["status"], name: "index_bpmn_tokens_on_status"
  end

  create_table "bpmn_triggers", force: :cascade do |t|
    t.bigint "bpmn_process_id", null: false
    t.string "trigger_type", null: false
    t.string "name", null: false
    t.boolean "is_active", default: true
    t.jsonb "config", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bpmn_process_id", "trigger_type"], name: "index_bpmn_triggers_on_bpmn_process_id_and_trigger_type"
    t.index ["bpmn_process_id"], name: "index_bpmn_triggers_on_bpmn_process_id"
    t.index ["is_active"], name: "index_bpmn_triggers_on_is_active"
  end

  create_table "bug_hunter_test_runs", force: :cascade do |t|
    t.string "test_id", null: false
    t.string "status", null: false
    t.text "message"
    t.float "duration"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "template_id"
    t.text "console_output"
    t.index ["created_at"], name: "index_bug_hunter_test_runs_on_created_at"
    t.index ["template_id"], name: "index_bug_hunter_test_runs_on_template_id"
    t.index ["test_id"], name: "index_bug_hunter_test_runs_on_test_id"
  end

  create_table "case_actions", force: :cascade do |t|
    t.bigint "case_id", null: false
    t.string "action_type", null: false
    t.string "status", default: "pending"
    t.text "query"
    t.jsonb "parameters", default: {}
    t.jsonb "results", default: {}
    t.text "ai_analysis"
    t.jsonb "inconsistencies", default: []
    t.integer "result_count"
    t.bigint "created_by_id"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.integer "execution_time_ms"
    t.text "error_message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["action_type"], name: "index_case_actions_on_action_type"
    t.index ["case_id", "created_at"], name: "index_case_actions_on_case_id_and_created_at"
    t.index ["case_id"], name: "index_case_actions_on_case_id"
    t.index ["created_by_id"], name: "index_case_actions_on_created_by_id"
    t.index ["status"], name: "index_case_actions_on_status"
  end

  create_table "case_companies", force: :cascade do |t|
    t.bigint "case_id", null: false
    t.bigint "company_id", null: false
    t.string "role"
    t.text "notes"
    t.boolean "is_primary", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["case_id", "company_id"], name: "index_case_companies_on_case_id_and_company_id", unique: true
    t.index ["case_id"], name: "index_case_companies_on_case_id"
    t.index ["company_id"], name: "index_case_companies_on_company_id"
    t.index ["role"], name: "index_case_companies_on_role"
  end

  create_table "case_contacts", force: :cascade do |t|
    t.bigint "case_id", null: false
    t.bigint "contact_id", null: false
    t.string "role"
    t.text "notes"
    t.boolean "is_primary", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "relationship_type"
    t.text "relationship_description"
    t.jsonb "display_position", default: {}
    t.string "alignment", default: "neutral"
    t.text "reason", null: false
    t.bigint "added_by_id"
    t.boolean "include_all_emails", default: false, null: false
    t.index ["added_by_id"], name: "index_case_contacts_on_added_by_id"
    t.index ["alignment"], name: "index_case_contacts_on_alignment"
    t.index ["case_id", "contact_id"], name: "index_case_contacts_on_case_id_and_contact_id", unique: true
    t.index ["case_id", "include_all_emails"], name: "index_case_contacts_on_case_id_and_include_all_emails"
    t.index ["case_id"], name: "index_case_contacts_on_case_id"
    t.index ["contact_id"], name: "index_case_contacts_on_contact_id"
    t.index ["relationship_type"], name: "index_case_contacts_on_relationship_type"
    t.index ["role"], name: "index_case_contacts_on_role"
  end

  create_table "case_documents", force: :cascade do |t|
    t.bigint "case_id", null: false
    t.bigint "company_document_id", null: false
    t.string "relevance"
    t.text "notes"
    t.integer "sequence"
    t.jsonb "ai_tags", default: []
    t.text "ai_summary"
    t.decimal "relevance_score", precision: 5, scale: 2
    t.bigint "added_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "short_code"
    t.string "source_type"
    t.string "original_location"
    t.string "action_taken"
    t.index ["added_by_id"], name: "index_case_documents_on_added_by_id"
    t.index ["case_id", "company_document_id"], name: "index_case_documents_on_case_id_and_company_document_id", unique: true
    t.index ["case_id"], name: "index_case_documents_on_case_id"
    t.index ["company_document_id"], name: "index_case_documents_on_company_document_id"
    t.index ["relevance"], name: "index_case_documents_on_relevance"
    t.index ["relevance_score"], name: "index_case_documents_on_relevance_score"
    t.index ["short_code"], name: "index_case_documents_on_short_code"
  end

  create_table "case_email_qas", id: :bigint, default: nil, force: :cascade do |t|
    t.bigint "case_id", null: false
    t.bigint "case_email_id"
    t.bigint "email_warehouse_id"
    t.text "question", null: false
    t.text "answer"
    t.string "question_from"
    t.string "answer_from"
    t.datetime "question_date"
    t.datetime "answer_date"
    t.boolean "is_answered", default: false
    t.boolean "is_important", default: false
    t.string "category"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "case_emails", id: :bigint, default: nil, force: :cascade do |t|
    t.bigint "case_id", null: false
    t.bigint "email_warehouse_id", null: false
    t.string "relevance"
    t.text "notes"
    t.integer "sequence"
    t.jsonb "ai_tags", default: []
    t.text "ai_summary"
    t.decimal "relevance_score", precision: 5, scale: 2
    t.bigint "added_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "short_code"
    t.string "display_name"
    t.boolean "has_unanswered_questions", default: false
    t.boolean "auto_linked", default: false, null: false
    t.bigint "auto_linked_via_contact_id"
  end

  create_table "case_jobs", force: :cascade do |t|
    t.bigint "case_id", null: false
    t.bigint "job_id", null: false
    t.text "notes"
    t.string "relevance"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["case_id", "job_id"], name: "index_case_jobs_on_case_id_and_job_id", unique: true
    t.index ["case_id"], name: "index_case_jobs_on_case_id"
    t.index ["job_id"], name: "index_case_jobs_on_job_id"
  end

  create_table "case_timeline_events", force: :cascade do |t|
    t.bigint "case_id", null: false
    t.date "event_date", null: false
    t.time "event_time"
    t.string "event_type"
    t.string "title", null: false
    t.text "description"
    t.string "source_type"
    t.bigint "source_id"
    t.bigint "contact_id"
    t.bigint "company_id"
    t.bigint "job_id"
    t.string "icon"
    t.string "color"
    t.boolean "is_auto_generated", default: false
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["case_id", "event_date"], name: "index_case_timeline_events_on_case_id_and_event_date"
    t.index ["case_id"], name: "index_case_timeline_events_on_case_id"
    t.index ["company_id"], name: "index_case_timeline_events_on_company_id"
    t.index ["contact_id"], name: "index_case_timeline_events_on_contact_id"
    t.index ["event_type"], name: "index_case_timeline_events_on_event_type"
    t.index ["job_id"], name: "index_case_timeline_events_on_job_id"
    t.index ["source_type", "source_id"], name: "index_case_timeline_events_on_source_type_and_source_id"
  end

  create_table "cases", force: :cascade do |t|
    t.string "title", null: false
    t.string "case_number", null: false
    t.string "case_type"
    t.text "description"
    t.string "status", default: "open"
    t.bigint "contact_id"
    t.bigint "company_id"
    t.bigint "company_group_id"
    t.date "deadline"
    t.string "priority", default: "normal"
    t.bigint "assigned_to_id"
    t.bigint "created_by_id"
    t.date "investigation_start_date"
    t.date "investigation_end_date"
    t.jsonb "ai_summary"
    t.jsonb "key_findings"
    t.integer "risk_score"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "parent_case_id"
    t.integer "hierarchy_level", default: 0
    t.jsonb "filing_folder_paths", default: []
    t.jsonb "source_folder_paths", default: []
    t.string "file_action", default: "copy"
    t.string "document_processing_status", default: "pending"
    t.integer "unanswered_questions_count", default: 0
    t.string "sharepoint_folder_id"
    t.string "sharepoint_folder_path"
    t.index ["assigned_to_id"], name: "index_cases_on_assigned_to_id"
    t.index ["case_number"], name: "index_cases_on_case_number", unique: true
    t.index ["case_type"], name: "index_cases_on_case_type"
    t.index ["company_group_id"], name: "index_cases_on_company_group_id"
    t.index ["company_id"], name: "index_cases_on_company_id"
    t.index ["contact_id"], name: "index_cases_on_contact_id"
    t.index ["created_by_id"], name: "index_cases_on_created_by_id"
    t.index ["deadline"], name: "index_cases_on_deadline"
    t.index ["parent_case_id", "status"], name: "index_cases_on_parent_and_status"
    t.index ["parent_case_id"], name: "index_cases_on_parent_case_id"
    t.index ["priority"], name: "index_cases_on_priority"
    t.index ["sharepoint_folder_id"], name: "index_cases_on_sharepoint_folder_id"
    t.index ["status"], name: "index_cases_on_status"
  end

  create_table "chat_messages", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "project_id"
    t.text "content", null: false
    t.string "channel", default: "general", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "recipient_user_id"
    t.bigint "job_id"
    t.boolean "saved_to_job", default: false
    t.bigint "contact_id"
    t.bigint "case_id"
    t.string "message_type", default: "text"
    t.string "file_url"
    t.string "file_name"
    t.string "sharepoint_file_id"
    t.index ["case_id"], name: "index_chat_messages_on_case_id"
    t.index ["channel", "created_at"], name: "index_chat_messages_on_channel_and_created_at"
    t.index ["contact_id"], name: "index_chat_messages_on_contact_id"
    t.index ["created_at"], name: "index_chat_messages_on_created_at"
    t.index ["job_id", "channel", "created_at"], name: "index_chat_messages_on_construction_channel_created"
    t.index ["job_id"], name: "index_chat_messages_on_job_id"
    t.index ["project_id", "created_at"], name: "index_chat_messages_on_project_id_and_created_at"
    t.index ["project_id"], name: "index_chat_messages_on_project_id"
    t.index ["recipient_user_id"], name: "index_chat_messages_on_recipient_user_id"
    t.index ["sharepoint_file_id"], name: "index_chat_messages_on_sharepoint_file_id"
    t.index ["user_id"], name: "index_chat_messages_on_user_id"
  end

  create_table "claim_stage_templates", force: :cascade do |t|
    t.bigint "job_type_id"
    t.string "name", null: false
    t.decimal "percentage", precision: 5, scale: 2, null: false
    t.integer "sequence_order", default: 0, null: false
    t.string "description"
    t.string "invoice_match_pattern"
    t.boolean "is_active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_type_id", "name"], name: "idx_claim_stage_templates_unique_name", unique: true
    t.index ["job_type_id", "sequence_order"], name: "idx_claim_stage_templates_ordering"
    t.index ["job_type_id"], name: "index_claim_stage_templates_on_job_type_id"
  end

  create_table "colour_selection_templates", force: :cascade do |t|
    t.string "name", null: false
    t.bigint "job_type_id"
    t.jsonb "categories", default: []
    t.boolean "is_default", default: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_type_id"], name: "index_colour_selection_templates_on_job_type_id"
  end

  create_table "column_type_definitions", force: :cascade do |t|
    t.string "type_key", null: false
    t.string "display_name", null: false
    t.string "category"
    t.string "sql_type", null: false
    t.string "rails_type"
    t.integer "default_max_length"
    t.integer "default_min_length"
    t.decimal "default_min_value", precision: 15, scale: 2
    t.decimal "default_max_value", precision: 15, scale: 2
    t.text "validation_regex"
    t.text "validation_rules"
    t.text "example_values"
    t.text "used_for"
    t.string "icon"
    t.string "emoji"
    t.boolean "needs_config", default: false
    t.boolean "is_active", default: true
    t.integer "version", default: 1
    t.datetime "version_updated_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category"], name: "index_column_type_definitions_on_category"
    t.index ["is_active"], name: "index_column_type_definitions_on_is_active"
    t.index ["type_key"], name: "index_column_type_definitions_on_type_key", unique: true
  end

  create_table "columns", force: :cascade do |t|
    t.bigint "foundation_id", null: false
    t.string "name", null: false
    t.string "column_name", null: false
    t.string "column_type", null: false
    t.integer "max_length"
    t.integer "min_length"
    t.string "default_value"
    t.text "description"
    t.boolean "searchable", default: true
    t.boolean "is_title", default: false
    t.boolean "is_unique", default: false
    t.boolean "required", default: false
    t.decimal "min_value"
    t.decimal "max_value"
    t.text "validation_message"
    t.integer "position"
    t.integer "lookup_foundation_id"
    t.string "lookup_display_column"
    t.boolean "is_multiple", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "has_cross_table_refs", default: false, null: false
    t.jsonb "settings"
    t.text "available_choices"
    t.text "choices_order"
    t.string "header_align", default: "left"
    t.string "data_align", default: "left"
    t.string "column_group"
    t.boolean "has_ui", default: false
    t.bigint "column_type_definition_id"
    t.integer "override_max_length"
    t.integer "override_min_length"
    t.decimal "override_min_value", precision: 15, scale: 2
    t.decimal "override_max_value", precision: 15, scale: 2
    t.text "override_validation_message"
    t.integer "type_version_applied", default: 0
    t.datetime "last_compliance_check"
    t.index ["column_type_definition_id"], name: "index_columns_on_column_type_definition_id"
    t.index ["foundation_id", "column_name"], name: "index_columns_on_foundation_id_and_column_name", unique: true
    t.index ["foundation_id"], name: "index_columns_on_foundation_id"
    t.index ["has_cross_table_refs"], name: "index_columns_on_has_cross_table_refs"
    t.index ["lookup_foundation_id"], name: "index_columns_on_lookup_foundation_id"
  end

  create_table "company_approval_rules", force: :cascade do |t|
    t.bigint "corporate_company_id", null: false
    t.string "rule_type", null: false
    t.string "name", null: false
    t.text "description"
    t.decimal "min_amount", precision: 15, scale: 2
    t.decimal "max_amount", precision: 15, scale: 2
    t.decimal "variance_threshold_percent", precision: 5, scale: 2
    t.decimal "variance_threshold_amount", precision: 15, scale: 2
    t.string "approver_type", null: false
    t.bigint "approver_id"
    t.string "approver_role"
    t.bigint "approver_group_id"
    t.integer "escalation_hours"
    t.bigint "escalation_to_user_id"
    t.bigint "bpmn_process_id"
    t.jsonb "config", default: {}
    t.integer "priority", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bpmn_process_id"], name: "index_company_approval_rules_on_bpmn_process_id"
    t.index ["corporate_company_id", "rule_type", "is_active"], name: "idx_approval_rules_company_type_active"
    t.index ["corporate_company_id"], name: "index_company_approval_rules_on_corporate_company_id"
    t.index ["priority"], name: "index_company_approval_rules_on_priority"
  end

  create_table "contact_activities", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.string "activity_type"
    t.text "description"
    t.jsonb "metadata"
    t.string "performed_by_type"
    t.bigint "performed_by_id"
    t.datetime "occurred_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id"], name: "index_contact_activities_on_contact_id"
    t.index ["performed_by_type", "performed_by_id"], name: "index_contact_activities_on_performed_by"
  end

  create_table "contact_addresses", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.string "address_type"
    t.string "line1"
    t.string "line2"
    t.string "line3"
    t.string "line4"
    t.string "city"
    t.string "region"
    t.string "postal_code"
    t.string "country"
    t.string "attention_to"
    t.boolean "is_primary", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["address_type"], name: "index_contact_addresses_on_address_type"
    t.index ["contact_id", "address_type"], name: "index_contact_addresses_on_contact_id_and_address_type"
    t.index ["contact_id", "is_primary"], name: "index_contact_addresses_on_contact_id_and_is_primary"
    t.index ["contact_id"], name: "index_contact_addresses_on_contact_id"
  end

  create_table "contact_corporate_group_memberships", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.bigint "company_group_id", null: false
    t.string "membership_type"
    t.boolean "can_view_confidential", default: false
    t.boolean "can_edit", default: false
    t.bigint "company_id"
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "beneficiary_type"
    t.string "class_description"
    t.index ["company_group_id"], name: "index_contact_corporate_group_memberships_on_company_group_id"
    t.index ["company_id"], name: "index_contact_corporate_group_memberships_on_company_id"
    t.index ["contact_id", "company_group_id", "membership_type"], name: "idx_contact_group_membership_unique", unique: true
    t.index ["contact_id"], name: "index_contact_corporate_group_memberships_on_contact_id"
  end

  create_table "contact_emails", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.string "email", null: false
    t.boolean "is_primary", default: false, null: false
    t.string "label"
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "contact_external_links", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.string "tenant_id", null: false
    t.string "tenant_name"
    t.string "external_contact_id", null: false
    t.boolean "sync_enabled", default: true
    t.string "sync_direction", default: "bidirectional"
    t.datetime "last_synced_at"
    t.datetime "external_last_modified_at"
    t.string "sync_error"
    t.jsonb "conflict_fields", default: {}
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "source", default: "xero", null: false
    t.boolean "needs_review", default: false, null: false
    t.string "match_type"
    t.decimal "match_confidence", precision: 5, scale: 4
    t.datetime "reviewed_at"
    t.string "reviewed_by"
    t.string "xero_contact_status", default: "active"
    t.datetime "last_verified_at"
    t.index ["contact_id", "source", "tenant_id"], name: "idx_contact_external_links_unique", unique: true
    t.index ["contact_id"], name: "index_contact_external_links_on_contact_id"
    t.index ["last_verified_at"], name: "index_contact_external_links_on_last_verified_at"
    t.index ["needs_review"], name: "idx_contact_external_links_needs_review", where: "(needs_review = true)"
    t.index ["source", "tenant_id", "external_contact_id"], name: "idx_contact_external_links_external", unique: true
    t.index ["source"], name: "index_contact_external_links_on_source"
    t.index ["sync_enabled"], name: "index_contact_external_links_on_sync_enabled"
    t.index ["tenant_id"], name: "index_contact_external_links_on_tenant_id"
    t.index ["xero_contact_status"], name: "index_contact_external_links_on_xero_contact_status"
  end

  create_table "contact_group_memberships", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.bigint "contact_group_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_group_id"], name: "index_contact_group_memberships_on_contact_group_id"
    t.index ["contact_id"], name: "index_contact_group_memberships_on_contact_id"
  end

  create_table "contact_groups", force: :cascade do |t|
    t.string "xero_contact_group_id", null: false
    t.string "name", null: false
    t.string "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_contact_groups_on_name"
    t.index ["status"], name: "index_contact_groups_on_status"
    t.index ["xero_contact_group_id"], name: "index_contact_groups_on_xero_contact_group_id", unique: true
  end

  create_table "contact_persons", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.string "first_name"
    t.string "last_name"
    t.string "email"
    t.boolean "include_in_emails", default: true
    t.boolean "is_primary", default: false
    t.string "xero_contact_person_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "role"
    t.string "mobile"
    t.index ["contact_id", "is_primary"], name: "index_contact_persons_on_contact_id_and_is_primary"
    t.index ["contact_id"], name: "index_contact_persons_on_contact_id"
    t.index ["email"], name: "index_contact_persons_on_email"
    t.index ["xero_contact_person_id"], name: "index_contact_persons_on_xero_contact_person_id"
  end

  create_table "contact_phones", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.string "phone_number", null: false
    t.string "phone_type", default: "mobile", null: false
    t.boolean "is_primary", default: false, null: false
    t.string "label"
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id", "is_primary"], name: "index_contact_phones_on_primary", where: "(is_primary = true)"
    t.index ["contact_id", "position"], name: "index_contact_phones_on_contact_id_and_position"
    t.index ["contact_id"], name: "index_contact_phones_on_contact_id"
  end

  create_table "contact_quality_reviews", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.bigint "suggested_company_id"
    t.string "issue_type", null: false
    t.string "status", default: "pending", null: false
    t.string "recommended_action", null: false
    t.integer "confidence_score", default: 0
    t.jsonb "analysis_data", default: {}
    t.jsonb "abr_data"
    t.string "email_domain"
    t.string "derived_company_name"
    t.text "review_notes"
    t.bigint "reviewed_by_id"
    t.datetime "reviewed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id", "issue_type"], name: "idx_quality_reviews_contact_issue", unique: true
    t.index ["contact_id"], name: "index_contact_quality_reviews_on_contact_id"
    t.index ["issue_type"], name: "index_contact_quality_reviews_on_issue_type"
    t.index ["reviewed_by_id"], name: "index_contact_quality_reviews_on_reviewed_by_id"
    t.index ["status"], name: "index_contact_quality_reviews_on_status"
    t.index ["suggested_company_id"], name: "index_contact_quality_reviews_on_suggested_company_id"
  end

  create_table "contact_relationships", force: :cascade do |t|
    t.bigint "source_contact_id", null: false
    t.bigint "related_contact_id", null: false
    t.string "relationship_type", null: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "role_in_relationship"
    t.decimal "ownership_percentage", precision: 5, scale: 2
    t.text "context"
    t.date "start_date"
    t.date "end_date"
    t.boolean "is_active", default: true
    t.jsonb "metadata", default: {}
    t.integer "display_order", default: 0
    t.index ["is_active"], name: "index_contact_relationships_on_is_active"
    t.index ["related_contact_id", "display_order"], name: "index_contact_relationships_on_company_and_order"
    t.index ["related_contact_id"], name: "index_contact_relationships_on_related_contact_id"
    t.index ["relationship_type"], name: "index_contact_relationships_on_relationship_type"
    t.index ["source_contact_id", "related_contact_id", "relationship_type"], name: "index_contact_relationships_unique_by_type", unique: true
    t.index ["source_contact_id"], name: "index_contact_relationships_on_source_contact_id"
  end

  create_table "contact_types", force: :cascade do |t|
    t.string "name", null: false
    t.string "display_name", null: false
    t.string "tab_label"
    t.text "description"
    t.boolean "active", default: true, null: false
    t.integer "position", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_contact_types_on_name", unique: true
    t.index ["position"], name: "index_contact_types_on_position"
  end

  create_table "contacts", force: :cascade do |t|
    t.string "abn"
    t.string "email"
    t.string "office_phone"
    t.string "mobile_phone"
    t.string "website"
    t.string "first_name"
    t.string "last_name"
    t.string "display_name"
    t.boolean "sync_with_xero"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "roles", default: "{}"
    t.boolean "is_active", default: true
    t.text "address"
    t.text "lgas", default: [], array: true
    t.string "bank_bsb"
    t.string "bank_account_number"
    t.string "bank_account_name"
    t.string "default_purchase_account"
    t.integer "bill_due_day"
    t.string "bill_due_type"
    t.string "xero_contact_number"
    t.string "xero_account_number"
    t.string "default_sales_account"
    t.decimal "default_discount", precision: 5, scale: 2
    t.integer "sales_due_day"
    t.string "sales_due_type"
    t.boolean "portal_enabled", default: false
    t.string "company_name_or_trust"
    t.bigint "primary_company_id"
    t.string "entity_type"
    t.string "place_of_birth"
    t.string "birth_state"
    t.string "birth_country"
    t.text "residential_address"
    t.boolean "is_family_member", default: false
    t.boolean "is_potential_director", default: false
    t.bigint "company_group_id"
    t.integer "xero_invoice_count", default: 0
    t.boolean "link_to_cg", default: false
    t.integer "linked_company_id"
    t.string "city"
    t.string "state"
    t.string "postcode"
    t.text "xero_contact_types", default: [], array: true
    t.string "middle_name"
    t.boolean "is_team_contact", default: false, null: false
    t.decimal "accounts_receivable_outstanding", precision: 15, scale: 2, default: "0.0"
    t.decimal "accounts_receivable_overdue", precision: 15, scale: 2, default: "0.0"
    t.decimal "accounts_payable_outstanding", precision: 15, scale: 2, default: "0.0"
    t.decimal "accounts_payable_overdue", precision: 15, scale: 2, default: "0.0"
    t.string "company_number"
    t.string "fax_phone"
    t.jsonb "email_domains", default: [], null: false, comment: "Email domains for auto-linking employees (e.g., ['tekna.com.au', 'bunnings.com.au']). Used by rake task to create employee_of relationships."
    t.text "notes"
    t.boolean "has_trust_account", default: false, null: false
    t.string "trust_bsb"
    t.string "trust_account_number"
    t.string "trust_account_name"
    t.string "payment_terms"
    t.integer "employees_count", default: 0, null: false
    t.boolean "abn_valid"
    t.string "abn_entity_name"
    t.string "abn_entity_type"
    t.boolean "abn_gst_registered"
    t.datetime "abn_verified_at"
    t.string "acn", limit: 11
    t.boolean "acn_valid"
    t.datetime "acn_verified_at"
    t.integer "xero_linked_count", default: 0
    t.string "xero_tenant_names", default: [], array: true
    t.index ["abn_valid"], name: "index_contacts_on_abn_valid"
    t.index ["acn"], name: "index_contacts_on_acn"
    t.index ["acn_valid"], name: "index_contacts_on_acn_valid"
    t.index ["company_group_id"], name: "index_contacts_on_company_group_id"
    t.index ["email"], name: "index_contacts_on_email"
    t.index ["is_active"], name: "index_contacts_on_is_active"
    t.index ["is_team_contact"], name: "index_contacts_on_is_team_contact"
    t.index ["linked_company_id"], name: "index_contacts_on_linked_company_id"
    t.index ["portal_enabled"], name: "index_contacts_on_portal_enabled"
    t.index ["primary_company_id"], name: "index_contacts_on_primary_company_id"
    t.index ["xero_contact_number"], name: "index_contacts_on_xero_contact_number"
    t.index ["xero_contact_types"], name: "index_contacts_on_xero_contact_types", using: :gin
  end

  create_table "corporate_companies", force: :cascade do |t|
    t.string "name", null: false
    t.string "company_group"
    t.string "acn"
    t.string "abn"
    t.string "tfn"
    t.date "date_incorporated"
    t.text "purpose"
    t.string "status", default: "active"
    t.string "registered_office_address"
    t.string "principal_place_of_business"
    t.boolean "is_trustee", default: false
    t.string "trust_name"
    t.string "corporate_key"
    t.string "asic_username"
    t.text "encrypted_asic_password"
    t.text "recovery_question"
    t.text "encrypted_recovery_answer"
    t.date "review_date"
    t.string "gst_registration_status"
    t.string "accounting_method"
    t.integer "shares_on_issue"
    t.decimal "carry_forward_losses", precision: 15, scale: 2
    t.decimal "franking_balance", precision: 15, scale: 2
    t.decimal "amount_owing", precision: 15, scale: 2
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "company_group_id"
    t.string "company_code"
    t.integer "health_score"
    t.string "health_status"
    t.boolean "has_loans", default: false
    t.boolean "loan_documents_in_place", default: false
    t.string "sharepoint_folder_id"
    t.string "sharepoint_folder_path"
    t.string "code"
    t.string "sharepoint_folder_url"
    t.string "sharepoint_folder_name"
    t.string "entity_type", default: "company"
    t.bigint "parent_company_id"
    t.integer "hierarchy_level", default: 0
    t.string "bank_name"
    t.string "bank_bsb"
    t.string "bank_account_number"
    t.string "bank_account_name"
    t.date "bank_start_date"
    t.date "bank_end_date"
    t.bigint "consolidation_parent_id"
    t.string "slug"
    t.string "bas_frequency", default: "quarterly"
    t.text "previous_names", default: [], array: true
    t.bigint "contact_id"
    t.boolean "active", default: true
    t.string "business_names"
    t.index ["abn"], name: "index_corporate_companies_on_abn", unique: true, where: "(abn IS NOT NULL)"
    t.index ["acn"], name: "index_corporate_companies_on_acn", unique: true, where: "(acn IS NOT NULL)"
    t.index ["code"], name: "index_corporate_companies_on_code", unique: true
    t.index ["company_group"], name: "index_corporate_companies_on_company_group"
    t.index ["company_group_id", "parent_company_id"], name: "index_companies_on_group_and_parent"
    t.index ["company_group_id"], name: "index_corporate_companies_on_company_group_id"
    t.index ["consolidation_parent_id"], name: "index_corporate_companies_on_consolidation_parent_id"
    t.index ["contact_id"], name: "index_corporate_companies_on_contact_id"
    t.index ["name"], name: "index_corporate_companies_on_name"
    t.index ["parent_company_id"], name: "index_corporate_companies_on_parent_company_id"
    t.index ["review_date"], name: "index_corporate_companies_on_review_date"
    t.index ["sharepoint_folder_id"], name: "index_corporate_companies_on_sharepoint_folder_id"
    t.index ["slug"], name: "index_corporate_companies_on_slug", unique: true
    t.index ["status"], name: "index_corporate_companies_on_status"
  end

  create_table "corporate_company_activities", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "user_id"
    t.string "activity_type", null: false
    t.text "description"
    t.jsonb "change_details", default: {}
    t.string "related_type"
    t.bigint "related_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["activity_type"], name: "index_corporate_company_activities_on_activity_type"
    t.index ["company_id"], name: "index_corporate_company_activities_on_company_id"
    t.index ["created_at"], name: "index_corporate_company_activities_on_created_at"
    t.index ["related_type", "related_id"], name: "idx_on_related_type_related_id_d4aa46e723"
    t.index ["user_id"], name: "index_corporate_company_activities_on_user_id"
  end

  create_table "corporate_company_compliance_items", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "title", null: false
    t.text "description"
    t.string "item_type", null: false
    t.date "due_date", null: false
    t.boolean "completed", default: false
    t.datetime "completed_at"
    t.string "reminder_days"
    t.datetime "last_reminder_sent_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "recurrence"
    t.boolean "asic_related", default: false
    t.boolean "ato_related", default: false
    t.index ["asic_related"], name: "index_corporate_company_compliance_items_on_asic_related"
    t.index ["ato_related"], name: "index_corporate_company_compliance_items_on_ato_related"
    t.index ["company_id", "due_date", "completed"], name: "idx_on_company_id_due_date_completed_83c37a183d"
    t.index ["company_id"], name: "index_corporate_company_compliance_items_on_company_id"
    t.index ["completed"], name: "index_corporate_company_compliance_items_on_completed"
    t.index ["due_date"], name: "index_corporate_company_compliance_items_on_due_date"
    t.index ["item_type"], name: "index_corporate_company_compliance_items_on_item_type"
    t.index ["recurrence"], name: "index_corporate_company_compliance_items_on_recurrence"
  end

  create_table "corporate_company_directors", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.string "position"
    t.date "appointment_date"
    t.date "resignation_date"
    t.boolean "is_current", default: true
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["appointment_date"], name: "index_corporate_company_directors_on_appointment_date"
    t.index ["company_id", "contact_id"], name: "index_company_directors_unique_active", unique: true, where: "(is_current = true)"
    t.index ["company_id"], name: "index_corporate_company_directors_on_company_id"
    t.index ["contact_id"], name: "index_corporate_company_directors_on_contact_id"
    t.index ["is_current"], name: "index_corporate_company_directors_on_is_current"
  end

  create_table "corporate_company_documents", force: :cascade do |t|
    t.bigint "company_id"
    t.text "description"
    t.string "document_type", null: false
    t.date "document_date"
    t.string "file_url"
    t.string "file_name"
    t.integer "file_size"
    t.datetime "uploaded_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "folder"
    t.string "storage_type"
    t.string "filed_by"
    t.bigint "document_type_id"
    t.string "sharepoint_file_id"
    t.string "sharepoint_download_url"
    t.datetime "last_modified_at"
    t.string "expected_sharepoint_path"
    t.string "register_folder"
    t.string "company_code"
    t.string "source", default: "manual"
    t.bigint "asset_id"
    t.bigint "loan_id"
    t.bigint "contact_id"
    t.integer "financial_years", default: [], array: true
    t.datetime "ai_verified_at"
    t.string "ai_verification_status"
    t.string "ai_suggested_name"
    t.string "ai_suggested_folder"
    t.decimal "ai_confidence_score"
    t.datetime "user_validated_at"
    t.bigint "user_validated_by_id"
    t.string "display_name"
    t.string "ai_suggested_type"
    t.integer "ai_suggested_fy", default: [], array: true
    t.text "ai_analysis_notes"
    t.boolean "validation_required", default: false
    t.date "ref_date"
    t.date "filed_date"
    t.string "ai_extracted_description"
    t.date "ai_extracted_date"
    t.integer "ai_source_page"
    t.text "ai_source_quote"
    t.boolean "ai_contains_multiple_documents", default: false
    t.jsonb "ai_split_recommendation"
    t.string "documentable_type"
    t.bigint "documentable_id"
    t.string "content_hash"
    t.string "external_id"
    t.integer "job_id"
    t.string "mime_type"
    t.datetime "synced_to_xero_at"
    t.string "xero_attachment_id"
    t.boolean "sync_to_xero", default: false, null: false
    t.string "focus", default: "company", null: false
    t.boolean "is_pdf_eligible", default: true, null: false
    t.datetime "orphaned_at"
    t.string "orphan_reason"
    t.decimal "ocr_confidence", precision: 5, scale: 2
    t.string "ocr_method"
    t.decimal "human_confidence", precision: 5, scale: 2
    t.index ["asset_id"], name: "index_corporate_company_documents_on_asset_id"
    t.index ["company_code"], name: "index_corporate_company_documents_on_company_code"
    t.index ["company_id", "ai_verification_status"], name: "idx_company_docs_company_ai_status"
    t.index ["company_id", "document_type"], name: "idx_company_docs_company_type"
    t.index ["company_id", "folder"], name: "idx_company_docs_company_folder"
    t.index ["company_id"], name: "index_corporate_company_documents_on_company_id"
    t.index ["contact_id"], name: "index_corporate_company_documents_on_contact_id"
    t.index ["content_hash"], name: "index_corporate_company_documents_on_content_hash"
    t.index ["document_date"], name: "index_corporate_company_documents_on_document_date"
    t.index ["document_type"], name: "index_corporate_company_documents_on_document_type"
    t.index ["document_type_id"], name: "index_corporate_company_documents_on_document_type_id"
    t.index ["documentable_type", "documentable_id"], name: "idx_company_docs_documentable"
    t.index ["financial_years"], name: "index_corporate_company_documents_on_financial_years", using: :gin
    t.index ["focus"], name: "index_corporate_company_documents_on_focus"
    t.index ["folder"], name: "index_corporate_company_documents_on_folder"
    t.index ["is_pdf_eligible"], name: "index_corporate_company_documents_on_is_pdf_eligible", where: "((source)::text = 'xero'::text)"
    t.index ["job_id"], name: "index_corporate_company_documents_on_job_id"
    t.index ["loan_id"], name: "index_corporate_company_documents_on_loan_id"
    t.index ["orphaned_at"], name: "index_corporate_company_documents_on_orphaned_at", where: "(orphaned_at IS NOT NULL)"
    t.index ["sharepoint_file_id"], name: "index_corporate_company_documents_on_sharepoint_file_id", unique: true, where: "(sharepoint_file_id IS NOT NULL)"
    t.index ["source", "external_id"], name: "index_corporate_company_documents_on_source_and_external_id", unique: true, where: "(external_id IS NOT NULL)"
    t.index ["source"], name: "index_corporate_company_documents_on_source"
    t.index ["storage_type"], name: "index_corporate_company_documents_on_storage_type"
    t.index ["sync_to_xero", "synced_to_xero_at"], name: "idx_corp_docs_pending_xero_sync"
    t.index ["user_validated_by_id"], name: "index_corporate_company_documents_on_user_validated_by_id"
  end

  create_table "corporate_company_loans", force: :cascade do |t|
    t.bigint "lender_company_id", null: false
    t.bigint "borrower_company_id", null: false
    t.decimal "principal_amount", precision: 12, scale: 2, null: false
    t.decimal "current_balance", precision: 12, scale: 2
    t.decimal "interest_rate", precision: 5, scale: 2
    t.string "interest_type"
    t.date "loan_date"
    t.date "maturity_date"
    t.boolean "loan_documents_in_place", default: false
    t.string "security_type"
    t.string "status", default: "active"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["borrower_company_id"], name: "index_corporate_company_loans_on_borrower_company_id"
    t.index ["lender_company_id"], name: "index_corporate_company_loans_on_lender_company_id"
    t.index ["loan_date"], name: "index_corporate_company_loans_on_loan_date"
    t.index ["loan_documents_in_place"], name: "index_corporate_company_loans_on_loan_documents_in_place"
    t.index ["status"], name: "index_corporate_company_loans_on_status"
  end

  create_table "corporate_company_minutes", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "minute_template_id"
    t.string "title", null: false
    t.date "meeting_date", null: false
    t.text "content"
    t.string "status", default: "draft"
    t.date "signed_date"
    t.string "signed_by"
    t.string "document_path"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_corporate_company_minutes_on_company_id"
    t.index ["meeting_date"], name: "index_corporate_company_minutes_on_meeting_date"
    t.index ["minute_template_id"], name: "index_corporate_company_minutes_on_minute_template_id"
    t.index ["status"], name: "index_corporate_company_minutes_on_status"
  end

  create_table "corporate_company_monthly_pls", force: :cascade do |t|
    t.bigint "corporate_company_id", null: false
    t.date "month", null: false
    t.string "month_label"
    t.decimal "revenue", precision: 15, scale: 2, default: "0.0"
    t.decimal "expenses", precision: 15, scale: 2, default: "0.0"
    t.decimal "net_profit", precision: 15, scale: 2, default: "0.0"
    t.datetime "synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["corporate_company_id", "month"], name: "idx_company_monthly_pl_unique", unique: true
    t.index ["corporate_company_id"], name: "index_corporate_company_monthly_pls_on_corporate_company_id"
  end

  create_table "corporate_company_settings", force: :cascade do |t|
    t.string "company_name"
    t.string "abn"
    t.string "gst_number"
    t.string "email"
    t.string "phone"
    t.text "address"
    t.string "logo_url"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "twilio_account_sid"
    t.string "twilio_auth_token"
    t.string "twilio_phone_number"
    t.boolean "twilio_enabled", default: false
    t.string "timezone", default: "Australia/Brisbane"
    t.jsonb "working_days", default: {"friday"=>true, "monday"=>true, "sunday"=>false, "tuesday"=>true, "saturday"=>false, "thursday"=>true, "wednesday"=>true}, null: false
    t.jsonb "job_cascade_sort"
    t.jsonb "job_folder_name_format"
    t.string "contact_documents_path"
    t.string "contact_folder_format", default: "id_name"
    t.string "company_documents_base_path", default: "00 TEEEM PRIVATE"
    t.string "people_documents_base_path", default: "teeem/Corporate/People"
    t.string "job_documents_base_path", default: "TEEEM Jobs"
    t.string "qbcc_license"
    t.string "logo_mobile"
    t.string "logo_dark"
    t.string "website"
    t.string "sharepoint_site_url"
    t.string "sharepoint_site_id"
    t.string "sharepoint_drive_id"
    t.string "sharepoint_drive_name"
    t.string "sharepoint_root_path", default: "/Shared Documents"
    t.string "sharepoint_jobs_path", default: "TEEEM Jobs"
    t.string "sharepoint_people_path", default: "Corporate/People"
    t.string "sharepoint_company_path", default: "00 TEEEM PRIVATE"
    t.string "sharepoint_contacts_path", default: "Contacts"
    t.string "sharepoint_job_template", default: "{{JobCode}}/{{Category}}"
    t.string "sharepoint_company_template", default: "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}"
    t.string "sharepoint_people_template", default: "{{ContactName}}/{{Category}}"
    t.string "sharepoint_contacts_template", default: "{{ContactName}}/{{Category}}"
    t.string "postcode"
    t.jsonb "corporate_entity_types", default: ["Company", "Trust", "Superfund", "Charity", "Corporate Trustee", "Sole Trader"], null: false
  end

  create_table "corporate_company_shareholdings", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "shareholder_id", null: false
    t.string "share_class", default: "ordinary"
    t.bigint "number_of_shares", null: false
    t.boolean "beneficially_held", default: false
    t.string "beneficial_owner"
    t.date "acquired_date"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "shareholder_type", default: "Contact"
    t.date "acquisition_date"
    t.date "disposal_date"
    t.string "certificate_number"
    t.decimal "consideration_paid", precision: 15, scale: 2
    t.index ["beneficially_held"], name: "index_corporate_company_shareholdings_on_beneficially_held"
    t.index ["company_id", "shareholder_id", "share_class"], name: "idx_shareholdings_unique", unique: true
    t.index ["company_id"], name: "index_corporate_company_shareholdings_on_company_id"
    t.index ["share_class"], name: "index_corporate_company_shareholdings_on_share_class"
    t.index ["shareholder_id"], name: "index_corporate_company_shareholdings_on_shareholder_id"
    t.index ["shareholder_type", "shareholder_id"], name: "idx_shareholdings_polymorphic"
  end

  create_table "corporate_company_xero_accounts", force: :cascade do |t|
    t.bigint "company_xero_connection_id", null: false
    t.string "xero_account_id", null: false
    t.string "account_code"
    t.string "account_name"
    t.string "account_type"
    t.string "tax_type"
    t.string "description"
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "account_class"
    t.string "status"
    t.string "bank_account_number"
    t.string "currency_code"
    t.string "reporting_code"
    t.string "reporting_code_name"
    t.boolean "enable_payments", default: false
    t.boolean "show_in_expense_claims", default: false
    t.datetime "synced_at"
    t.index ["account_code"], name: "index_corporate_company_xero_accounts_on_account_code"
    t.index ["company_xero_connection_id"], name: "idx_on_company_xero_connection_id_dd7b188bc9"
    t.index ["company_xero_connection_id"], name: "index_xero_accounts_on_connection_id"
    t.index ["is_active"], name: "index_corporate_company_xero_accounts_on_is_active"
    t.index ["xero_account_id"], name: "index_corporate_company_xero_accounts_on_xero_account_id"
  end

  create_table "corporate_company_xero_connections", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "xero_tenant_id", null: false
    t.string "xero_tenant_name"
    t.datetime "last_sync_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "xero_credential_id"
    t.string "accounting_method"
    t.date "financial_year_end"
    t.datetime "monthly_pl_synced_at"
    t.datetime "accounts_synced_at"
    t.datetime "invoices_synced_at"
    t.datetime "balance_sheet_synced_at"
    t.index ["company_id"], name: "index_corporate_company_xero_connections_on_company_id", unique: true
    t.index ["xero_credential_id"], name: "index_corporate_company_xero_connections_on_xero_credential_id"
    t.index ["xero_tenant_id"], name: "index_corporate_company_xero_connections_on_xero_tenant_id"
  end

  create_table "corporate_entity_tabs", force: :cascade do |t|
    t.string "tab_key", null: false
    t.string "display_name", null: false
    t.string "tab_group", default: "documents"
    t.string "entity_types", default: [], array: true
    t.integer "order_position", default: 0
    t.boolean "enabled", default: true
    t.string "icon_name"
    t.text "description"
    t.string "component_name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "has_sharepoint_folder", default: false
    t.string "sharepoint_folder_path"
    t.jsonb "sub_tabs", default: []
    t.index ["enabled"], name: "index_corporate_entity_tabs_on_enabled"
    t.index ["order_position"], name: "index_corporate_entity_tabs_on_order_position"
    t.index ["tab_group"], name: "index_corporate_entity_tabs_on_tab_group"
    t.index ["tab_key"], name: "index_corporate_entity_tabs_on_tab_key", unique: true
  end

  create_table "corporate_groups", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.string "default_registered_office"
    t.string "default_principal_place"
    t.string "default_accountant"
    t.string "default_accountant_contact"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_corporate_groups_on_name", unique: true
  end

  create_table "data_quality_issues", force: :cascade do |t|
    t.string "view_name", null: false
    t.string "check_name", null: false
    t.string "severity", default: "warning", null: false
    t.string "status", default: "open", null: false
    t.text "description", null: false
    t.jsonb "details", default: {}
    t.integer "affected_row_count"
    t.datetime "detected_at", null: false
    t.datetime "resolved_at"
    t.string "resolved_by"
    t.text "resolution_notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["check_name"], name: "index_data_quality_issues_on_check_name"
    t.index ["detected_at"], name: "index_data_quality_issues_on_detected_at"
    t.index ["severity", "status"], name: "index_data_quality_issues_on_severity_and_status"
    t.index ["severity"], name: "index_data_quality_issues_on_severity"
    t.index ["status"], name: "index_data_quality_issues_on_status"
    t.index ["view_name", "status"], name: "index_data_quality_issues_on_view_name_and_status"
    t.index ["view_name"], name: "index_data_quality_issues_on_view_name"
  end

  create_table "designs", force: :cascade do |t|
    t.string "name", null: false
    t.decimal "size", precision: 10, scale: 2
    t.decimal "frontage_required", precision: 10, scale: 2
    t.string "floor_plan_url"
    t.text "description"
    t.boolean "is_active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["is_active"], name: "index_designs_on_is_active"
    t.index ["name"], name: "index_designs_on_name", unique: true
  end

  create_table "director_onboarding_requests", force: :cascade do |t|
    t.bigint "contact_id"
    t.bigint "company_id"
    t.string "access_token", null: false
    t.datetime "token_expires_at"
    t.string "status", default: "pending", null: false
    t.string "first_name"
    t.string "last_name"
    t.string "email"
    t.string "mobile_phone"
    t.date "date_of_birth"
    t.string "place_of_birth"
    t.string "birth_state"
    t.string "birth_country"
    t.string "residential_address"
    t.string "director_id"
    t.string "drivers_licence"
    t.string "passport_number"
    t.string "drivers_licence_front_url"
    t.string "drivers_licence_back_url"
    t.string "passport_url"
    t.string "photo_url"
    t.string "director_id_confirmation_url"
    t.boolean "consent_given", default: false
    t.datetime "consent_given_at"
    t.string "consent_ip_address"
    t.bigint "reviewed_by_id"
    t.datetime "reviewed_at"
    t.text "review_notes"
    t.datetime "submitted_at"
    t.datetime "invitation_sent_at"
    t.bigint "invited_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.date "drivers_licence_expiry"
    t.date "passport_expiry"
    t.index ["access_token"], name: "index_director_onboarding_requests_on_access_token", unique: true
    t.index ["company_id"], name: "index_director_onboarding_requests_on_company_id"
    t.index ["contact_id"], name: "index_director_onboarding_requests_on_contact_id"
    t.index ["director_id"], name: "index_director_onboarding_requests_on_director_id"
    t.index ["email"], name: "index_director_onboarding_requests_on_email"
    t.index ["invited_by_id"], name: "index_director_onboarding_requests_on_invited_by_id"
    t.index ["reviewed_by_id"], name: "index_director_onboarding_requests_on_reviewed_by_id"
    t.index ["status"], name: "index_director_onboarding_requests_on_status"
  end

  create_table "dividend_payments", force: :cascade do |t|
    t.bigint "dividend_id", null: false
    t.bigint "shareholder_id", null: false
    t.integer "shares_held"
    t.decimal "gross_amount", precision: 12, scale: 2
    t.decimal "franking_credit", precision: 12, scale: 2
    t.decimal "net_amount", precision: 12, scale: 2
    t.date "paid_date"
    t.string "payment_method"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["dividend_id", "shareholder_id"], name: "index_dividend_payments_on_dividend_id_and_shareholder_id", unique: true
    t.index ["dividend_id"], name: "index_dividend_payments_on_dividend_id"
    t.index ["paid_date"], name: "index_dividend_payments_on_paid_date"
    t.index ["shareholder_id"], name: "index_dividend_payments_on_shareholder_id"
  end

  create_table "dividends", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.date "declaration_date", null: false
    t.date "record_date"
    t.date "payment_date"
    t.decimal "total_amount", precision: 12, scale: 2, null: false
    t.decimal "franking_percentage", precision: 5, scale: 2, default: "0.0"
    t.string "dividend_type"
    t.string "status", default: "declared"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_dividends_on_company_id"
    t.index ["declaration_date"], name: "index_dividends_on_declaration_date"
    t.index ["dividend_type"], name: "index_dividends_on_dividend_type"
    t.index ["status"], name: "index_dividends_on_status"
  end

  create_table "document_activities", force: :cascade do |t|
    t.bigint "company_document_id", null: false
    t.bigint "user_id"
    t.string "action", null: false
    t.jsonb "old_values", default: {}
    t.jsonb "new_values", default: {}
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["action"], name: "index_document_activities_on_action"
    t.index ["company_document_id"], name: "index_document_activities_on_company_document_id"
    t.index ["created_at"], name: "index_document_activities_on_created_at"
    t.index ["user_id"], name: "index_document_activities_on_user_id"
  end

  create_table "document_duplicate_reviews", force: :cascade do |t|
    t.bigint "case_id", null: false
    t.bigint "existing_document_id", null: false
    t.bigint "new_document_id"
    t.string "new_file_path"
    t.string "new_file_hash"
    t.string "new_file_name"
    t.bigint "new_file_size"
    t.string "source_type"
    t.string "status", default: "pending"
    t.string "resolution"
    t.bigint "resolved_by_id"
    t.datetime "resolved_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["case_id", "status"], name: "index_document_duplicate_reviews_on_case_id_and_status"
    t.index ["case_id"], name: "index_document_duplicate_reviews_on_case_id"
    t.index ["existing_document_id"], name: "index_document_duplicate_reviews_on_existing_document_id"
    t.index ["new_document_id"], name: "index_document_duplicate_reviews_on_new_document_id"
    t.index ["resolved_by_id"], name: "index_document_duplicate_reviews_on_resolved_by_id"
  end

  create_table "document_folders", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.integer "order_position", default: 0, null: false
    t.jsonb "entity_types", default: [], null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "sharepoint_path"
    t.integer "parent_id"
    t.index ["entity_types"], name: "index_document_folders_on_entity_types", using: :gin
    t.index ["name"], name: "index_document_folders_on_name", unique: true
    t.index ["order_position"], name: "index_document_folders_on_order_position"
    t.index ["parent_id"], name: "index_document_folders_on_parent_id"
  end

  create_table "document_tasks", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "category"
    t.string "name"
    t.text "description"
    t.boolean "required"
    t.boolean "has_document"
    t.boolean "is_validated"
    t.datetime "uploaded_at"
    t.string "uploaded_by"
    t.datetime "validated_at"
    t.string "validated_by"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "sharepoint_url"
    t.index ["job_id"], name: "index_document_tasks_on_job_id"
  end

  create_table "document_templates", force: :cascade do |t|
    t.string "name"
    t.text "description"
    t.string "category"
    t.string "sharepoint_site_id"
    t.string "sharepoint_drive_id"
    t.string "sharepoint_item_id"
    t.string "sharepoint_path"
    t.string "output_format"
    t.string "output_naming_pattern"
    t.jsonb "data_schema"
    t.boolean "is_active"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "sort_order", default: 0, null: false
    t.string "template_type", default: "word", null: false
    t.string "local_template_path"
    t.string "layout"
    t.boolean "is_legal_format", default: false, null: false
    t.string "legal_source"
    t.index ["category", "sort_order"], name: "index_document_templates_on_category_and_sort_order"
    t.index ["is_legal_format"], name: "index_document_templates_on_is_legal_format"
    t.index ["template_type"], name: "index_document_templates_on_template_type"
  end

  create_table "document_type_folders", force: :cascade do |t|
    t.bigint "document_type_id", null: false
    t.bigint "document_folder_id", null: false
    t.boolean "is_primary", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["document_folder_id"], name: "index_document_type_folders_on_document_folder_id"
    t.index ["document_type_id", "document_folder_id"], name: "idx_doc_type_folders_unique", unique: true
    t.index ["document_type_id"], name: "index_document_type_folders_on_document_type_id"
  end

  create_table "document_types", force: :cascade do |t|
    t.string "name", null: false
    t.string "folder"
    t.text "description"
    t.string "category"
    t.boolean "requires_filing", default: false
    t.integer "retention_years"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "tabs", default: []
    t.string "primary_tab"
    t.string "name_format"
    t.string "file_name"
    t.string "abbreviation"
    t.jsonb "aliases", default: []
    t.string "display_name"
    t.string "scope", default: "company"
    t.string "file_extensions", default: [], array: true
    t.string "target_folder"
    t.index ["active"], name: "index_document_types_on_active"
    t.index ["aliases"], name: "index_document_types_on_aliases", using: :gin
    t.index ["category"], name: "index_document_types_on_category"
    t.index ["file_extensions"], name: "index_document_types_on_file_extensions", using: :gin
    t.index ["folder"], name: "index_document_types_on_folder"
    t.index ["name"], name: "index_document_types_on_name", unique: true
    t.index ["primary_tab"], name: "index_document_types_on_primary_tab"
    t.index ["scope"], name: "index_document_types_on_scope"
  end

  create_table "document_verification_feedbacks", force: :cascade do |t|
    t.bigint "company_document_id", null: false
    t.bigint "user_id", null: false
    t.string "ai_suggested_name"
    t.string "ai_suggested_folder"
    t.string "ai_suggested_type"
    t.string "ai_suggested_fy"
    t.integer "ai_confidence"
    t.string "user_final_name"
    t.string "user_final_folder"
    t.string "user_final_type"
    t.string "user_final_fy"
    t.string "action", null: false
    t.text "rejection_reason"
    t.text "document_text_snippet"
    t.string "company_code"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["action"], name: "index_document_verification_feedbacks_on_action"
    t.index ["company_code", "action"], name: "idx_on_company_code_action_af023a5fcb"
    t.index ["company_code"], name: "index_document_verification_feedbacks_on_company_code"
    t.index ["company_document_id"], name: "index_document_verification_feedbacks_on_company_document_id"
    t.index ["user_id"], name: "index_document_verification_feedbacks_on_user_id"
  end

  create_table "documentation_categories", force: :cascade do |t|
    t.string "name", null: false
    t.string "icon"
    t.string "color"
    t.text "description"
    t.integer "sequence_order", default: 0
    t.boolean "is_default", default: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "folder_path"
    t.index ["name"], name: "index_documentation_categories_on_name", unique: true
  end

  create_table "e_signature_certificates", force: :cascade do |t|
    t.bigint "e_signature_request_id", null: false
    t.string "certificate_number", null: false
    t.string "original_document_hash", null: false
    t.string "signed_document_hash", null: false
    t.text "signature_chain"
    t.jsonb "signers_summary", default: []
    t.string "certificate_sharepoint_file_id"
    t.string "verification_token"
    t.datetime "generated_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["certificate_number"], name: "index_e_signature_certificates_on_certificate_number", unique: true
    t.index ["e_signature_request_id"], name: "index_e_signature_certificates_on_e_signature_request_id"
    t.index ["verification_token"], name: "index_e_signature_certificates_on_verification_token", unique: true
  end

  create_table "e_signature_events", force: :cascade do |t|
    t.bigint "e_signature_request_id", null: false
    t.bigint "e_signature_signer_id"
    t.string "event_type", null: false
    t.string "event_description"
    t.jsonb "event_data", default: {}
    t.string "actor_type"
    t.string "actor_name"
    t.string "actor_email"
    t.bigint "actor_user_id"
    t.string "ip_address"
    t.string "user_agent"
    t.string "document_hash"
    t.datetime "occurred_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["actor_user_id"], name: "index_e_signature_events_on_actor_user_id"
    t.index ["e_signature_request_id", "occurred_at"], name: "idx_on_e_signature_request_id_occurred_at_050cd1cbe8"
    t.index ["e_signature_request_id"], name: "index_e_signature_events_on_e_signature_request_id"
    t.index ["e_signature_signer_id"], name: "index_e_signature_events_on_e_signature_signer_id"
    t.index ["event_type"], name: "index_e_signature_events_on_event_type"
    t.index ["occurred_at"], name: "index_e_signature_events_on_occurred_at"
  end

  create_table "e_signature_fields", force: :cascade do |t|
    t.bigint "e_signature_request_id", null: false
    t.bigint "e_signature_signer_id", null: false
    t.string "field_type", null: false
    t.integer "page_number", null: false
    t.float "x_percent", null: false
    t.float "y_percent", null: false
    t.float "width_percent", null: false
    t.float "height_percent", null: false
    t.string "label"
    t.boolean "required", default: true
    t.string "date_format", default: "%d/%m/%Y"
    t.string "placeholder"
    t.text "value"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["e_signature_request_id", "page_number"], name: "idx_esign_fields_request_page"
    t.index ["e_signature_request_id"], name: "index_e_signature_fields_on_e_signature_request_id"
    t.index ["e_signature_signer_id", "completed_at"], name: "idx_esign_fields_signer_completion"
    t.index ["e_signature_signer_id"], name: "index_e_signature_fields_on_e_signature_signer_id"
  end

  create_table "e_signature_requests", force: :cascade do |t|
    t.string "request_number", null: false
    t.string "title", null: false
    t.text "description"
    t.string "status", default: "draft", null: false
    t.string "documentable_type"
    t.bigint "documentable_id"
    t.string "original_document_hash"
    t.string "signed_document_hash"
    t.string "original_sharepoint_file_id"
    t.string "signed_sharepoint_file_id"
    t.string "sharepoint_site_id"
    t.string "sharepoint_drive_id"
    t.datetime "sent_at"
    t.datetime "expires_at"
    t.datetime "completed_at"
    t.datetime "declined_at"
    t.bigint "created_by_id"
    t.integer "signing_order", default: 0
    t.boolean "send_reminders", default: true
    t.integer "reminder_interval_days", default: 3
    t.datetime "last_reminder_sent_at"
    t.text "message_to_signers"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_e_signature_requests_on_created_by_id"
    t.index ["documentable_type", "documentable_id"], name: "index_e_signature_requests_on_documentable"
    t.index ["expires_at"], name: "index_e_signature_requests_on_expires_at"
    t.index ["request_number"], name: "index_e_signature_requests_on_request_number", unique: true
    t.index ["status"], name: "index_e_signature_requests_on_status"
  end

  create_table "e_signature_signers", force: :cascade do |t|
    t.bigint "e_signature_request_id", null: false
    t.string "name", null: false
    t.string "email", null: false
    t.string "role"
    t.integer "signing_order", default: 0
    t.string "status", default: "pending", null: false
    t.datetime "notified_at"
    t.datetime "viewed_at"
    t.datetime "signed_at"
    t.datetime "declined_at"
    t.string "access_token_hash"
    t.datetime "access_token_expires_at"
    t.string "email_verification_code"
    t.datetime "email_verification_expires_at"
    t.datetime "email_verified_at"
    t.integer "email_verification_attempts", default: 0
    t.text "signature_data"
    t.string "signature_type"
    t.string "typed_signature_font"
    t.string "ip_address"
    t.string "user_agent"
    t.string "signing_device"
    t.string "browser_fingerprint"
    t.bigint "contact_id"
    t.text "decline_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["access_token_hash"], name: "index_e_signature_signers_on_access_token_hash"
    t.index ["contact_id"], name: "index_e_signature_signers_on_contact_id"
    t.index ["e_signature_request_id", "signing_order"], name: "idx_on_e_signature_request_id_signing_order_31457daad3"
    t.index ["e_signature_request_id"], name: "index_e_signature_signers_on_e_signature_request_id"
    t.index ["email"], name: "index_e_signature_signers_on_email"
    t.index ["status"], name: "index_e_signature_signers_on_status"
  end

  create_table "email_attachments", id: :bigint, default: nil, force: :cascade do |t|
    t.bigint "email_warehouse_id", null: false
    t.string "outlook_attachment_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "attachment_id"
    t.string "filename"
    t.string "sharepoint_path"
    t.string "content_hash"
  end

  create_table "email_blacklist_items", id: :bigint, default: nil, force: :cascade do |t|
    t.string "pattern", null: false
    t.string "pattern_type", null: false
    t.text "description"
    t.boolean "active", default: true, null: false
    t.integer "match_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_case_proposals", id: :bigint, default: nil, force: :cascade do |t|
    t.bigint "email_warehouse_id"
    t.bigint "case_record_id"
    t.bigint "created_by_id"
    t.bigint "approved_by_id"
    t.string "status", default: "pending", null: false
    t.jsonb "extracted_data", default: {}
    t.text "ai_prompt"
    t.text "ai_response_raw"
    t.integer "processing_time_ms"
    t.string "ai_model_used"
    t.decimal "confidence_score", precision: 3, scale: 2
    t.text "rejection_reason"
    t.text "error_message"
    t.datetime "approved_at"
    t.jsonb "folder_paths", default: []
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_job_proposals", id: :bigint, default: nil, force: :cascade do |t|
    t.bigint "email_warehouse_id", null: false
    t.bigint "created_by_user_id", null: false
    t.bigint "job_id"
    t.jsonb "extracted_data", default: {}, null: false
    t.text "ai_prompt"
    t.text "ai_response_raw"
    t.integer "processing_time_ms"
    t.string "ai_model_used"
    t.string "status", default: "pending", null: false
    t.text "rejection_reason"
    t.text "error_message"
    t.bigint "approved_by_user_id"
    t.datetime "approved_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_recipients", id: :bigint, default: nil, force: :cascade do |t|
    t.bigint "email_warehouse_id", null: false
    t.bigint "user_id"
    t.bigint "contact_id"
    t.string "email_address", null: false
    t.string "recipient_type", null: false
    t.boolean "is_internal", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_sync_statuses", id: :bigint, default: nil, force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "status", default: "pending"
    t.datetime "last_sync_at"
    t.datetime "sync_started_at"
    t.datetime "oldest_email_synced"
    t.integer "total_emails_synced", default: 0
    t.integer "emails_synced_this_run", default: 0
    t.text "last_error"
    t.string "sync_cursor"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_warehouse", force: :cascade do |t|
    t.string "internet_message_id", null: false
    t.string "outlook_id"
    t.string "conversation_id"
    t.string "subject"
    t.text "body_text"
    t.text "body_html"
    t.string "from_email"
    t.string "from_name"
    t.text "to_emails", default: [], array: true
    t.text "cc_emails", default: [], array: true
    t.text "bcc_emails", default: [], array: true
    t.datetime "received_at"
    t.datetime "sent_at"
    t.boolean "has_attachments", default: false
    t.integer "attachment_count", default: 0
    t.string "importance"
    t.boolean "is_read", default: false
    t.string "folder_name"
    t.string "in_reply_to"
    t.text "references", default: [], array: true
    t.boolean "is_latest_in_thread", default: true
    t.bigint "job_id"
    t.string "match_type"
    t.float "match_confidence"
    t.datetime "matched_at"
    t.bigint "synced_by_user_id"
    t.datetime "first_synced_at"
    t.datetime "last_synced_at"
    t.tsvector "searchable"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "internet_headers", default: {}
    t.jsonb "email_classification", default: {}
    t.string "user_classification"
    t.datetime "user_classification_at"
    t.bigint "user_classification_by_id"
    t.bigint "ssot_owner_id"
    t.string "body_preview", limit: 500
    t.text "ai_summary"
    t.jsonb "extracted_contacts", default: {}
    t.jsonb "extracted_entities", default: {}
    t.jsonb "action_items", default: []
    t.bigint "microsoft_credential_id"
    t.string "mailbox_owner_email"
    t.string "sharepoint_email_file_id"
    t.string "sharepoint_email_path"
    t.bigint "contact_ids", default: [], array: true
    t.bigint "primary_contact_id"
    t.datetime "contacts_matched_at"
    t.string "source_type", default: "outlook"
    t.bigint "imap_credential_id"
  end

  create_table "emails", id: :bigint, default: nil, force: :cascade do |t|
    t.bigint "job_id"
    t.bigint "user_id"
    t.string "from_email", null: false
    t.text "to_emails"
    t.text "cc_emails"
    t.text "bcc_emails"
    t.text "subject"
    t.text "body_text"
    t.text "body_html"
    t.string "message_id"
    t.string "in_reply_to"
    t.text "references"
    t.datetime "received_at"
    t.boolean "has_attachments", default: false
    t.integer "attachment_count", default: 0
    t.text "raw_email"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "entity_tab_document_types", force: :cascade do |t|
    t.bigint "entity_tab_id", null: false
    t.bigint "document_type_id", null: false
    t.boolean "is_primary", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["document_type_id", "is_primary"], name: "idx_entity_tab_doc_types_primary"
    t.index ["document_type_id"], name: "index_entity_tab_document_types_on_document_type_id"
    t.index ["entity_tab_id", "document_type_id"], name: "idx_entity_tab_doc_types_unique", unique: true
    t.index ["entity_tab_id"], name: "index_entity_tab_document_types_on_entity_tab_id"
  end

  create_table "entity_tabs", force: :cascade do |t|
    t.string "scope", null: false
    t.string "tab_key", null: false
    t.string "display_name", null: false
    t.text "description"
    t.string "tab_group"
    t.bigint "parent_id"
    t.bigint "job_id"
    t.string "entity_filters", default: [], array: true
    t.integer "order_position", default: 0
    t.boolean "enabled", default: true
    t.string "icon_name"
    t.string "component_name"
    t.boolean "is_system_tab", default: false
    t.boolean "has_sharepoint_folder", default: false
    t.string "sharepoint_folder_path"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["enabled"], name: "index_entity_tabs_on_enabled"
    t.index ["entity_filters"], name: "index_entity_tabs_on_entity_filters", using: :gin
    t.index ["job_id"], name: "index_entity_tabs_on_job_id"
    t.index ["parent_id"], name: "index_entity_tabs_on_parent_id"
    t.index ["scope", "enabled"], name: "index_entity_tabs_on_scope_and_enabled"
    t.index ["scope", "tab_group"], name: "index_entity_tabs_on_scope_and_tab_group"
    t.index ["scope", "tab_key", "job_id"], name: "idx_entity_tabs_unique_key", unique: true
    t.index ["scope"], name: "index_entity_tabs_on_scope"
  end

  create_table "estimate_line_items", force: :cascade do |t|
    t.bigint "estimate_id", null: false
    t.string "category"
    t.string "item_description", null: false
    t.decimal "quantity", precision: 15, scale: 3, default: "1.0"
    t.string "unit", default: "ea"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category"], name: "index_estimate_line_items_on_category"
    t.index ["estimate_id"], name: "index_estimate_line_items_on_estimate_id"
  end

  create_table "estimate_reviews", force: :cascade do |t|
    t.bigint "estimate_id", null: false
    t.string "status", default: "pending", null: false
    t.text "ai_findings"
    t.text "discrepancies"
    t.integer "items_matched", default: 0
    t.integer "items_mismatched", default: 0
    t.integer "items_missing", default: 0
    t.integer "items_extra", default: 0
    t.decimal "confidence_score", precision: 5, scale: 2
    t.datetime "reviewed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["estimate_id"], name: "index_estimate_reviews_on_estimate_id"
    t.index ["reviewed_at"], name: "index_estimate_reviews_on_reviewed_at"
    t.index ["status"], name: "index_estimate_reviews_on_status"
  end

  create_table "estimates", force: :cascade do |t|
    t.bigint "job_id"
    t.string "source", default: "unreal_engine", null: false
    t.string "estimator_name"
    t.string "job_name_from_source", null: false
    t.boolean "matched_automatically", default: false
    t.decimal "match_confidence_score", precision: 5, scale: 2
    t.string "status", default: "pending", null: false
    t.integer "total_items", default: 0
    t.datetime "imported_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["imported_at"], name: "index_estimates_on_imported_at"
    t.index ["job_id", "status"], name: "index_estimates_on_construction_and_status"
    t.index ["job_id"], name: "index_estimates_on_job_id"
    t.index ["source"], name: "index_estimates_on_source"
    t.index ["status"], name: "index_estimates_on_status"
  end

  create_table "external_integrations", force: :cascade do |t|
    t.string "name", null: false
    t.string "api_key_digest", null: false
    t.boolean "is_active", default: true
    t.datetime "last_used_at"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["is_active"], name: "index_external_integrations_on_is_active"
    t.index ["name"], name: "index_external_integrations_on_name", unique: true
  end

  create_table "external_invoices", force: :cascade do |t|
    t.string "source", null: false
    t.string "external_id"
    t.string "tenant_id"
    t.string "invoice_number"
    t.string "reference"
    t.string "invoice_type", null: false
    t.string "status"
    t.date "invoice_date"
    t.date "due_date"
    t.date "fully_paid_date"
    t.decimal "subtotal", precision: 15, scale: 4
    t.decimal "total_tax", precision: 15, scale: 4
    t.decimal "total", precision: 15, scale: 4
    t.decimal "amount_due", precision: 15, scale: 4
    t.decimal "amount_paid", precision: 15, scale: 4
    t.string "currency_code", default: "AUD"
    t.string "external_contact_id"
    t.string "contact_name"
    t.bigint "contact_id"
    t.bigint "job_id"
    t.jsonb "raw_data", default: {}
    t.jsonb "line_items", default: []
    t.jsonb "payments", default: []
    t.jsonb "tracking_data", default: []
    t.boolean "sync_enabled", default: true
    t.string "sync_direction", default: "bidirectional"
    t.boolean "created_in_teeem", default: false
    t.boolean "pending_push", default: false
    t.jsonb "conflict_fields", default: {}
    t.datetime "external_updated_at"
    t.datetime "teeem_updated_at"
    t.datetime "last_synced_at"
    t.string "sync_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "source_of_truth", default: "xero"
    t.boolean "sync_to_xero", default: false, null: false
    t.datetime "synced_to_xero_at"
    t.datetime "xero_updated_at"
    t.datetime "local_updated_at"
    t.boolean "sync_conflict", default: false, null: false
    t.bigint "warehouse_contact_id"
    t.index ["contact_id"], name: "index_external_invoices_on_contact_id"
    t.index ["created_in_teeem"], name: "index_external_invoices_on_created_in_teeem"
    t.index ["external_contact_id"], name: "index_external_invoices_on_external_contact_id"
    t.index ["external_id"], name: "index_external_invoices_on_external_id"
    t.index ["invoice_date"], name: "index_external_invoices_on_invoice_date"
    t.index ["invoice_type"], name: "index_external_invoices_on_invoice_type"
    t.index ["job_id", "contact_id", "status"], name: "idx_ext_inv_job_contact_status"
    t.index ["job_id"], name: "index_external_invoices_on_job_id"
    t.index ["pending_push"], name: "index_external_invoices_on_pending_push"
    t.index ["source", "tenant_id", "external_id"], name: "idx_external_invoices_unique", unique: true
    t.index ["source"], name: "index_external_invoices_on_source"
    t.index ["status"], name: "index_external_invoices_on_status"
    t.index ["sync_conflict"], name: "idx_external_invoices_conflicts", where: "(sync_conflict = true)"
    t.index ["sync_enabled"], name: "index_external_invoices_on_sync_enabled"
    t.index ["sync_to_xero", "synced_to_xero_at"], name: "idx_external_invoices_pending_sync"
    t.index ["tenant_id"], name: "index_external_invoices_on_tenant_id"
    t.index ["tracking_data"], name: "index_external_invoices_on_tracking_data", using: :gin
    t.index ["warehouse_contact_id"], name: "index_external_invoices_on_warehouse_contact_id"
  end

  create_table "fact_job_daily_snapshots", force: :cascade do |t|
    t.date "snapshot_date", null: false
    t.bigint "job_id", null: false
    t.decimal "total_income", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_expenses", precision: 15, scale: 2, default: "0.0"
    t.decimal "profit", precision: 15, scale: 2, default: "0.0"
    t.decimal "profit_margin", precision: 5, scale: 2
    t.integer "po_count", default: 0
    t.decimal "po_total_value", precision: 15, scale: 2, default: "0.0"
    t.decimal "po_invoiced_amount", precision: 15, scale: 2, default: "0.0"
    t.integer "invoice_count", default: 0
    t.decimal "invoiced_total", precision: 15, scale: 2, default: "0.0"
    t.decimal "paid_total", precision: 15, scale: 2, default: "0.0"
    t.integer "document_count", default: 0
    t.integer "verified_document_count", default: 0
    t.integer "email_count", default: 0
    t.integer "task_count", default: 0
    t.integer "completed_task_count", default: 0
    t.integer "in_progress_task_count", default: 0
    t.decimal "hours_logged", precision: 10, scale: 2, default: "0.0"
    t.decimal "approved_hours", precision: 10, scale: 2, default: "0.0"
    t.decimal "completion_rate", precision: 5, scale: 2
    t.string "job_status"
    t.string "job_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id", "snapshot_date"], name: "idx_fact_job_snapshot_unique", unique: true
    t.index ["job_id"], name: "index_fact_job_daily_snapshots_on_job_id"
    t.index ["snapshot_date", "job_status"], name: "index_fact_job_daily_snapshots_on_snapshot_date_and_job_status"
    t.index ["snapshot_date"], name: "index_fact_job_daily_snapshots_on_snapshot_date"
  end

  create_table "feature_chapters", force: :cascade do |t|
    t.integer "chapter_number", null: false
    t.string "name", null: false
    t.text "description"
    t.integer "sort_order", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["chapter_number"], name: "index_feature_chapters_on_chapter_number", unique: true
    t.index ["sort_order"], name: "index_feature_chapters_on_sort_order"
  end

  create_table "feature_trackers", force: :cascade do |t|
    t.string "chapter", null: false
    t.string "feature_name", null: false
    t.text "detail_point_1"
    t.text "detail_point_2"
    t.text "detail_point_3"
    t.boolean "system_complete", default: false, null: false
    t.boolean "dev_checked", default: false, null: false
    t.boolean "tester_checked", default: false, null: false
    t.boolean "user_checked", default: false, null: false
    t.integer "sort_order", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "ui_checked", default: false, null: false
    t.integer "dev_progress", default: 0, null: false
    t.boolean "buildertrend_has", default: false, null: false
    t.boolean "buildexact_has", default: false, null: false
    t.boolean "jacks_has", default: false, null: false
    t.boolean "wunderbuilt_has", default: false, null: false
    t.boolean "databuild_has", default: false, null: false
    t.boolean "simpro_has", default: false, null: false
    t.boolean "smarterbuild_has", default: false, null: false
    t.boolean "clickhome_has", default: false, null: false
    t.boolean "teeem_has", default: false, null: false
    t.boolean "clickup_has"
    t.bigint "feature_chapter_id", null: false
    t.boolean "evolve_has"
    t.index ["chapter"], name: "index_feature_trackers_on_chapter"
    t.index ["feature_chapter_id"], name: "index_feature_trackers_on_feature_chapter_id"
    t.index ["sort_order"], name: "index_feature_trackers_on_sort_order"
  end

  create_table "financial_transactions", force: :cascade do |t|
    t.string "transaction_type", null: false
    t.decimal "amount", precision: 10, scale: 2, null: false
    t.date "transaction_date", null: false
    t.text "description"
    t.string "category"
    t.string "status", default: "draft", null: false
    t.bigint "job_id"
    t.bigint "user_id", null: false
    t.bigint "company_id", null: false
    t.bigint "keepr_journal_id"
    t.string "external_system_id"
    t.string "external_system_type"
    t.datetime "synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "sharepoint_file_id"
    t.index ["category"], name: "index_financial_transactions_on_category"
    t.index ["company_id", "status"], name: "index_financial_transactions_on_company_id_and_status"
    t.index ["company_id", "transaction_date"], name: "idx_on_company_id_transaction_date_f27cab6995"
    t.index ["company_id"], name: "index_financial_transactions_on_company_id"
    t.index ["external_system_type", "external_system_id"], name: "index_fin_trans_on_external_system"
    t.index ["job_id", "transaction_date"], name: "index_financial_transactions_on_job_id_and_transaction_date"
    t.index ["job_id"], name: "index_financial_transactions_on_job_id"
    t.index ["keepr_journal_id"], name: "index_financial_transactions_on_keepr_journal_id"
    t.index ["sharepoint_file_id"], name: "index_financial_transactions_on_sharepoint_file_id"
    t.index ["status"], name: "index_financial_transactions_on_status"
    t.index ["transaction_date"], name: "index_financial_transactions_on_transaction_date"
    t.index ["transaction_type"], name: "index_financial_transactions_on_transaction_type"
    t.index ["user_id"], name: "index_financial_transactions_on_user_id"
  end

  create_table "folder_template_items", force: :cascade do |t|
    t.bigint "folder_template_id", null: false
    t.string "name", null: false
    t.integer "level", default: 0, null: false
    t.integer "order", default: 0, null: false
    t.bigint "parent_id"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["folder_template_id", "order"], name: "index_folder_template_items_on_folder_template_id_and_order"
    t.index ["folder_template_id"], name: "index_folder_template_items_on_folder_template_id"
    t.index ["level"], name: "index_folder_template_items_on_level"
    t.index ["parent_id"], name: "index_folder_template_items_on_parent_id"
  end

  create_table "folder_templates", force: :cascade do |t|
    t.string "name", null: false
    t.string "template_type"
    t.boolean "is_system_default", default: false, null: false
    t.boolean "is_active", default: true, null: false
    t.bigint "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_folder_templates_on_created_by_id"
    t.index ["is_active"], name: "index_folder_templates_on_is_active"
    t.index ["is_system_default"], name: "index_folder_templates_on_is_system_default"
    t.index ["name"], name: "index_folder_templates_on_name"
    t.index ["template_type"], name: "index_folder_templates_on_template_type"
  end

  create_table "foundation_views", force: :cascade do |t|
    t.integer "foundation_id"
    t.integer "user_id"
    t.string "name"
    t.string "view_type"
    t.json "filters"
    t.json "columns"
    t.json "sort_order"
    t.boolean "is_default", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "display_order", default: 0
    t.string "group_by_column"
    t.json "group_by_columns"
    t.boolean "is_global", default: false, null: false
    t.string "view_display_type", default: "table", null: false, comment: "Display mode: 'table' for traditional grid, 'relational' for network graph"
    t.index ["foundation_id", "user_id", "display_order"], name: "index_foundation_views_on_foundation_user_order"
    t.index ["foundation_id", "user_id"], name: "index_foundation_views_on_foundation_id_and_user_id"
    t.index ["foundation_id"], name: "index_foundation_views_on_foundation_id"
    t.index ["user_id"], name: "index_foundation_views_on_user_id"
  end

  create_table "foundations", force: :cascade do |t|
    t.string "name", null: false
    t.string "singular_name"
    t.string "plural_name"
    t.string "database_table_name", null: false
    t.string "icon"
    t.string "title_column"
    t.boolean "searchable", default: true
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "is_live", default: false, null: false
    t.string "slug"
    t.string "table_type", default: "user"
    t.string "model_class"
    t.string "api_endpoint"
    t.string "file_location"
    t.boolean "has_saved_views", default: true
    t.string "feature"
    t.boolean "has_ui", default: false
    t.boolean "allow_reserved_name", default: false
    t.decimal "compliance_score", precision: 5, scale: 2
    t.datetime "compliance_checked_at"
    t.jsonb "non_compliant_columns", default: []
    t.index ["compliance_score"], name: "index_foundations_on_compliance_score"
    t.index ["database_table_name"], name: "index_foundations_on_database_table_name", unique: true
    t.index ["model_class"], name: "index_foundations_on_model_class"
    t.index ["slug"], name: "index_foundations_on_slug", unique: true
    t.index ["table_type"], name: "index_foundations_on_table_type"
  end

  create_table "gold_standard_table", force: :cascade do |t|
    t.string "email", limit: 255
    t.string "phone", limit: 20
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "whole_number"
    t.string "mobile", limit: 20
    t.integer "user_id"
    t.text "multiple_category_ids"
    t.string "action_buttons", limit: 255
    t.string "single_line_text", limit: 255
    t.text "multiple_lines_text"
    t.string "url", limit: 500
    t.decimal "number", precision: 15, scale: 2
    t.decimal "currency", precision: 15, scale: 2
    t.decimal "percentage", precision: 15, scale: 2
    t.date "date"
    t.datetime "date_and_time", precision: nil
    t.string "gps_coordinates", limit: 255
    t.string "color_picker", limit: 255
    t.text "file_upload"
    t.boolean "boolean"
    t.string "choice", limit: 50
    t.string "lookup", limit: 255
    t.text "multiple_lookups"
    t.integer "user"
    t.string "computed", limit: 255
    t.jsonb "structured_data", default: {}
    t.text "array_of_items", default: [], array: true
    t.tsvector "searchable_text"
    t.string "abn", limit: 14
    t.string "acn", limit: 11
    t.string "bsb", limit: 7
    t.string "bank_account", limit: 9
    t.string "postcode", limit: 4
    t.string "tfn", limit: 11
    t.index ["user_id"], name: "index_gold_standard_table_on_user_id"
  end

  create_table "grok_plans", force: :cascade do |t|
    t.string "title"
    t.text "description"
    t.jsonb "conversation", default: []
    t.string "status", default: "planning"
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_grok_plans_on_user_id"
  end

  create_table "health_check_caches", force: :cascade do |t|
    t.integer "foundation_id"
    t.string "check_type"
    t.jsonb "results"
    t.datetime "last_run_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "health_kudos_events", force: :cascade do |t|
    t.string "actor_type", default: "user", null: false
    t.bigint "user_id"
    t.string "action", null: false
    t.string "fix_type", null: false
    t.string "record_type"
    t.bigint "record_id"
    t.integer "records_fixed", default: 1
    t.integer "points", default: 0, null: false
    t.jsonb "details", default: {}
    t.string "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["action"], name: "index_health_kudos_events_on_action"
    t.index ["actor_type"], name: "index_health_kudos_events_on_actor_type"
    t.index ["created_at"], name: "index_health_kudos_events_on_created_at"
    t.index ["fix_type"], name: "index_health_kudos_events_on_fix_type"
    t.index ["record_type", "record_id"], name: "index_health_kudos_events_on_record_type_and_record_id"
    t.index ["user_id"], name: "index_health_kudos_events_on_user_id"
  end

  create_table "imap_credentials", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "name"
    t.string "email_address", null: false
    t.string "imap_host", null: false
    t.integer "imap_port", default: 993
    t.boolean "imap_ssl", default: true
    t.string "smtp_host", null: false
    t.integer "smtp_port", default: 587
    t.string "smtp_auth", default: "plain"
    t.string "username", null: false
    t.text "encrypted_password"
    t.string "provider"
    t.datetime "last_synced_at"
    t.string "last_sync_status"
    t.text "last_sync_error"
    t.integer "sync_interval_minutes", default: 15
    t.bigint "last_uid"
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["is_active"], name: "index_imap_credentials_on_is_active"
    t.index ["user_id", "email_address"], name: "index_imap_credentials_on_user_id_and_email_address", unique: true
    t.index ["user_id"], name: "index_imap_credentials_on_user_id"
  end

  create_table "implementation_patterns", force: :cascade do |t|
    t.integer "chapter_number", null: false
    t.string "chapter_name", null: false
    t.string "section_number", null: false
    t.string "pattern_title", null: false
    t.string "bible_rule_reference"
    t.text "quick_start"
    t.text "full_implementation"
    t.text "architecture"
    t.text "common_mistakes"
    t.text "testing"
    t.text "migration_guide"
    t.text "integration"
    t.text "notes"
    t.jsonb "code_examples", default: []
    t.jsonb "metadata", default: {}
    t.text "search_text"
    t.string "complexity", default: "medium"
    t.string "languages", default: [], array: true
    t.string "tags", default: [], array: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["chapter_number", "section_number"], name: "index_implementation_patterns_on_chapter_and_section", unique: true
    t.index ["chapter_number"], name: "index_implementation_patterns_on_chapter_number"
    t.index ["complexity"], name: "index_implementation_patterns_on_complexity"
    t.index ["languages"], name: "index_implementation_patterns_on_languages", using: :gin
    t.index ["search_text"], name: "index_implementation_patterns_on_search_text", opclass: :gin_trgm_ops, using: :gin
    t.index ["section_number"], name: "index_implementation_patterns_on_section_number"
    t.index ["tags"], name: "index_implementation_patterns_on_tags", using: :gin
  end

  create_table "import_sessions", force: :cascade do |t|
    t.string "session_key"
    t.string "file_path"
    t.string "original_filename"
    t.integer "file_size"
    t.datetime "expires_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "status", default: "pending"
    t.decimal "progress", precision: 5, scale: 2, default: "0.0"
    t.integer "total_rows", default: 0
    t.integer "processed_rows", default: 0
    t.datetime "completed_at"
    t.text "error_message"
    t.json "result"
    t.integer "foundation_id"
    t.text "file_data"
    t.index ["foundation_id"], name: "index_import_sessions_on_foundation_id"
    t.index ["session_key"], name: "index_import_sessions_on_session_key", unique: true
    t.index ["status"], name: "index_import_sessions_on_status"
  end

  create_table "inspiring_quotes", force: :cascade do |t|
    t.text "quote", null: false
    t.string "author"
    t.string "category"
    t.boolean "is_active", default: true, null: false
    t.integer "display_order", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "aussie_slang"
    t.index ["display_order"], name: "index_inspiring_quotes_on_display_order"
    t.index ["is_active"], name: "index_inspiring_quotes_on_is_active"
  end

  create_table "insurance_policies", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "cover_type"
    t.string "insured_party"
    t.date "start_date"
    t.date "renewal_date"
    t.decimal "annual_premium"
    t.decimal "monthly_premium"
    t.string "broker"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_insurance_policies_on_company_id"
  end

  create_table "intercompany_balances", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "related_company_id", null: false
    t.string "balance_type", null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.string "currency", default: "AUD"
    t.string "source", null: false
    t.string "source_reference"
    t.date "as_of_date", null: false
    t.text "description"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["balance_type"], name: "index_intercompany_balances_on_balance_type"
    t.index ["company_id", "as_of_date"], name: "index_intercompany_balances_on_company_id_and_as_of_date"
    t.index ["company_id", "related_company_id", "balance_type", "as_of_date"], name: "idx_intercompany_balances_unique", unique: true
    t.index ["company_id"], name: "index_intercompany_balances_on_company_id"
    t.index ["related_company_id", "as_of_date"], name: "idx_on_related_company_id_as_of_date_a4e1451467"
    t.index ["related_company_id"], name: "index_intercompany_balances_on_related_company_id"
    t.index ["source"], name: "index_intercompany_balances_on_source"
  end

  create_table "invoice_templates", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.jsonb "sections", default: []
    t.string "logo_url"
    t.string "primary_color", default: "#1f2937"
    t.string "accent_color", default: "#4f46e5"
    t.string "font_family", default: "Inter, sans-serif"
    t.string "paper_size", default: "A4"
    t.string "orientation", default: "portrait"
    t.jsonb "margins", default: {"top"=>20, "left"=>20, "right"=>20, "bottom"=>20}
    t.string "output_naming_pattern", default: "{invoice_number}_{date}"
    t.boolean "is_active", default: true, null: false
    t.boolean "is_default", default: false, null: false
    t.text "default_terms"
    t.text "default_notes"
    t.text "footer_text"
    t.string "bank_name"
    t.string "bank_bsb"
    t.string "bank_account_number"
    t.string "bank_account_name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["is_active"], name: "index_invoice_templates_on_is_active"
    t.index ["is_default"], name: "index_invoice_templates_on_is_default"
  end

  create_table "job_activities", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "user_id"
    t.string "activity_type", null: false
    t.text "description"
    t.jsonb "metadata", default: {}
    t.string "related_type"
    t.bigint "related_id"
    t.string "related_url"
    t.datetime "occurred_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["activity_type"], name: "index_job_activities_on_activity_type"
    t.index ["job_id", "activity_type"], name: "idx_job_activities_job_type"
    t.index ["job_id", "occurred_at"], name: "idx_job_activities_job_occurred"
    t.index ["job_id"], name: "index_job_activities_on_job_id"
    t.index ["occurred_at"], name: "index_job_activities_on_occurred_at"
    t.index ["related_type", "related_id"], name: "index_job_activities_on_related_type_and_related_id"
    t.index ["user_id"], name: "index_job_activities_on_user_id"
  end

  create_table "job_claim_stages", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "job_id", null: false
    t.bigint "claim_stage_template_id"
    t.bigint "external_invoice_id"
    t.string "name", null: false
    t.decimal "percentage", precision: 5, scale: 2
    t.decimal "expected_amount", precision: 12, scale: 2
    t.integer "sequence_order", default: 0, null: false
    t.string "description"
    t.string "match_status", default: "unmatched", null: false
    t.datetime "matched_at"
    t.string "payment_status", default: "pending", null: false
    t.decimal "amount_invoiced", precision: 12, scale: 2, default: "0.0"
    t.decimal "amount_paid", precision: 12, scale: 2, default: "0.0"
    t.date "payment_date"
    t.boolean "is_custom", default: false, null: false
    t.index ["claim_stage_template_id"], name: "index_job_claim_stages_on_claim_stage_template_id"
    t.index ["external_invoice_id"], name: "index_job_claim_stages_on_external_invoice_id"
    t.index ["job_id", "external_invoice_id"], name: "idx_job_claim_stages_invoice", unique: true
    t.index ["job_id", "sequence_order"], name: "idx_job_claim_stages_ordering"
    t.index ["job_id"], name: "index_job_claim_stages_on_job_id"
    t.index ["match_status"], name: "index_job_claim_stages_on_match_status"
    t.index ["payment_status"], name: "index_job_claim_stages_on_payment_status"
  end

  create_table "job_claims", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "invoice_number"
    t.text "description"
    t.decimal "amount", precision: 15, scale: 2
    t.decimal "amount_paid", precision: 15, scale: 2, default: "0.0"
    t.decimal "amount_due", precision: 15, scale: 2
    t.string "status", default: "draft"
    t.date "date"
    t.date "due_date"
    t.string "xero_invoice_id"
    t.string "xero_contact_id"
    t.string "contact_name"
    t.bigint "contact_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id"], name: "index_job_claims_on_contact_id"
    t.index ["invoice_number"], name: "index_job_claims_on_invoice_number"
    t.index ["job_id"], name: "index_job_claims_on_job_id"
    t.index ["status"], name: "index_job_claims_on_status"
    t.index ["xero_contact_id"], name: "index_job_claims_on_xero_contact_id"
    t.index ["xero_invoice_id"], name: "index_job_claims_on_xero_invoice_id", unique: true
  end

  create_table "job_colour_selections", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "category_key", null: false
    t.string "item_key", null: false
    t.bigint "pricebook_item_id"
    t.string "colour_name"
    t.string "colour_code"
    t.string "colour_brand"
    t.text "notes"
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id", "category_key", "item_key"], name: "idx_job_colours_unique", unique: true
    t.index ["job_id"], name: "index_job_colour_selections_on_job_id"
    t.index ["pricebook_item_id"], name: "index_job_colour_selections_on_pricebook_item_id"
  end

  create_table "job_contacts", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "contact_id"
    t.boolean "primary", default: false, null: false
    t.string "role"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["contact_id"], name: "index_job_contacts_on_contact_id"
    t.index ["job_id", "contact_id"], name: "index_job_contacts_on_job_id_and_contact_id", unique: true
    t.index ["job_id", "primary"], name: "index_job_contacts_on_job_id_and_primary"
    t.index ["job_id"], name: "index_job_contacts_on_job_id"
    t.index ["user_id"], name: "index_job_contacts_on_user_id"
  end

  create_table "job_documentation_tabs", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "name", null: false
    t.string "icon"
    t.string "color"
    t.text "description"
    t.integer "sequence_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "folder_path"
    t.bigint "parent_id"
    t.index ["job_id", "name", "parent_id"], name: "index_job_doc_tabs_on_job_name_parent", unique: true
    t.index ["job_id", "sequence_order"], name: "index_job_documentation_tabs_on_job_id_and_sequence_order"
    t.index ["job_id"], name: "index_job_documentation_tabs_on_job_id"
    t.index ["parent_id"], name: "index_job_documentation_tabs_on_parent_id"
  end

  create_table "job_documents", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "document_type_id"
    t.string "sharepoint_item_id", null: false
    t.string "sharepoint_drive_id"
    t.string "file_name", null: false
    t.string "file_extension"
    t.string "file_type"
    t.bigint "file_size"
    t.string "folder_path"
    t.string "web_url"
    t.string "thumbnail_url"
    t.string "version_id"
    t.datetime "last_modified_at"
    t.string "last_modified_by"
    t.string "sync_status", default: "synced"
    t.datetime "last_synced_at"
    t.jsonb "cad_metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "ai_suggested_type_id"
    t.string "ai_proposed_name"
    t.decimal "ai_confidence", precision: 5, scale: 2
    t.text "ai_reasoning"
    t.datetime "ai_analyzed_at"
    t.string "rename_status", default: "pending"
    t.datetime "rename_approved_at"
    t.bigint "rename_approved_by_id"
    t.string "original_file_name"
    t.string "title"
    t.text "description"
    t.date "document_date"
    t.string "display_title"
    t.string "mime_type"
    t.integer "financial_years", default: [], array: true
    t.string "ai_verification_status"
    t.datetime "ai_verified_at"
    t.datetime "user_validated_at"
    t.bigint "user_validated_by_id"
    t.boolean "validation_required", default: false
    t.string "content_hash"
    t.string "external_id"
    t.string "source", default: "manual"
    t.string "storage_type"
    t.bigint "contact_id"
    t.bigint "company_id"
    t.bigint "legacy_corporate_document_id"
    t.index ["ai_analyzed_at"], name: "index_job_documents_on_ai_analyzed_at"
    t.index ["ai_suggested_type_id"], name: "index_job_documents_on_ai_suggested_type_id"
    t.index ["company_id"], name: "index_job_documents_on_company_id"
    t.index ["contact_id"], name: "index_job_documents_on_contact_id"
    t.index ["content_hash"], name: "index_job_documents_on_content_hash"
    t.index ["document_type_id"], name: "index_job_documents_on_document_type_id"
    t.index ["external_id"], name: "index_job_documents_on_external_id"
    t.index ["file_type"], name: "index_job_documents_on_file_type"
    t.index ["financial_years"], name: "index_job_documents_on_financial_years", using: :gin
    t.index ["job_id", "file_type"], name: "index_job_documents_on_job_id_and_file_type"
    t.index ["job_id", "folder_path"], name: "index_job_documents_on_job_id_and_folder_path"
    t.index ["job_id"], name: "index_job_documents_on_job_id"
    t.index ["legacy_corporate_document_id"], name: "index_job_documents_on_legacy_corporate_document_id"
    t.index ["rename_approved_by_id"], name: "index_job_documents_on_rename_approved_by_id"
    t.index ["rename_status"], name: "index_job_documents_on_rename_status"
    t.index ["sharepoint_drive_id"], name: "index_job_documents_on_sharepoint_drive_id"
    t.index ["sharepoint_item_id"], name: "index_job_documents_on_sharepoint_item_id", unique: true
    t.index ["sync_status"], name: "index_job_documents_on_sync_status"
    t.index ["version_id"], name: "index_job_documents_on_version_id"
  end

  create_table "job_people", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "contact_id", null: false
    t.string "role"
    t.text "notes"
    t.boolean "is_primary", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id"], name: "index_job_people_on_contact_id"
    t.index ["job_id", "contact_id"], name: "index_job_people_on_job_id_and_contact_id", unique: true
    t.index ["job_id", "is_primary"], name: "index_job_people_on_job_id_and_is_primary"
    t.index ["job_id"], name: "index_job_people_on_job_id"
  end

  create_table "job_plan_revisions", force: :cascade do |t|
    t.bigint "job_plan_id", null: false
    t.string "revision", null: false
    t.date "revision_date"
    t.date "issued_date"
    t.boolean "is_on_issue", default: false
    t.string "sharepoint_file_id"
    t.string "sharepoint_web_url"
    t.string "file_name"
    t.integer "file_size"
    t.text "notes"
    t.bigint "issued_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "thumbnail_file_id"
    t.string "thumbnail_url"
    t.datetime "thumbnail_generated_at"
    t.text "micro_thumbnail_base64"
    t.index ["is_on_issue"], name: "index_job_plan_revisions_on_is_on_issue"
    t.index ["issued_by_id"], name: "index_job_plan_revisions_on_issued_by_id"
    t.index ["job_plan_id", "revision"], name: "index_job_plan_revisions_on_job_plan_id_and_revision", unique: true
    t.index ["job_plan_id"], name: "index_job_plan_revisions_on_job_plan_id"
    t.index ["thumbnail_file_id"], name: "index_job_plan_revisions_on_thumbnail_file_id"
  end

  create_table "job_plan_tabs", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "plan_category_id"
    t.bigint "parent_id"
    t.string "name", null: false
    t.string "code"
    t.integer "sequence_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id", "plan_category_id"], name: "index_job_plan_tabs_on_job_id_and_plan_category_id"
    t.index ["job_id"], name: "index_job_plan_tabs_on_job_id"
    t.index ["parent_id"], name: "index_job_plan_tabs_on_parent_id"
    t.index ["plan_category_id"], name: "index_job_plan_tabs_on_plan_category_id"
  end

  create_table "job_plans", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "job_plan_tab_id"
    t.bigint "plan_type_id"
    t.string "variant_suffix"
    t.string "display_name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "current_revision_id"
    t.boolean "is_combined_pdf", default: false, null: false
    t.index ["current_revision_id"], name: "index_job_plans_on_current_revision_id"
    t.index ["job_id", "plan_type_id", "variant_suffix"], name: "idx_job_plans_unique_per_job", unique: true
    t.index ["job_id"], name: "index_job_plans_on_job_id"
    t.index ["job_plan_tab_id"], name: "index_job_plans_on_job_plan_tab_id"
    t.index ["plan_type_id"], name: "index_job_plans_on_plan_type_id"
  end

  create_table "job_specifications", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "section_key", null: false
    t.string "item_key", null: false
    t.bigint "pricebook_item_id"
    t.string "custom_value"
    t.text "notes"
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id", "section_key", "item_key"], name: "idx_job_specs_unique", unique: true
    t.index ["job_id"], name: "index_job_specifications_on_job_id"
    t.index ["pricebook_item_id"], name: "index_job_specifications_on_pricebook_item_id"
  end

  create_table "job_stages", force: :cascade do |t|
    t.string "name", null: false
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.string "color"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "job_status_id"
    t.index ["is_active"], name: "index_job_stages_on_is_active"
    t.index ["job_status_id"], name: "index_job_stages_on_job_status_id"
    t.index ["position"], name: "index_job_stages_on_position"
  end

  create_table "job_status", force: :cascade do |t|
    t.string "name", null: false
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.string "color"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["is_active"], name: "index_job_status_on_is_active"
    t.index ["position"], name: "index_job_status_on_position"
  end

  create_table "job_status_stages", force: :cascade do |t|
    t.bigint "job_type_id", null: false
    t.bigint "job_status_id", null: false
    t.bigint "job_stage_id", null: false
    t.integer "position", default: 0
    t.boolean "is_required", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_stage_id"], name: "index_job_status_stages_on_job_stage_id"
    t.index ["job_status_id"], name: "index_job_status_stages_on_job_status_id"
    t.index ["job_type_id", "job_status_id", "job_stage_id"], name: "index_job_status_stages_on_type_status_stage", unique: true
    t.index ["job_type_id"], name: "index_job_status_stages_on_job_type_id"
    t.index ["position"], name: "index_job_status_stages_on_position"
  end

  create_table "job_tabs", force: :cascade do |t|
    t.string "name", null: false
    t.string "slug", null: false
    t.string "icon", null: false
    t.integer "position", default: 0, null: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["is_active"], name: "index_job_tabs_on_is_active"
    t.index ["position"], name: "index_job_tabs_on_position"
    t.index ["slug"], name: "index_job_tabs_on_slug", unique: true
  end

  create_table "job_type_statuses", force: :cascade do |t|
    t.bigint "job_type_id", null: false
    t.bigint "job_status_id", null: false
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_status_id"], name: "index_job_type_statuses_on_job_status_id"
    t.index ["job_type_id", "job_status_id"], name: "index_job_type_statuses_on_job_type_id_and_job_status_id", unique: true
    t.index ["job_type_id"], name: "index_job_type_statuses_on_job_type_id"
    t.index ["position"], name: "index_job_type_statuses_on_position"
  end

  create_table "job_types", force: :cascade do |t|
    t.string "name", null: false
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "icon"
    t.string "color", default: "#6366F1"
    t.text "description"
    t.index ["is_active"], name: "index_job_types_on_is_active"
    t.index ["position"], name: "index_job_types_on_position"
  end

  create_table "jobs", force: :cascade do |t|
    t.string "name"
    t.decimal "contract_value", precision: 15, scale: 2
    t.decimal "live_profit", precision: 15, scale: 2
    t.decimal "profit_percentage", precision: 10, scale: 2
    t.string "certifier_job_no"
    t.date "start_date"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "purchase_orders_count", default: 0, null: false
    t.string "site_supervisor_name", default: "Andrew Clement"
    t.string "site_supervisor_phone", default: "0407 150 081"
    t.string "sharepoint_folder_status", default: "not_requested"
    t.decimal "latitude", precision: 10, scale: 6
    t.decimal "longitude", precision: 10, scale: 6
    t.string "location"
    t.bigint "job_type_id"
    t.bigint "job_status_id"
    t.string "xero_tracking_option_id"
    t.string "xero_tracking_option_name"
    t.datetime "archived_at"
    t.string "archive_reason"
    t.bigint "archived_by_id"
    t.string "lot_number"
    t.string "street_number"
    t.string "street_name"
    t.string "street_type"
    t.string "suburb"
    t.string "postcode", limit: 4
    t.string "state", limit: 3
    t.string "council"
    t.integer "job_stage_id"
    t.string "plan_number"
    t.decimal "contract_price", precision: 12, scale: 2
    t.decimal "deposit", precision: 12, scale: 2
    t.decimal "prime_cost", precision: 12, scale: 2
    t.decimal "provisional_sums", precision: 12, scale: 2
    t.date "contract_date"
    t.string "build_period"
    t.string "stage_slab"
    t.string "stage_frame"
    t.string "stage_enclosed"
    t.string "stage_fixing"
    t.string "stage_practical"
    t.string "stage_weather"
    t.string "weekend_work"
    t.date "plan_date"
    t.date "spec_date"
    t.date "practical_completion_date"
    t.date "warranty_end_date"
    t.boolean "resident_owner", default: true
    t.integer "construction_days", default: 300
    t.decimal "liquidated_damages", precision: 10, scale: 2, default: "50.0"
    t.boolean "certification_by_owner", default: false
    t.text "prime_cost_details"
    t.text "provisional_sums_details"
    t.boolean "has_special_conditions", default: false
    t.text "special_conditions"
    t.boolean "finance_approval_required"
    t.date "finance_approval_date"
    t.index ["archived_at", "job_status_id"], name: "idx_jobs_archived_status"
    t.index ["archived_at"], name: "index_jobs_on_archived_at"
    t.index ["archived_by_id"], name: "index_jobs_on_archived_by_id"
    t.index ["council"], name: "index_jobs_on_council"
    t.index ["created_at"], name: "index_jobs_on_created_at"
    t.index ["job_stage_id"], name: "index_jobs_on_job_stage_id"
    t.index ["job_status_id"], name: "index_jobs_on_job_status_id"
    t.index ["job_type_id"], name: "index_jobs_on_job_type_id"
    t.index ["postcode"], name: "index_jobs_on_postcode"
    t.index ["sharepoint_folder_status"], name: "index_jobs_on_sharepoint_folder_status"
    t.index ["suburb"], name: "index_jobs_on_suburb"
    t.index ["xero_tracking_option_id"], name: "index_jobs_on_xero_tracking_option_id"
  end

  create_table "known_parties", force: :cascade do |t|
    t.string "name", null: false
    t.string "email"
    t.string "phone"
    t.string "organisation"
    t.string "relationship_type"
    t.string "default_alignment", default: "neutral"
    t.text "notes"
    t.bigint "contact_id"
    t.integer "seen_count", default: 1
    t.datetime "last_seen_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id"], name: "index_known_parties_on_contact_id"
    t.index ["email"], name: "index_known_parties_on_email", unique: true, where: "(email IS NOT NULL)"
    t.index ["name", "organisation"], name: "index_known_parties_on_name_and_organisation", unique: true
    t.index ["relationship_type"], name: "index_known_parties_on_relationship_type"
  end

  create_table "kudos_events", force: :cascade do |t|
    t.bigint "subcontractor_account_id", null: false
    t.bigint "quote_response_id"
    t.bigint "purchase_order_id"
    t.string "event_type", null: false
    t.datetime "expected_time"
    t.datetime "actual_time"
    t.decimal "points_awarded", precision: 10, scale: 2, default: "0.0"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_kudos_events_on_created_at"
    t.index ["event_type"], name: "index_kudos_events_on_event_type"
    t.index ["purchase_order_id"], name: "index_kudos_events_on_purchase_order_id"
    t.index ["quote_response_id"], name: "index_kudos_events_on_quote_response_id"
    t.index ["subcontractor_account_id", "event_type"], name: "index_kudos_events_on_subcontractor_account_id_and_event_type"
    t.index ["subcontractor_account_id"], name: "index_kudos_events_on_subcontractor_account_id"
  end

  create_table "leads", force: :cascade do |t|
    t.string "lead_number"
    t.string "title"
    t.string "status", default: "new"
    t.string "source"
    t.string "client_name"
    t.string "client_email"
    t.string "client_phone"
    t.string "client_company"
    t.string "site_address"
    t.string "site_suburb"
    t.string "site_state"
    t.string "site_postcode"
    t.string "lot_plan_number"
    t.string "project_type"
    t.string "dwelling_type"
    t.integer "number_of_storeys"
    t.decimal "estimated_floor_area", precision: 10, scale: 2
    t.decimal "estimated_value", precision: 12, scale: 2, default: "0.0"
    t.date "expected_start_date"
    t.string "decision_timeline"
    t.text "notes"
    t.bigint "job_id"
    t.integer "contract_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contract_id"], name: "index_leads_on_contract_id"
    t.index ["job_id"], name: "index_leads_on_job_id"
    t.index ["lead_number"], name: "index_leads_on_lead_number", unique: true
    t.index ["status"], name: "index_leads_on_status"
  end

  create_table "maintenance_requests", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "supplier_contact_id"
    t.bigint "reported_by_user_id"
    t.bigint "purchase_order_id"
    t.string "request_number", null: false
    t.string "status", default: "open", null: false
    t.string "priority", default: "medium"
    t.string "category"
    t.string "title", null: false
    t.text "description"
    t.text "resolution_notes"
    t.date "reported_date", null: false
    t.date "due_date"
    t.date "resolved_date"
    t.boolean "warranty_claim", default: false
    t.decimal "estimated_cost", precision: 10, scale: 2
    t.decimal "actual_cost", precision: 10, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id", "status"], name: "index_maintenance_requests_on_job_id_and_status"
    t.index ["job_id"], name: "index_maintenance_requests_on_job_id"
    t.index ["purchase_order_id"], name: "index_maintenance_requests_on_purchase_order_id"
    t.index ["reported_by_user_id"], name: "index_maintenance_requests_on_reported_by_user_id"
    t.index ["request_number"], name: "index_maintenance_requests_on_request_number", unique: true
    t.index ["status"], name: "index_maintenance_requests_on_status"
    t.index ["supplier_contact_id", "status"], name: "index_maintenance_requests_on_supplier_contact_id_and_status"
    t.index ["supplier_contact_id"], name: "index_maintenance_requests_on_supplier_contact_id"
  end

  create_table "meeting_agenda_items", force: :cascade do |t|
    t.bigint "meeting_id", null: false
    t.string "title", null: false
    t.text "description"
    t.integer "sequence_order", null: false
    t.integer "duration_minutes"
    t.bigint "presenter_id"
    t.boolean "completed", default: false
    t.text "notes"
    t.bigint "created_task_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sm_task_id"
    t.index ["completed"], name: "index_meeting_agenda_items_on_completed"
    t.index ["created_task_id"], name: "index_meeting_agenda_items_on_created_task_id"
    t.index ["meeting_id", "sequence_order"], name: "index_meeting_agenda_items_on_meeting_id_and_sequence_order"
    t.index ["meeting_id"], name: "index_meeting_agenda_items_on_meeting_id"
    t.index ["presenter_id"], name: "index_meeting_agenda_items_on_presenter_id"
    t.index ["sm_task_id"], name: "index_meeting_agenda_items_on_sm_task_id"
  end

  create_table "meeting_participants", force: :cascade do |t|
    t.bigint "meeting_id", null: false
    t.bigint "user_id"
    t.bigint "contact_id"
    t.string "response_status", default: "pending"
    t.boolean "is_organizer", default: false
    t.boolean "is_required", default: true
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id"], name: "index_meeting_participants_on_contact_id"
    t.index ["meeting_id", "contact_id"], name: "index_meeting_participants_on_meeting_id_and_contact_id", unique: true, where: "(contact_id IS NOT NULL)"
    t.index ["meeting_id", "user_id"], name: "index_meeting_participants_on_meeting_id_and_user_id", unique: true, where: "(user_id IS NOT NULL)"
    t.index ["meeting_id"], name: "index_meeting_participants_on_meeting_id"
    t.index ["response_status"], name: "index_meeting_participants_on_response_status"
    t.index ["user_id"], name: "index_meeting_participants_on_user_id"
    t.check_constraint "user_id IS NOT NULL AND contact_id IS NULL OR user_id IS NULL AND contact_id IS NOT NULL", name: "meeting_participants_must_have_user_or_contact"
  end

  create_table "meeting_types", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.string "icon"
    t.string "color"
    t.integer "default_duration_minutes", default: 60
    t.text "required_participant_types"
    t.text "optional_participant_types"
    t.integer "minimum_participants"
    t.integer "maximum_participants"
    t.text "default_agenda_items"
    t.text "required_fields"
    t.text "optional_fields"
    t.text "custom_fields"
    t.text "required_documents"
    t.text "notification_settings"
    t.boolean "is_active", default: true
    t.boolean "is_system_default", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category"], name: "index_meeting_types_on_category"
    t.index ["is_active"], name: "index_meeting_types_on_is_active"
    t.index ["name"], name: "index_meeting_types_on_name", unique: true
  end

  create_table "meetings", force: :cascade do |t|
    t.string "title", null: false
    t.text "description"
    t.datetime "start_time", null: false
    t.datetime "end_time", null: false
    t.string "location"
    t.string "meeting_type", null: false
    t.string "status", default: "scheduled", null: false
    t.bigint "job_id", null: false
    t.bigint "created_by_id", null: false
    t.text "notes"
    t.string "video_url"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "meeting_type_id", null: false
    t.index ["created_by_id"], name: "index_meetings_on_created_by_id"
    t.index ["job_id", "start_time"], name: "index_meetings_on_job_id_and_start_time"
    t.index ["job_id"], name: "index_meetings_on_job_id"
    t.index ["meeting_type"], name: "index_meetings_on_meeting_type"
    t.index ["meeting_type_id"], name: "index_meetings_on_meeting_type_id"
    t.index ["start_time"], name: "index_meetings_on_start_time"
    t.index ["status"], name: "index_meetings_on_status"
  end

  create_table "microsoft_credentials", force: :cascade do |t|
    t.string "owner_type"
    t.bigint "owner_id"
    t.string "credential_type", null: false
    t.string "name"
    t.string "client_id"
    t.text "client_secret"
    t.string "tenant_id"
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "token_expires_at"
    t.text "scopes"
    t.string "email"
    t.string "status", default: "pending", null: false
    t.string "error_code"
    t.text "error_message"
    t.datetime "last_error_at"
    t.boolean "refresh_token_dead", default: false, null: false
    t.integer "consecutive_failures", default: 0, null: false
    t.datetime "last_refresh_attempt_at"
    t.datetime "admin_consent_granted_at"
    t.string "admin_consent_granted_by"
    t.string "sharepoint_site_id"
    t.string "sharepoint_drive_id"
    t.string "sharepoint_drive_name"
    t.string "drive_id"
    t.string "drive_name"
    t.string "root_folder_id"
    t.string "root_folder_path"
    t.jsonb "sync_config", default: {}
    t.jsonb "metadata", default: {}
    t.jsonb "bulk_sync_progress", default: {}
    t.datetime "last_sync_at"
    t.bigint "setup_by_id"
    t.bigint "connected_by_id"
    t.boolean "is_active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "organization_id", null: false
    t.index ["connected_by_id"], name: "index_microsoft_credentials_on_connected_by_id"
    t.index ["credential_type", "is_active"], name: "idx_ms_creds_type_active"
    t.index ["name", "is_active"], name: "idx_ms_creds_name_unique_active", unique: true, where: "((is_active = true) AND (name IS NOT NULL))"
    t.index ["organization_id", "credential_type", "is_active"], name: "idx_ms_creds_org_type_active_unique", unique: true, where: "((is_active = true) AND (organization_id IS NOT NULL))"
    t.index ["organization_id"], name: "index_microsoft_credentials_on_organization_id"
    t.index ["owner_type", "owner_id", "credential_type"], name: "idx_ms_creds_owner_type"
    t.index ["owner_type", "owner_id", "is_active"], name: "idx_ms_creds_owner_active"
    t.index ["owner_type", "owner_id"], name: "index_microsoft_credentials_on_owner"
    t.index ["refresh_token_dead"], name: "idx_ms_creds_dead"
    t.index ["setup_by_id"], name: "index_microsoft_credentials_on_setup_by_id"
    t.index ["status"], name: "idx_ms_creds_status"
    t.index ["token_expires_at"], name: "idx_ms_creds_token_expires"
  end

  create_table "minute_templates", force: :cascade do |t|
    t.string "name", null: false
    t.string "template_type"
    t.text "body"
    t.jsonb "required_fields", default: []
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active"], name: "index_minute_templates_on_active"
    t.index ["name"], name: "index_minute_templates_on_name", unique: true
    t.index ["template_type"], name: "index_minute_templates_on_template_type"
  end

  create_table "mv_refresh_logs", force: :cascade do |t|
    t.string "view_name", null: false
    t.datetime "started_at", null: false
    t.datetime "completed_at"
    t.integer "row_count"
    t.integer "previous_row_count"
    t.float "duration_seconds"
    t.string "status", default: "in_progress", null: false
    t.text "error_message"
    t.string "triggered_by"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["started_at"], name: "index_mv_refresh_logs_on_started_at"
    t.index ["status"], name: "index_mv_refresh_logs_on_status"
    t.index ["view_name", "started_at"], name: "index_mv_refresh_logs_on_view_name_and_started_at"
    t.index ["view_name", "status"], name: "index_mv_refresh_logs_on_view_name_and_status"
    t.index ["view_name"], name: "index_mv_refresh_logs_on_view_name"
  end

  create_table "navigation_groups", force: :cascade do |t|
    t.string "name", null: false
    t.string "icon", default: "Folder"
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.boolean "is_collapsible", default: true
    t.string "visible_to_roles", default: [], array: true
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.datetime "updated_at", default: -> { "now()" }, null: false
  end

  create_table "navigation_items", force: :cascade do |t|
    t.bigint "navigation_group_id"
    t.string "name", null: false
    t.string "href", null: false
    t.string "icon", null: false
    t.string "badge_key"
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.string "visible_to_roles", default: [], array: true
    t.bigint "parent_id"
    t.boolean "is_collapsed_default", default: true
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.datetime "updated_at", default: -> { "now()" }, null: false
  end

  create_table "ndis_addendums", force: :cascade do |t|
    t.string "document_type", null: false
    t.string "section_key"
    t.string "title", null: false
    t.text "content", null: false
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["document_type"], name: "index_ndis_addendums_on_document_type"
  end

  create_table "notifications", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "notification_type", null: false
    t.string "notifiable_type"
    t.bigint "notifiable_id"
    t.string "title", null: false
    t.text "message"
    t.boolean "read", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["notifiable_type", "notifiable_id"], name: "index_notifications_on_notifiable"
    t.index ["user_id", "created_at"], name: "index_notifications_on_user_id_and_created_at"
    t.index ["user_id", "read"], name: "index_notifications_on_user_id_and_read"
    t.index ["user_id"], name: "index_notifications_on_user_id"
  end

  create_table "one_drive_credentials", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "token_expires_at"
    t.string "drive_id"
    t.string "root_folder_id"
    t.string "folder_path"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["drive_id"], name: "index_one_drive_credentials_on_drive_id"
    t.index ["job_id"], name: "index_one_drive_credentials_on_job_id", unique: true
    t.index ["root_folder_id"], name: "index_one_drive_credentials_on_root_folder_id"
    t.index ["token_expires_at"], name: "index_one_drive_credentials_on_token_expires_at"
  end

  create_table "organization_microsoft_app_credentials", force: :cascade do |t|
    t.string "client_id"
    t.text "client_secret"
    t.string "tenant_id"
    t.text "access_token"
    t.datetime "token_expires_at", precision: nil
    t.boolean "is_active", default: true
    t.string "status", default: "pending"
    t.text "last_error"
    t.datetime "admin_consent_granted_at", precision: nil
    t.string "admin_consent_granted_by"
    t.jsonb "sync_config", default: {}
    t.datetime "last_sync_at", precision: nil
    t.bigint "setup_by_id"
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.string "name"
    t.string "sharepoint_site_id"
    t.string "sharepoint_drive_id"
    t.string "sharepoint_drive_name"
    t.jsonb "bulk_sync_progress", default: {}
    t.bigint "organization_id", null: false
    t.index ["is_active"], name: "index_org_ms_app_creds_on_is_active"
    t.index ["name", "is_active"], name: "index_org_microsoft_app_creds_on_name_and_active", unique: true, where: "(is_active = true)"
    t.index ["name"], name: "index_org_ms_app_creds_on_name"
    t.index ["organization_id", "is_active"], name: "idx_legacy_ms_creds_org_active_unique", unique: true, where: "((is_active = true) AND (organization_id IS NOT NULL))"
    t.index ["organization_id"], name: "idx_on_organization_id_ec93e8b0f4"
    t.index ["setup_by_id"], name: "index_organization_microsoft_app_credentials_on_setup_by_id"
    t.index ["sharepoint_drive_id"], name: "idx_on_sharepoint_drive_id_0a6d5a1255"
    t.index ["sharepoint_site_id"], name: "idx_on_sharepoint_site_id_47efe5ba09"
    t.index ["tenant_id"], name: "index_org_microsoft_app_credentials_on_tenant_id"
  end

  create_table "organization_one_drive_credentials", force: :cascade do |t|
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "token_expires_at"
    t.string "drive_id"
    t.string "drive_name"
    t.string "root_folder_id"
    t.string "root_folder_path"
    t.jsonb "metadata", default: {}
    t.boolean "is_active", default: true
    t.bigint "connected_by_id"
    t.datetime "last_synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
    t.index ["connected_by_id"], name: "index_organization_one_drive_credentials_on_connected_by_id"
    t.index ["drive_id"], name: "index_organization_one_drive_credentials_on_drive_id"
    t.index ["is_active"], name: "index_org_onedrive_creds_on_is_active"
    t.index ["name"], name: "index_org_onedrive_creds_on_name"
    t.index ["root_folder_id"], name: "index_organization_one_drive_credentials_on_root_folder_id"
    t.index ["token_expires_at"], name: "index_organization_one_drive_credentials_on_token_expires_at"
  end

  create_table "organization_outlook_credentials", force: :cascade do |t|
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "expires_at"
    t.string "email"
    t.string "tenant_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
    t.index ["name"], name: "index_org_outlook_creds_on_name"
  end

  create_table "organizations", force: :cascade do |t|
    t.string "name", null: false
    t.string "slug", null: false
    t.boolean "is_active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_organizations_on_name", unique: true
    t.index ["slug"], name: "index_organizations_on_slug", unique: true
  end

  create_table "pay_now_requests", force: :cascade do |t|
    t.bigint "purchase_order_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "requested_by_portal_user_id"
    t.decimal "original_amount", precision: 15, scale: 2, null: false
    t.decimal "discount_percentage", precision: 5, scale: 2, default: "5.0", null: false
    t.decimal "discount_amount", precision: 15, scale: 2, null: false
    t.decimal "discounted_amount", precision: 15, scale: 2, null: false
    t.string "status", default: "pending", null: false
    t.bigint "reviewed_by_supervisor_id"
    t.datetime "supervisor_reviewed_at"
    t.text "supervisor_notes"
    t.bigint "approved_by_builder_id"
    t.datetime "builder_approved_at"
    t.text "builder_notes"
    t.bigint "payment_id"
    t.datetime "paid_at"
    t.text "supplier_notes"
    t.date "requested_payment_date"
    t.datetime "rejected_at"
    t.text "rejection_reason"
    t.bigint "pay_now_weekly_limit_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "sharepoint_file_id"
    t.jsonb "proof_photos_sharepoint_ids", default: []
    t.index ["approved_by_builder_id"], name: "index_pay_now_requests_on_approved_by_builder_id"
    t.index ["contact_id", "status"], name: "index_pay_now_requests_on_contact_and_status"
    t.index ["contact_id"], name: "index_pay_now_requests_on_contact_id"
    t.index ["created_at"], name: "index_pay_now_requests_on_created_at"
    t.index ["pay_now_weekly_limit_id"], name: "index_pay_now_requests_on_pay_now_weekly_limit_id"
    t.index ["payment_id"], name: "index_pay_now_requests_on_payment_id"
    t.index ["purchase_order_id", "status"], name: "index_pay_now_requests_on_po_and_status"
    t.index ["purchase_order_id"], name: "index_pay_now_requests_on_purchase_order_id"
    t.index ["requested_by_portal_user_id"], name: "index_pay_now_requests_on_requested_by_portal_user_id"
    t.index ["requested_payment_date"], name: "index_pay_now_requests_on_requested_payment_date"
    t.index ["reviewed_by_supervisor_id"], name: "index_pay_now_requests_on_reviewed_by_supervisor_id"
    t.index ["sharepoint_file_id"], name: "index_pay_now_requests_on_sharepoint_file_id"
    t.index ["status", "created_at"], name: "index_pay_now_requests_on_status_and_created_at"
    t.index ["status"], name: "index_pay_now_requests_on_status"
  end

  create_table "pay_now_weekly_limits", force: :cascade do |t|
    t.decimal "total_limit", precision: 15, scale: 2, default: "0.0", null: false
    t.decimal "used_amount", precision: 15, scale: 2, default: "0.0", null: false
    t.decimal "remaining_amount", precision: 15, scale: 2, default: "0.0", null: false
    t.date "week_start_date", null: false
    t.date "week_end_date", null: false
    t.boolean "active", default: true, null: false
    t.bigint "set_by_id"
    t.decimal "previous_limit", precision: 15, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active", "week_start_date"], name: "index_pay_now_weekly_limits_on_active_and_week"
    t.index ["active"], name: "index_pay_now_weekly_limits_on_active"
    t.index ["set_by_id"], name: "index_pay_now_weekly_limits_on_set_by_id"
    t.index ["week_start_date"], name: "index_pay_now_weekly_limits_on_week_start_date"
  end

  create_table "payments", force: :cascade do |t|
    t.bigint "purchase_order_id", null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.date "payment_date", null: false
    t.string "payment_method"
    t.string "reference_number"
    t.text "notes"
    t.string "xero_payment_id"
    t.datetime "xero_synced_at"
    t.text "xero_sync_error"
    t.bigint "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_payments_on_created_by_id"
    t.index ["payment_date"], name: "index_payments_on_payment_date"
    t.index ["purchase_order_id", "payment_date"], name: "index_payments_on_purchase_order_id_and_payment_date"
    t.index ["purchase_order_id"], name: "index_payments_on_purchase_order_id"
    t.index ["xero_payment_id"], name: "index_payments_on_xero_payment_id"
  end

  create_table "pdf_field_positions", force: :cascade do |t|
    t.string "pdf_template_key", null: false
    t.string "field_key", null: false
    t.string "display_name"
    t.integer "page", default: 1
    t.decimal "x", precision: 10, scale: 2
    t.decimal "y", precision: 10, scale: 2
    t.integer "font_size", default: 10
    t.string "test_value"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "box_width"
    t.integer "box_height"
    t.string "text_align"
    t.string "pdf_form_field_name"
    t.index ["pdf_template_key", "field_key"], name: "index_pdf_field_positions_on_pdf_template_key_and_field_key", unique: true
  end

  create_table "people_documents", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.string "title", null: false
    t.text "description"
    t.string "document_type", null: false
    t.date "document_date"
    t.date "expiry_date"
    t.string "document_number"
    t.string "issuing_authority"
    t.string "issuing_country"
    t.string "file_name"
    t.integer "file_size"
    t.string "mime_type"
    t.datetime "uploaded_at"
    t.string "folder"
    t.string "source", default: "manual"
    t.bigint "document_type_id"
    t.string "content_hash"
    t.string "external_id"
    t.bigint "legacy_corporate_document_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id"], name: "index_people_documents_on_contact_id"
    t.index ["content_hash"], name: "index_people_documents_on_content_hash"
    t.index ["document_date"], name: "index_people_documents_on_document_date"
    t.index ["document_type"], name: "index_people_documents_on_document_type"
    t.index ["document_type_id"], name: "index_people_documents_on_document_type_id"
    t.index ["expiry_date"], name: "index_people_documents_on_expiry_date"
    t.index ["external_id"], name: "index_people_documents_on_external_id"
    t.index ["legacy_corporate_document_id"], name: "index_people_documents_on_legacy_corporate_document_id"
  end

  create_table "permissions", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.boolean "enabled", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category"], name: "index_permissions_on_category"
    t.index ["name"], name: "index_permissions_on_name", unique: true
  end

  create_table "plan_categories", force: :cascade do |t|
    t.string "name", null: false
    t.string "code"
    t.integer "sequence_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_plan_categories_on_code", unique: true
    t.index ["sequence_order"], name: "index_plan_categories_on_sequence_order"
  end

  create_table "plan_category_plan_types", force: :cascade do |t|
    t.bigint "plan_category_id", null: false
    t.bigint "plan_type_id", null: false
    t.integer "sequence_order", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["plan_category_id", "plan_type_id"], name: "idx_plan_cat_type_unique", unique: true
    t.index ["plan_category_id"], name: "index_plan_category_plan_types_on_plan_category_id"
    t.index ["plan_type_id"], name: "index_plan_category_plan_types_on_plan_type_id"
  end

  create_table "plan_folder_scans", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "sharepoint_file_id", null: false
    t.string "file_name"
    t.datetime "file_modified_at"
    t.integer "file_size"
    t.string "status", default: "pending"
    t.bigint "job_plan_id"
    t.text "error_message"
    t.datetime "processed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id", "status"], name: "index_plan_folder_scans_on_job_id_and_status"
    t.index ["job_id"], name: "index_plan_folder_scans_on_job_id"
    t.index ["job_plan_id"], name: "index_plan_folder_scans_on_job_plan_id"
    t.index ["sharepoint_file_id"], name: "index_plan_folder_scans_on_sharepoint_file_id", unique: true
    t.index ["status"], name: "index_plan_folder_scans_on_status"
  end

  create_table "plan_identification_rules", force: :cascade do |t|
    t.string "rule_type", null: false
    t.string "match_text", null: false
    t.bigint "plan_type_id", null: false
    t.integer "priority", default: 0
    t.integer "success_count", default: 0
    t.integer "failure_count", default: 0
    t.boolean "is_active", default: true
    t.bigint "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_plan_identification_rules_on_created_by_id"
    t.index ["is_active", "priority"], name: "index_plan_identification_rules_on_is_active_and_priority", order: { priority: :desc }
    t.index ["plan_type_id", "match_text"], name: "index_plan_identification_rules_on_plan_type_id_and_match_text", unique: true
    t.index ["plan_type_id"], name: "index_plan_identification_rules_on_plan_type_id"
    t.index ["rule_type"], name: "index_plan_identification_rules_on_rule_type"
  end

  create_table "plan_identifications", force: :cascade do |t|
    t.bigint "job_plan_id", null: false
    t.bigint "identified_plan_type_id"
    t.bigint "identified_plan_category_id"
    t.text "ocr_raw_text"
    t.jsonb "ocr_structured_fields", default: {}
    t.integer "ocr_confidence"
    t.integer "pattern_match_plan_type_id"
    t.integer "pattern_match_confidence"
    t.string "pattern_match_reason"
    t.integer "ai_plan_type_id"
    t.integer "ai_confidence"
    t.text "ai_reasoning"
    t.boolean "ai_invoked", default: false
    t.string "sheet_number"
    t.string "sheet_name"
    t.string "sheet_date"
    t.string "sheet_issue"
    t.integer "final_confidence"
    t.string "decision_status"
    t.boolean "human_reviewed", default: false
    t.bigint "reviewed_by_id"
    t.datetime "reviewed_at"
    t.integer "human_override_plan_type_id"
    t.text "human_override_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["decision_status"], name: "index_plan_identifications_on_decision_status"
    t.index ["human_reviewed"], name: "index_plan_identifications_on_human_reviewed"
    t.index ["identified_plan_category_id"], name: "index_plan_identifications_on_identified_plan_category_id"
    t.index ["identified_plan_type_id"], name: "index_plan_identifications_on_identified_plan_type_id"
    t.index ["job_plan_id", "created_at"], name: "index_plan_identifications_on_job_plan_id_and_created_at", order: { created_at: :desc }
    t.index ["job_plan_id"], name: "index_plan_identifications_on_job_plan_id"
    t.index ["reviewed_by_id"], name: "index_plan_identifications_on_reviewed_by_id"
  end

  create_table "plan_reextractions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "status", default: "pending"
    t.string "current_step"
    t.integer "total_plans"
    t.integer "processed_plans"
    t.string "current_plan_name"
    t.jsonb "plans_updated", default: []
    t.jsonb "rename_errors", default: []
    t.text "error_message"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id"], name: "index_plan_reextractions_on_job_id"
    t.index ["status"], name: "index_plan_reextractions_on_status"
  end

  create_table "plan_types", force: :cascade do |t|
    t.string "name", null: false
    t.string "code", null: false
    t.boolean "allows_variants", default: true
    t.text "notes"
    t.integer "sequence_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "short_name_template", default: "{Code}-{Name}"
    t.string "long_name_template", default: "{JobCode}-{Code}-{Name}-Rev{Rev}"
    t.index ["code"], name: "index_plan_types_on_code", unique: true
    t.index ["name"], name: "index_plan_types_on_name", unique: true
    t.index ["sequence_order"], name: "index_plan_types_on_sequence_order"
  end

  create_table "plan_uploads", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "uploaded_by_id"
    t.bigint "job_plan_tab_id"
    t.string "status", default: "pending", null: false
    t.string "current_step"
    t.text "error_message"
    t.string "original_filename", null: false
    t.string "staging_file_id"
    t.bigint "file_size"
    t.integer "total_pages"
    t.integer "processed_pages", default: 0
    t.jsonb "plans_created", default: []
    t.integer "retry_count", default: 0
    t.datetime "last_retry_at"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id", "status"], name: "index_plan_uploads_on_job_id_and_status"
    t.index ["job_id"], name: "index_plan_uploads_on_job_id"
    t.index ["job_plan_tab_id"], name: "index_plan_uploads_on_job_plan_tab_id"
    t.index ["staging_file_id"], name: "index_plan_uploads_on_staging_file_id"
    t.index ["status"], name: "index_plan_uploads_on_status"
    t.index ["uploaded_by_id"], name: "index_plan_uploads_on_uploaded_by_id"
  end

  create_table "portal_access_logs", force: :cascade do |t|
    t.bigint "portal_user_id", null: false
    t.string "action"
    t.string "ip_address"
    t.string "user_agent"
    t.jsonb "metadata"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["action"], name: "index_portal_access_logs_on_action"
    t.index ["created_at"], name: "index_portal_access_logs_on_created_at"
    t.index ["portal_user_id", "created_at"], name: "index_portal_access_logs_on_portal_user_id_and_created_at"
    t.index ["portal_user_id"], name: "index_portal_access_logs_on_portal_user_id"
  end

  create_table "portal_users", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.string "email", null: false
    t.string "password_digest", null: false
    t.string "portal_type", null: false
    t.boolean "active", default: true
    t.datetime "last_login_at"
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.integer "failed_login_attempts", default: 0
    t.datetime "locked_until"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id", "portal_type"], name: "index_portal_users_on_contact_id_and_portal_type", unique: true
    t.index ["contact_id"], name: "index_portal_users_on_contact_id"
    t.index ["email"], name: "index_portal_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_portal_users_on_reset_password_token", unique: true
  end

  create_table "price_histories", force: :cascade do |t|
    t.bigint "pricebook_item_id", null: false
    t.decimal "old_price", precision: 10, scale: 2
    t.decimal "new_price", precision: 10, scale: 2
    t.string "change_reason"
    t.bigint "changed_by_user_id"
    t.bigint "supplier_id"
    t.string "quote_reference"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "lga"
    t.date "date_effective"
    t.string "user_name"
    t.index ["changed_by_user_id"], name: "index_price_histories_on_changed_by_user_id"
    t.index ["created_at"], name: "index_price_histories_on_created_at"
    t.index ["pricebook_item_id", "supplier_id", "new_price", "created_at"], name: "index_price_histories_on_unique_combination", unique: true, comment: "Prevents duplicate price history entries from race conditions"
    t.index ["pricebook_item_id"], name: "index_price_histories_on_pricebook_item_id"
    t.index ["supplier_id"], name: "index_price_histories_on_supplier_id"
  end

  create_table "pricebook", force: :cascade do |t|
    t.string "item_code", null: false
    t.string "item_name", null: false
    t.string "category"
    t.string "unit_of_measure", default: "Each"
    t.decimal "current_price", precision: 10, scale: 2
    t.bigint "supplier_id"
    t.string "brand"
    t.text "notes"
    t.boolean "is_active", default: true
    t.boolean "needs_pricing_review", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.tsvector "searchable_text"
    t.datetime "price_last_updated_at"
    t.string "image_url"
    t.string "image_source"
    t.datetime "image_fetched_at"
    t.string "image_fetch_status"
    t.bigint "default_supplier_id"
    t.string "qr_code_url"
    t.boolean "requires_photo", default: false
    t.boolean "requires_spec", default: false
    t.string "spec_url"
    t.string "gst_code"
    t.boolean "photo_attached", default: false
    t.boolean "spec_attached", default: false
    t.string "image_file_id"
    t.string "spec_file_id"
    t.string "qr_code_file_id"
    t.integer "category_id"
    t.decimal "supplier_price", precision: 10, scale: 2
    t.string "colour"
    t.string "colour_code"
    t.string "colour_brand"
    t.index ["category", "is_active", "supplier_id"], name: "index_pricebook_items_on_category_active_supplier"
    t.index ["category"], name: "index_pricebook_on_category"
    t.index ["category_id"], name: "index_pricebook_on_category_id"
    t.index ["colour"], name: "index_pricebook_on_colour"
    t.index ["default_supplier_id"], name: "index_pricebook_on_default_supplier_id"
    t.index ["image_fetch_status"], name: "index_pricebook_on_image_fetch_status"
    t.index ["image_file_id"], name: "index_pricebook_on_image_file_id"
    t.index ["is_active"], name: "index_pricebook_on_is_active"
    t.index ["item_code"], name: "index_pricebook_on_item_code", unique: true
    t.index ["needs_pricing_review"], name: "index_pricebook_on_needs_pricing_review"
    t.index ["price_last_updated_at"], name: "index_pricebook_on_price_last_updated_at"
    t.index ["qr_code_file_id"], name: "index_pricebook_on_qr_code_file_id"
    t.index ["searchable_text"], name: "idx_pricebook_search", using: :gin
    t.index ["spec_file_id"], name: "index_pricebook_on_spec_file_id"
    t.index ["supplier_id"], name: "index_pricebook_on_supplier_id"
  end

  create_table "pricebook_categories", force: :cascade do |t|
    t.string "name", null: false
    t.string "display_name"
    t.string "color", default: "#6B7280"
    t.string "icon"
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["is_active"], name: "index_pricebook_categories_on_is_active"
    t.index ["name"], name: "index_pricebook_categories_on_name", unique: true
    t.index ["position"], name: "index_pricebook_categories_on_position"
  end

  create_table "profit_loss_reports", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "company_name", null: false
    t.string "company_code"
    t.string "financial_year", null: false
    t.date "report_date"
    t.date "period_start"
    t.date "period_end"
    t.decimal "total_revenue", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_expenses", precision: 15, scale: 2, default: "0.0"
    t.decimal "net_profit", precision: 15, scale: 2, default: "0.0"
    t.jsonb "report_data"
    t.string "cloudinary_public_id"
    t.string "cloudinary_url"
    t.string "file_name"
    t.integer "file_size"
    t.string "status", default: "pending"
    t.datetime "generated_at"
    t.text "error_message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_code"], name: "index_profit_loss_reports_on_company_code"
    t.index ["company_id", "financial_year"], name: "idx_pl_reports_unique", unique: true
    t.index ["company_id"], name: "index_profit_loss_reports_on_company_id"
    t.index ["financial_year"], name: "index_profit_loss_reports_on_financial_year"
    t.index ["status"], name: "index_profit_loss_reports_on_status"
  end

  create_table "project_task_checklist_items", force: :cascade do |t|
    t.bigint "project_task_id", null: false
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.boolean "is_completed", default: false
    t.datetime "completed_at"
    t.string "completed_by"
    t.integer "sequence_order", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "response_type", default: "checkbox"
    t.text "response_note"
    t.string "response_photo_url"
    t.index ["is_completed"], name: "index_project_task_checklist_items_on_is_completed"
    t.index ["project_task_id", "sequence_order"], name: "idx_on_project_task_id_sequence_order_cc3d531d29"
    t.index ["project_task_id"], name: "index_project_task_checklist_items_on_project_task_id"
  end

  create_table "project_tasks", force: :cascade do |t|
    t.bigint "project_id", null: false
    t.bigint "task_template_id"
    t.bigint "purchase_order_id"
    t.string "name", null: false
    t.string "task_type", null: false
    t.string "category", null: false
    t.string "task_code"
    t.string "status", default: "not_started"
    t.integer "progress_percentage", default: 0
    t.date "planned_start_date"
    t.date "planned_end_date"
    t.date "actual_start_date"
    t.date "actual_end_date"
    t.integer "duration_days", default: 1
    t.bigint "assigned_to_id"
    t.string "supplier_name"
    t.boolean "is_milestone", default: false
    t.boolean "is_critical_path", default: false
    t.text "notes"
    t.text "completion_notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "sequence_order"
    t.date "required_on_site_date"
    t.bigint "schedule_template_row_id"
    t.string "spawned_type"
    t.bigint "parent_task_id"
    t.boolean "requires_supervisor_check", default: false, null: false
    t.datetime "supervisor_checked_at"
    t.bigint "supervisor_checked_by_id"
    t.datetime "photo_uploaded_at"
    t.datetime "certificate_uploaded_at"
    t.jsonb "tags", default: [], null: false
    t.boolean "critical_po", default: false, null: false
    t.boolean "auto_complete_predecessors", default: false, null: false
    t.jsonb "auto_complete_task_ids", default: [], null: false
    t.jsonb "subtask_template_ids", default: [], null: false
    t.boolean "manual_task", default: false, null: false
    t.boolean "allow_multiple_instances", default: false, null: false
    t.boolean "order_required", default: false, null: false
    t.boolean "call_up_required", default: false, null: false
    t.boolean "plan_required", default: false, null: false
    t.integer "duration", default: 0, null: false
    t.index ["assigned_to_id"], name: "index_project_tasks_on_assigned_to_id"
    t.index ["is_critical_path"], name: "index_project_tasks_on_is_critical_path"
    t.index ["parent_task_id"], name: "index_project_tasks_on_parent_task_id"
    t.index ["planned_start_date", "planned_end_date"], name: "index_project_tasks_on_planned_start_date_and_planned_end_date"
    t.index ["project_id", "status", "planned_start_date"], name: "index_project_tasks_on_project_status_start"
    t.index ["project_id", "status"], name: "index_project_tasks_on_project_id_and_status"
    t.index ["project_id"], name: "index_project_tasks_on_project_id"
    t.index ["purchase_order_id"], name: "index_project_tasks_on_purchase_order_id"
    t.index ["requires_supervisor_check"], name: "index_project_tasks_on_requires_supervisor_check"
    t.index ["schedule_template_row_id"], name: "index_project_tasks_on_schedule_template_row_id"
    t.index ["spawned_type"], name: "index_project_tasks_on_spawned_type"
    t.index ["supervisor_checked_by_id"], name: "index_project_tasks_on_supervisor_checked_by_id"
    t.index ["tags"], name: "index_project_tasks_on_tags", using: :gin
    t.index ["task_template_id"], name: "index_project_tasks_on_task_template_id"
  end

  create_table "projects", force: :cascade do |t|
    t.string "name", null: false
    t.string "project_code"
    t.text "description"
    t.date "start_date"
    t.date "planned_end_date"
    t.date "actual_end_date"
    t.string "status", default: "planning"
    t.string "client_name"
    t.text "site_address"
    t.bigint "project_manager_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "job_id", null: false
    t.datetime "generated_at"
    t.index ["job_id"], name: "index_projects_on_job_id"
    t.index ["project_code"], name: "index_projects_on_project_code", unique: true
    t.index ["project_manager_id"], name: "index_projects_on_project_manager_id"
    t.index ["start_date", "planned_end_date"], name: "index_projects_on_start_date_and_planned_end_date"
    t.index ["status"], name: "index_projects_on_status"
  end

  create_table "public_holidays", force: :cascade do |t|
    t.string "name"
    t.date "date"
    t.string "region"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "purchase_order_documents", force: :cascade do |t|
    t.bigint "purchase_order_id", null: false
    t.bigint "document_task_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["document_task_id"], name: "index_purchase_order_documents_on_document_task_id"
    t.index ["purchase_order_id", "document_task_id"], name: "index_po_documents_on_po_and_document", unique: true
    t.index ["purchase_order_id"], name: "index_purchase_order_documents_on_purchase_order_id"
  end

  create_table "purchase_order_line_items", force: :cascade do |t|
    t.bigint "purchase_order_id", null: false
    t.bigint "pricebook_item_id"
    t.text "description", null: false
    t.decimal "quantity", precision: 15, scale: 3, default: "1.0", null: false
    t.decimal "unit_price", precision: 15, scale: 2, default: "0.0", null: false
    t.decimal "tax_amount", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_amount", precision: 15, scale: 2, default: "0.0"
    t.text "notes"
    t.integer "line_number", default: 1, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "gst_code", default: "GST"
    t.string "colour"
    t.string "colour_code"
    t.string "spec_reference"
    t.index ["pricebook_item_id"], name: "index_purchase_order_line_items_on_pricebook_item_id"
    t.index ["purchase_order_id", "line_number"], name: "index_po_line_items_on_po_and_line_num"
    t.index ["purchase_order_id"], name: "index_purchase_order_line_items_on_purchase_order_id"
  end

  create_table "purchase_orders", force: :cascade do |t|
    t.string "purchase_order_number", null: false
    t.bigint "job_id", null: false
    t.bigint "supplier_id"
    t.string "status", default: "draft", null: false
    t.text "description"
    t.text "delivery_address"
    t.text "special_instructions"
    t.decimal "sub_total", precision: 15, scale: 2, default: "0.0"
    t.decimal "tax", precision: 15, scale: 2, default: "0.0"
    t.decimal "total", precision: 15, scale: 2, default: "0.0"
    t.decimal "budget", precision: 15, scale: 2
    t.decimal "amount_invoiced", precision: 15, scale: 2, default: "0.0"
    t.decimal "amount_paid", precision: 15, scale: 2, default: "0.0"
    t.string "xero_invoice_id"
    t.decimal "xero_amount_paid", precision: 15, scale: 2, default: "0.0"
    t.date "required_date"
    t.date "ordered_date"
    t.date "expected_delivery_date"
    t.date "received_date"
    t.integer "created_by_id"
    t.integer "approved_by_id"
    t.datetime "approved_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.decimal "amount_still_to_be_invoiced", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_with_allowance", precision: 15, scale: 2, default: "0.0"
    t.text "ted_task"
    t.boolean "estimation_check", default: false
    t.boolean "part_payment", default: false
    t.string "xero_supplier"
    t.boolean "xero_complete", default: false
    t.decimal "xero_still_to_be_paid", precision: 15, scale: 2, default: "0.0"
    t.decimal "xero_budget_diff", precision: 15, scale: 2, default: "0.0"
    t.date "xero_paid_date"
    t.decimal "xero_total_with_allowance", precision: 15, scale: 2, default: "0.0"
    t.decimal "xero_amount_paid_exc_gst", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_allowance_xero_paid", precision: 15, scale: 2, default: "0.0"
    t.decimal "diff_po_with_allowance_versus_budget", precision: 15, scale: 2, default: "0.0"
    t.decimal "diff_xero_and_total_but_not_complete", precision: 15, scale: 2, default: "0.0"
    t.date "required_on_site_date"
    t.boolean "creates_schedule_tasks", default: true
    t.string "task_category"
    t.string "payment_status", default: "pending", null: false
    t.decimal "invoiced_amount", precision: 15, scale: 2, default: "0.0"
    t.date "invoice_date"
    t.string "invoice_reference"
    t.bigint "estimate_id"
    t.boolean "visible_to_supplier", default: false
    t.jsonb "payment_schedule"
    t.bigint "quote_response_id"
    t.datetime "arrived_at"
    t.datetime "completed_at"
    t.string "xero_invoice_number"
    t.decimal "total_billed", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_paid_via_ap", precision: 15, scale: 2, default: "0.0"
    t.decimal "remaining_to_pay", precision: 15, scale: 2, default: "0.0"
    t.bigint "last_bill_inbox_id"
    t.index ["approved_by_id"], name: "index_purchase_orders_on_approved_by_id"
    t.index ["arrived_at"], name: "index_purchase_orders_on_arrived_at"
    t.index ["completed_at"], name: "index_purchase_orders_on_completed_at"
    t.index ["created_by_id"], name: "index_purchase_orders_on_created_by_id"
    t.index ["creates_schedule_tasks"], name: "index_purchase_orders_on_creates_schedule_tasks"
    t.index ["estimate_id"], name: "index_purchase_orders_on_estimate_id"
    t.index ["job_id", "status"], name: "index_purchase_orders_on_construction_and_status"
    t.index ["job_id", "supplier_id", "status"], name: "idx_po_job_supplier_status"
    t.index ["job_id"], name: "index_purchase_orders_on_job_id"
    t.index ["payment_status"], name: "index_purchase_orders_on_payment_status"
    t.index ["purchase_order_number"], name: "index_purchase_orders_on_purchase_order_number", unique: true
    t.index ["quote_response_id"], name: "index_purchase_orders_on_quote_response_id"
    t.index ["required_date"], name: "index_purchase_orders_on_required_date"
    t.index ["required_on_site_date"], name: "index_purchase_orders_on_required_on_site_date"
    t.index ["status"], name: "index_purchase_orders_on_status"
    t.index ["supplier_id"], name: "index_purchase_orders_on_supplier_id"
    t.index ["visible_to_supplier"], name: "index_purchase_orders_on_visible_to_supplier"
    t.index ["xero_invoice_id"], name: "index_purchase_orders_on_xero_invoice_id"
  end

  create_table "quote_request_contacts", force: :cascade do |t|
    t.bigint "quote_request_id", null: false
    t.bigint "contact_id", null: false
    t.datetime "notified_at"
    t.string "notification_method"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id"], name: "index_quote_request_contacts_on_contact_id"
    t.index ["notified_at"], name: "index_quote_request_contacts_on_notified_at"
    t.index ["quote_request_id", "contact_id"], name: "index_quote_request_contacts_unique", unique: true
    t.index ["quote_request_id"], name: "index_quote_request_contacts_on_quote_request_id"
  end

  create_table "quote_requests", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "created_by_id", null: false
    t.string "title", null: false
    t.text "description"
    t.string "trade_category"
    t.date "requested_date"
    t.decimal "budget_min", precision: 12, scale: 2
    t.decimal "budget_max", precision: 12, scale: 2
    t.string "status", default: "draft", null: false
    t.bigint "selected_quote_response_id"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_quote_requests_on_created_at"
    t.index ["created_by_id"], name: "index_quote_requests_on_created_by_id"
    t.index ["job_id", "status"], name: "index_quote_requests_on_job_id_and_status"
    t.index ["job_id"], name: "index_quote_requests_on_job_id"
    t.index ["requested_date"], name: "index_quote_requests_on_requested_date"
    t.index ["selected_quote_response_id"], name: "index_quote_requests_on_selected_quote_response_id"
    t.index ["status"], name: "index_quote_requests_on_status"
    t.index ["trade_category"], name: "index_quote_requests_on_trade_category"
  end

  create_table "quote_responses", force: :cascade do |t|
    t.bigint "quote_request_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "responded_by_portal_user_id"
    t.decimal "price", precision: 12, scale: 2, null: false
    t.string "timeframe"
    t.text "notes"
    t.string "status", default: "pending", null: false
    t.datetime "submitted_at"
    t.datetime "decision_at"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id", "status"], name: "index_quote_responses_on_contact_id_and_status"
    t.index ["contact_id"], name: "index_quote_responses_on_contact_id"
    t.index ["created_at"], name: "index_quote_responses_on_created_at"
    t.index ["quote_request_id", "status"], name: "index_quote_responses_on_quote_request_id_and_status"
    t.index ["quote_request_id"], name: "index_quote_responses_on_quote_request_id"
    t.index ["responded_by_portal_user_id"], name: "index_quote_responses_on_responded_by_portal_user_id"
    t.index ["status"], name: "index_quote_responses_on_status"
    t.index ["submitted_at"], name: "index_quote_responses_on_submitted_at"
  end

  create_table "rain_logs", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.date "date", null: false
    t.decimal "rainfall_mm", precision: 10, scale: 2
    t.decimal "hours_affected", precision: 5, scale: 2
    t.string "severity"
    t.string "source", default: "manual", null: false
    t.bigint "created_by_user_id"
    t.text "notes"
    t.jsonb "weather_api_response"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_user_id"], name: "index_rain_logs_on_created_by_user_id"
    t.index ["date"], name: "index_rain_logs_on_date"
    t.index ["job_id", "date"], name: "index_rain_logs_on_job_id_and_date", unique: true
    t.index ["job_id"], name: "index_rain_logs_on_job_id"
    t.index ["source"], name: "index_rain_logs_on_source"
  end

  create_table "reconciliation_reports", force: :cascade do |t|
    t.bigint "company_group_id"
    t.date "as_of_date", null: false
    t.string "status", default: "pending", null: false
    t.integer "total_pairs_checked", default: 0
    t.integer "matched_pairs", default: 0
    t.integer "mismatched_pairs", default: 0
    t.decimal "total_discrepancy", precision: 15, scale: 2, default: "0.0"
    t.jsonb "summary", default: {}
    t.jsonb "discrepancies", default: []
    t.text "error_message"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_group_id", "as_of_date"], name: "idx_on_company_group_id_as_of_date_12c13ba60d"
    t.index ["company_group_id"], name: "index_reconciliation_reports_on_company_group_id"
    t.index ["status"], name: "index_reconciliation_reports_on_status"
  end

  create_table "revision_formats", force: :cascade do |t|
    t.string "name", null: false
    t.text "sequence"
    t.boolean "is_default", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "role_permissions", force: :cascade do |t|
    t.string "role", null: false
    t.bigint "permission_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["permission_id"], name: "index_role_permissions_on_permission_id"
    t.index ["role", "permission_id"], name: "index_role_permissions_on_role_and_permission_id", unique: true
  end

  create_table "roles", force: :cascade do |t|
    t.string "name", null: false
    t.string "display_name", null: false
    t.text "description"
    t.boolean "active", default: true, null: false
    t.integer "position", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_roles_on_name", unique: true
    t.index ["position"], name: "index_roles_on_position"
  end

  create_table "schedule_task_checklist_items", force: :cascade do |t|
    t.bigint "schedule_task_id", null: false
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.boolean "is_completed", default: false
    t.datetime "completed_at"
    t.string "completed_by"
    t.integer "sequence_order", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "response_type", default: "checkbox"
    t.text "response_note"
    t.string "response_photo_url"
    t.index ["is_completed"], name: "index_schedule_task_checklist_items_on_is_completed"
    t.index ["schedule_task_id", "sequence_order"], name: "idx_on_schedule_task_id_sequence_order_bbbbb75501"
    t.index ["schedule_task_id"], name: "index_schedule_task_checklist_items_on_schedule_task_id"
  end

  create_table "schedule_tasks", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "purchase_order_id"
    t.string "title", null: false
    t.string "status", default: "not_started"
    t.datetime "start_date"
    t.datetime "complete_date"
    t.string "duration"
    t.integer "duration_days"
    t.string "supplier_category"
    t.string "supplier_name"
    t.boolean "paid_internal", default: false
    t.datetime "approx_date"
    t.boolean "confirm", default: false
    t.boolean "supplier_confirm", default: false
    t.datetime "task_started"
    t.datetime "completed"
    t.jsonb "predecessors", default: []
    t.text "attachments"
    t.boolean "matched_to_po", default: false
    t.integer "sequence_order"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id", "matched_to_po"], name: "index_schedule_tasks_on_job_id_and_matched_to_po"
    t.index ["job_id"], name: "index_schedule_tasks_on_job_id"
    t.index ["matched_to_po"], name: "index_schedule_tasks_on_matched_to_po"
    t.index ["purchase_order_id"], name: "index_schedule_tasks_on_purchase_order_id"
    t.index ["start_date"], name: "index_schedule_tasks_on_start_date"
    t.index ["status"], name: "index_schedule_tasks_on_status"
  end

  create_table "schedule_template_row_audits", force: :cascade do |t|
    t.bigint "schedule_template_row_id", null: false
    t.bigint "user_id", null: false
    t.string "field_name", null: false
    t.boolean "old_value"
    t.boolean "new_value"
    t.datetime "changed_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["schedule_template_row_id", "changed_at"], name: "idx_on_schedule_template_row_id_changed_at_d2d3f08a64"
    t.index ["schedule_template_row_id"], name: "index_schedule_template_row_audits_on_schedule_template_row_id"
    t.index ["user_id"], name: "index_schedule_template_row_audits_on_user_id"
  end

  create_table "schedule_template_rows", force: :cascade do |t|
    t.bigint "schedule_template_id", null: false
    t.string "name", null: false
    t.bigint "supplier_id"
    t.jsonb "predecessor_ids", default: [], null: false
    t.boolean "po_required", default: false, null: false
    t.boolean "create_po_on_job_start", default: false, null: false
    t.jsonb "price_book_item_ids", default: [], null: false
    t.boolean "critical_po", default: false, null: false
    t.jsonb "tags", default: [], null: false
    t.boolean "require_photo", default: false, null: false
    t.boolean "require_certificate", default: false, null: false
    t.integer "cert_lag_days", default: 10, null: false
    t.boolean "require_supervisor_check", default: false, null: false
    t.boolean "auto_complete_predecessors", default: false, null: false
    t.boolean "has_subtasks", default: false, null: false
    t.integer "subtask_count"
    t.jsonb "subtask_names", default: [], null: false
    t.integer "sequence_order", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "assigned_user_id"
    t.integer "documentation_category_ids", default: [], array: true
    t.integer "supervisor_checklist_template_ids", default: [], array: true
    t.text "linked_task_ids", default: "[]"
    t.integer "linked_template_id"
    t.jsonb "auto_complete_task_ids", default: [], null: false
    t.jsonb "subtask_template_ids", default: [], null: false
    t.boolean "manual_task", default: false, null: false
    t.boolean "allow_multiple_instances", default: false, null: false
    t.boolean "order_required", default: false, null: false
    t.boolean "call_up_required", default: false, null: false
    t.boolean "plan_required", default: false, null: false
    t.boolean "manually_positioned", default: false, null: false
    t.boolean "confirm", default: false, null: false
    t.boolean "supplier_confirm", default: false, null: false
    t.boolean "start", default: false, null: false
    t.boolean "complete", default: false, null: false
    t.integer "duration", default: 0, null: false
    t.integer "start_date", default: 0, null: false
    t.boolean "dependencies_broken", default: false, null: false
    t.jsonb "broken_predecessor_ids", default: [], null: false
    t.index ["assigned_user_id"], name: "index_schedule_template_rows_on_assigned_user_id"
    t.index ["documentation_category_ids"], name: "index_schedule_template_rows_on_documentation_category_ids", using: :gin
    t.index ["linked_template_id"], name: "index_schedule_template_rows_on_linked_template_id"
    t.index ["schedule_template_id", "sequence_order"], name: "idx_on_schedule_template_id_sequence_order_1bea5d762b"
    t.index ["schedule_template_id"], name: "index_schedule_template_rows_on_schedule_template_id"
    t.index ["sequence_order"], name: "index_schedule_template_rows_on_sequence_order"
    t.index ["supervisor_checklist_template_ids"], name: "idx_on_supervisor_checklist_template_ids_08080bc25c", using: :gin
    t.index ["supervisor_checklist_template_ids"], name: "index_schedule_template_rows_on_supervisor_checklist_template_i", using: :gin
    t.index ["supplier_id"], name: "index_schedule_template_rows_on_supplier_id"
  end

  create_table "schedule_templates", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.boolean "is_default", default: false, null: false
    t.bigint "created_by_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_schedule_templates_on_created_by_id"
    t.index ["is_default"], name: "index_schedule_templates_on_is_default"
    t.index ["name"], name: "index_schedule_templates_on_name"
  end

  create_table "share_transfers", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "from_shareholder_id"
    t.bigint "to_shareholder_id", null: false
    t.string "share_class", default: "ordinary"
    t.integer "number_of_shares", null: false
    t.decimal "consideration", precision: 12, scale: 2
    t.date "transfer_date", null: false
    t.string "document_reference"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_share_transfers_on_company_id"
    t.index ["from_shareholder_id"], name: "index_share_transfers_on_from_shareholder_id"
    t.index ["share_class"], name: "index_share_transfers_on_share_class"
    t.index ["to_shareholder_id"], name: "index_share_transfers_on_to_shareholder_id"
    t.index ["transfer_date"], name: "index_share_transfers_on_transfer_date"
  end

  create_table "sm_dependencies", force: :cascade do |t|
    t.bigint "predecessor_task_id", null: false
    t.bigint "successor_task_id", null: false
    t.string "dependency_type", limit: 10, null: false
    t.integer "lag_days", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "deleted_at", precision: nil
    t.boolean "deleted_by_rollover", default: false
    t.string "deleted_reason", limit: 100
    t.bigint "created_by_id"
    t.bigint "deleted_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active"], name: "index_sm_dependencies_on_active"
    t.index ["created_by_id"], name: "index_sm_dependencies_on_created_by_id"
    t.index ["deleted_by_id"], name: "index_sm_dependencies_on_deleted_by_id"
    t.index ["predecessor_task_id", "successor_task_id"], name: "idx_sm_deps_unique_active", unique: true, where: "(active = true)"
    t.index ["predecessor_task_id"], name: "idx_sm_deps_predecessor_active", where: "(active = true)"
    t.index ["predecessor_task_id"], name: "index_sm_dependencies_on_predecessor_task_id"
    t.index ["successor_task_id"], name: "idx_sm_deps_successor_active", where: "(active = true)"
    t.index ["successor_task_id"], name: "index_sm_dependencies_on_successor_task_id"
    t.check_constraint "predecessor_task_id <> successor_task_id", name: "no_self_dependency"
  end

  create_table "sm_hold_logs", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "hold_task_id", null: false
    t.bigint "hold_reason_id"
    t.string "event_type", limit: 20, null: false
    t.datetime "hold_started_at", precision: nil
    t.bigint "hold_started_by_id"
    t.datetime "hold_released_at", precision: nil
    t.bigint "hold_released_by_id"
    t.text "hold_release_reason"
    t.integer "supplier_confirms_cleared", default: 0
    t.integer "dependencies_cleared", default: 0
    t.integer "tasks_affected", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["event_type"], name: "index_sm_hold_logs_on_event_type"
    t.index ["hold_reason_id"], name: "index_sm_hold_logs_on_hold_reason_id"
    t.index ["hold_released_by_id"], name: "index_sm_hold_logs_on_hold_released_by_id"
    t.index ["hold_started_by_id"], name: "index_sm_hold_logs_on_hold_started_by_id"
    t.index ["hold_task_id"], name: "index_sm_hold_logs_on_hold_task_id"
    t.index ["job_id"], name: "index_sm_hold_logs_on_job_id"
  end

  create_table "sm_hold_reasons", force: :cascade do |t|
    t.string "name", limit: 100, null: false
    t.text "description"
    t.string "color", limit: 20, default: "#EF4444"
    t.string "icon", limit: 50, default: "pause"
    t.integer "sequence_order", default: 0, null: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["is_active"], name: "index_sm_hold_reasons_on_is_active"
    t.index ["name"], name: "index_sm_hold_reasons_on_name", unique: true
    t.index ["sequence_order"], name: "index_sm_hold_reasons_on_sequence_order"
  end

  create_table "sm_resource_allocations", force: :cascade do |t|
    t.bigint "task_id", null: false
    t.bigint "resource_id", null: false
    t.decimal "allocated_hours", precision: 10, scale: 2
    t.decimal "allocated_quantity", precision: 10, scale: 2
    t.date "allocation_date"
    t.string "status", limit: 20, default: "planned"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["allocation_date"], name: "index_sm_resource_allocations_on_allocation_date"
    t.index ["resource_id"], name: "index_sm_resource_allocations_on_resource_id"
    t.index ["status"], name: "index_sm_resource_allocations_on_status"
    t.index ["task_id", "resource_id", "allocation_date"], name: "idx_sm_allocations_unique", unique: true
    t.index ["task_id"], name: "index_sm_resource_allocations_on_task_id"
  end

  create_table "sm_resources", force: :cascade do |t|
    t.string "resource_type", limit: 20, null: false
    t.string "name", limit: 255, null: false
    t.string "code", limit: 50
    t.text "description"
    t.bigint "user_id"
    t.bigint "contact_id"
    t.string "trade", limit: 100
    t.decimal "hourly_rate", precision: 10, scale: 2
    t.bigint "asset_id"
    t.decimal "daily_rate", precision: 10, scale: 2
    t.string "unit", limit: 50
    t.decimal "unit_cost", precision: 10, scale: 2
    t.boolean "is_active", default: true
    t.decimal "availability_hours_per_day", precision: 4, scale: 2, default: "8.0"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["asset_id"], name: "index_sm_resources_on_asset_id"
    t.index ["code"], name: "index_sm_resources_on_code", unique: true, where: "(code IS NOT NULL)"
    t.index ["contact_id"], name: "index_sm_resources_on_contact_id"
    t.index ["is_active"], name: "index_sm_resources_on_is_active"
    t.index ["resource_type"], name: "index_sm_resources_on_resource_type"
    t.index ["user_id"], name: "index_sm_resources_on_user_id"
  end

  create_table "sm_rollover_logs", force: :cascade do |t|
    t.uuid "rollover_batch_id", null: false
    t.datetime "rollover_timestamp", precision: nil, null: false
    t.bigint "task_id", null: false
    t.date "old_start_date"
    t.date "new_start_date"
    t.date "old_end_date"
    t.date "new_end_date"
    t.jsonb "deleted_dependencies", default: []
    t.string "confirm_status_change", limit: 255
    t.boolean "hold_cleared", default: false
    t.integer "supplier_confirms_cleared", default: 0
    t.bigint "job_id", null: false
    t.integer "cascade_depth"
    t.boolean "cross_job_cascade", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id"], name: "index_sm_rollover_logs_on_job_id"
    t.index ["rollover_batch_id"], name: "index_sm_rollover_logs_on_rollover_batch_id"
    t.index ["rollover_timestamp"], name: "index_sm_rollover_logs_on_rollover_timestamp"
    t.index ["task_id"], name: "index_sm_rollover_logs_on_task_id"
  end

  create_table "sm_settings", force: :cascade do |t|
    t.time "rollover_time", default: "2000-01-01 00:00:00", null: false
    t.string "rollover_timezone", limit: 50, default: "Australia/Brisbane", null: false
    t.boolean "rollover_enabled", default: true
    t.boolean "notify_on_hold", default: true
    t.boolean "notify_on_supplier_confirm", default: true
    t.boolean "notify_on_rollover", default: true
    t.bigint "default_template_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["default_template_id"], name: "index_sm_settings_on_default_template_id"
  end

  create_table "sm_spawn_logs", force: :cascade do |t|
    t.bigint "parent_task_id", null: false
    t.bigint "spawned_task_id", null: false
    t.string "spawn_type", limit: 50, null: false
    t.string "spawn_trigger", limit: 50, null: false
    t.datetime "spawned_at", precision: nil, default: -> { "now()" }, null: false
    t.bigint "spawned_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["parent_task_id"], name: "index_sm_spawn_logs_on_parent_task_id"
    t.index ["spawn_type"], name: "index_sm_spawn_logs_on_spawn_type"
    t.index ["spawned_by_id"], name: "index_sm_spawn_logs_on_spawned_by_id"
    t.index ["spawned_task_id"], name: "index_sm_spawn_logs_on_spawned_task_id"
  end

  create_table "sm_template_rows", force: :cascade do |t|
    t.bigint "sm_template_id", null: false
    t.bigint "parent_row_id"
    t.bigint "supplier_id"
    t.integer "task_number", null: false
    t.string "name", null: false
    t.text "description"
    t.decimal "sequence_order", precision: 10, scale: 2, null: false
    t.integer "duration_days", default: 1, null: false
    t.integer "start_day_offset", default: 0
    t.jsonb "predecessor_ids", default: []
    t.string "trade"
    t.string "stage"
    t.string "assigned_role"
    t.integer "documentation_category_ids", default: [], array: true
    t.boolean "show_in_docs_tab", default: false
    t.jsonb "linked_task_ids", default: []
    t.boolean "spawn_photo_task", default: false
    t.boolean "spawn_scan_task", default: false
    t.jsonb "spawn_office_tasks", default: []
    t.boolean "pass_fail_enabled", default: false
    t.bigint "checklist_id"
    t.integer "order_time_days"
    t.integer "call_time_days"
    t.boolean "require_photo", default: false
    t.boolean "require_certificate", default: false
    t.boolean "require_supervisor_check", default: false
    t.boolean "po_required", default: false
    t.boolean "critical_po", default: false
    t.boolean "create_po_on_job_start", default: false
    t.integer "cert_lag_days", default: 0
    t.boolean "has_subtasks", default: false
    t.integer "subtask_count"
    t.string "subtask_names", default: [], array: true
    t.integer "price_book_item_ids", default: [], array: true
    t.string "tags", default: [], array: true
    t.string "color"
    t.boolean "is_active", default: true
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["checklist_id"], name: "index_sm_template_rows_on_checklist_id"
    t.index ["created_by_id"], name: "index_sm_template_rows_on_created_by_id"
    t.index ["is_active"], name: "index_sm_template_rows_on_is_active"
    t.index ["parent_row_id"], name: "index_sm_template_rows_on_parent_row_id"
    t.index ["sm_template_id", "sequence_order"], name: "index_sm_template_rows_on_sm_template_id_and_sequence_order"
    t.index ["sm_template_id", "task_number"], name: "index_sm_template_rows_on_sm_template_id_and_task_number", unique: true
    t.index ["sm_template_id"], name: "index_sm_template_rows_on_sm_template_id"
    t.index ["stage"], name: "index_sm_template_rows_on_stage"
    t.index ["supplier_id"], name: "index_sm_template_rows_on_supplier_id"
    t.index ["trade"], name: "index_sm_template_rows_on_trade"
    t.index ["updated_by_id"], name: "index_sm_template_rows_on_updated_by_id"
  end

  create_table "sm_templates", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.boolean "is_default", default: false
    t.boolean "is_active", default: true
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_sm_templates_on_created_by_id"
    t.index ["is_active"], name: "index_sm_templates_on_is_active"
    t.index ["is_default"], name: "index_sm_templates_on_is_default"
    t.index ["updated_by_id"], name: "index_sm_templates_on_updated_by_id"
  end

  create_table "sm_time_entries", force: :cascade do |t|
    t.bigint "task_id", null: false
    t.bigint "resource_id", null: false
    t.bigint "allocation_id"
    t.date "entry_date", null: false
    t.time "start_time"
    t.time "end_time"
    t.integer "break_minutes", default: 0
    t.decimal "total_hours", precision: 10, scale: 2, null: false
    t.string "entry_type", limit: 20, default: "regular"
    t.text "description"
    t.bigint "approved_by_id"
    t.datetime "approved_at", precision: nil
    t.bigint "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["allocation_id"], name: "index_sm_time_entries_on_allocation_id"
    t.index ["approved_by_id"], name: "index_sm_time_entries_on_approved_by_id"
    t.index ["created_by_id"], name: "index_sm_time_entries_on_created_by_id"
    t.index ["entry_date"], name: "index_sm_time_entries_on_entry_date"
    t.index ["entry_type"], name: "index_sm_time_entries_on_entry_type"
    t.index ["resource_id"], name: "index_sm_time_entries_on_resource_id"
    t.index ["task_id", "entry_date", "approved_at"], name: "idx_sm_time_entries_task_date_approved"
    t.index ["task_id", "resource_id", "entry_date"], name: "idx_sm_time_entries_task_resource_date"
    t.index ["task_id"], name: "index_sm_time_entries_on_task_id"
  end

  create_table "sm_working_drawing_pages", force: :cascade do |t|
    t.bigint "task_id", null: false
    t.integer "page_number", null: false
    t.text "image_url", null: false
    t.string "category", limit: 100, null: false
    t.decimal "ai_confidence", precision: 5, scale: 4
    t.boolean "category_overridden", default: false
    t.string "manual_category", limit: 100
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category"], name: "index_sm_working_drawing_pages_on_category"
    t.index ["task_id", "page_number"], name: "index_sm_working_drawing_pages_on_task_id_and_page_number", unique: true
    t.index ["task_id"], name: "index_sm_working_drawing_pages_on_task_id"
  end

  create_table "sms_messages", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.bigint "user_id"
    t.string "from_phone", null: false
    t.string "to_phone", null: false
    t.text "body", null: false
    t.string "direction", null: false
    t.string "status"
    t.string "twilio_sid"
    t.datetime "sent_at"
    t.datetime "received_at"
    t.text "error_message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id", "created_at"], name: "index_sms_messages_on_contact_id_and_created_at"
    t.index ["contact_id"], name: "index_sms_messages_on_contact_id"
    t.index ["direction", "status"], name: "index_sms_messages_on_direction_and_status"
    t.index ["twilio_sid"], name: "index_sms_messages_on_twilio_sid", unique: true
    t.index ["user_id"], name: "index_sms_messages_on_user_id"
  end

  create_table "solid_cache_entries", force: :cascade do |t|
    t.binary "key", null: false
    t.binary "value", null: false
    t.datetime "created_at", null: false
    t.bigint "key_hash", null: false
    t.integer "byte_size", null: false
    t.index ["byte_size"], name: "index_solid_cache_entries_on_byte_size"
    t.index ["key_hash", "byte_size"], name: "index_solid_cache_entries_on_key_hash_and_byte_size"
    t.index ["key_hash"], name: "index_solid_cache_entries_on_key_hash", unique: true
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.string "concurrency_key", null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.text "error"
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "queue_name", null: false
    t.string "class_name", null: false
    t.text "arguments"
    t.integer "priority", default: 0, null: false
    t.string "active_job_id"
    t.datetime "scheduled_at"
    t.datetime "finished_at"
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "key_hash"
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["key_hash"], name: "index_solid_queue_jobs_on_key_hash", unique: true
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.string "queue_name", null: false
    t.datetime "created_at", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.bigint "supervisor_id"
    t.integer "pid", null: false
    t.string "hostname"
    t.text "metadata"
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "task_key", null: false
    t.datetime "run_at", null: false
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.string "key", null: false
    t.string "schedule", null: false
    t.string "command", limit: 2048
    t.string "class_name"
    t.text "arguments"
    t.string "queue_name"
    t.integer "priority", default: 0
    t.boolean "static", default: true, null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.datetime "scheduled_at", null: false
    t.datetime "created_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.string "key", null: false
    t.integer "value", default: 1, null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "specification_templates", force: :cascade do |t|
    t.string "name", null: false
    t.bigint "job_type_id"
    t.jsonb "sections", default: []
    t.boolean "is_default", default: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_type_id"], name: "index_specification_templates_on_job_type_id"
  end

  create_table "subcontractor_accounts", force: :cascade do |t|
    t.bigint "portal_user_id", null: false
    t.string "account_tier", default: "free", null: false
    t.datetime "activated_at"
    t.bigint "invited_by_contact_id"
    t.decimal "kudos_score", precision: 10, scale: 2, default: "0.0"
    t.integer "jobs_completed_count", default: 0
    t.boolean "accounting_system_connected", default: false
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_tier"], name: "index_subcontractor_accounts_on_account_tier"
    t.index ["activated_at"], name: "index_subcontractor_accounts_on_activated_at"
    t.index ["invited_by_contact_id"], name: "index_subcontractor_accounts_on_invited_by_contact_id"
    t.index ["kudos_score"], name: "index_subcontractor_accounts_on_kudos_score"
    t.index ["portal_user_id"], name: "index_subcontractor_accounts_on_portal_user_id"
  end

  create_table "subcontractor_invoices", force: :cascade do |t|
    t.bigint "purchase_order_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "accounting_integration_id"
    t.decimal "amount", precision: 12, scale: 2, null: false
    t.string "external_invoice_id"
    t.string "status", default: "draft", null: false
    t.datetime "synced_at"
    t.datetime "paid_at"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["accounting_integration_id"], name: "index_subcontractor_invoices_on_accounting_integration_id"
    t.index ["contact_id", "status"], name: "index_subcontractor_invoices_on_contact_id_and_status"
    t.index ["contact_id"], name: "index_subcontractor_invoices_on_contact_id"
    t.index ["external_invoice_id"], name: "index_subcontractor_invoices_on_external_invoice_id"
    t.index ["paid_at"], name: "index_subcontractor_invoices_on_paid_at"
    t.index ["purchase_order_id", "status"], name: "index_subcontractor_invoices_on_purchase_order_id_and_status"
    t.index ["purchase_order_id"], name: "index_subcontractor_invoices_on_purchase_order_id"
    t.index ["status"], name: "index_subcontractor_invoices_on_status"
  end

  create_table "suburbs", force: :cascade do |t|
    t.string "name", null: false
    t.string "postcode", null: false
    t.string "state", null: false
    t.string "council"
    t.integer "position"
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["council"], name: "index_suburbs_on_council"
    t.index ["name", "state"], name: "index_suburbs_on_name_and_state", unique: true
    t.index ["name"], name: "index_suburbs_on_name"
    t.index ["postcode"], name: "index_suburbs_on_postcode"
    t.index ["state"], name: "index_suburbs_on_state"
  end

  create_table "supervisor_checklist_templates", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.integer "sequence_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "response_type", default: "checkbox"
    t.index ["category"], name: "index_supervisor_checklist_templates_on_category"
    t.index ["name"], name: "index_supervisor_checklist_templates_on_name", unique: true
    t.index ["sequence_order"], name: "index_supervisor_checklist_templates_on_sequence_order"
  end

  create_table "sync_configurations", force: :cascade do |t|
    t.string "xero_tenant_id", null: false
    t.string "xero_tenant_name"
    t.string "accounting_system", default: "xero"
    t.jsonb "field_mappings", default: {}
    t.jsonb "cleanup_options", default: {"archive_duplicates"=>false, "standardize_abn_format"=>true, "delete_primary_person_after_import"=>false}
    t.boolean "sync_enabled", default: true
    t.boolean "webhooks_enabled", default: false
    t.datetime "last_full_sync_at"
    t.datetime "webhooks_registered_at"
    t.string "webhook_key"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "default_sync_direction", default: "import_only"
    t.index ["accounting_system"], name: "index_sync_configurations_on_accounting_system"
    t.index ["xero_tenant_id"], name: "index_sync_configurations_on_xero_tenant_id", unique: true
  end

  create_table "system_settings", force: :cascade do |t|
    t.string "setting_key", null: false
    t.text "setting_value"
    t.string "setting_type", default: "string"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["setting_key"], name: "index_system_settings_on_setting_key", unique: true
  end

  create_table "table_health_checks", force: :cascade do |t|
    t.bigint "foundation_id"
    t.string "table_name"
    t.string "check_type", null: false
    t.string "name", null: false
    t.text "description"
    t.string "api_endpoint", null: false
    t.string "severity", default: "warning"
    t.boolean "enabled", default: true
    t.string "icon"
    t.string "action_path"
    t.integer "display_order", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["check_type"], name: "index_table_health_checks_on_check_type"
    t.index ["enabled"], name: "index_table_health_checks_on_enabled"
    t.index ["foundation_id"], name: "index_table_health_checks_on_foundation_id"
    t.index ["table_name"], name: "index_table_health_checks_on_table_name"
  end

  create_table "table_protections", force: :cascade do |t|
    t.string "table_name", null: false
    t.boolean "is_protected", default: true, null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["table_name"], name: "index_table_protections_on_table_name", unique: true
  end

  create_table "task_dependencies", force: :cascade do |t|
    t.bigint "successor_task_id", null: false
    t.bigint "predecessor_task_id", null: false
    t.string "dependency_type", default: "finish_to_start"
    t.integer "lag_days", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["predecessor_task_id"], name: "index_task_dependencies_on_predecessor_task_id"
    t.index ["successor_task_id", "predecessor_task_id"], name: "index_unique_task_dependency", unique: true
    t.index ["successor_task_id"], name: "index_task_dependencies_on_successor_task_id"
    t.check_constraint "successor_task_id <> predecessor_task_id", name: "check_no_self_dependency"
  end

  create_table "task_templates", force: :cascade do |t|
    t.string "name", null: false
    t.string "task_type", null: false
    t.string "category", null: false
    t.integer "default_duration_days", default: 1
    t.integer "sequence_order", default: 0
    t.integer "predecessor_template_codes", default: [], array: true
    t.text "description"
    t.boolean "is_milestone", default: false
    t.boolean "requires_photo", default: false
    t.boolean "is_standard", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category"], name: "index_task_templates_on_category"
    t.index ["sequence_order"], name: "index_task_templates_on_sequence_order"
    t.index ["task_type"], name: "index_task_templates_on_task_type"
  end

  create_table "task_updates", force: :cascade do |t|
    t.bigint "project_task_id", null: false
    t.bigint "user_id", null: false
    t.string "status_before"
    t.string "status_after"
    t.integer "progress_before"
    t.integer "progress_after"
    t.text "notes"
    t.text "photo_urls", default: [], array: true
    t.date "update_date", default: -> { "CURRENT_DATE" }, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["project_task_id"], name: "index_task_updates_on_project_task_id"
    t.index ["update_date"], name: "index_task_updates_on_update_date"
    t.index ["user_id"], name: "index_task_updates_on_user_id"
  end

  create_table "tasks", force: :cascade do |t|
    t.bigint "job_id", null: false
    t.bigint "template_row_id"
    t.bigint "parent_task_id"
    t.integer "task_number", null: false
    t.string "name", limit: 255, null: false
    t.text "description"
    t.decimal "sequence_order", precision: 10, scale: 2, null: false
    t.date "start_date", null: false
    t.date "end_date", null: false
    t.integer "duration_days", null: false
    t.string "status", limit: 50, default: "not_started", null: false
    t.datetime "started_at", precision: nil
    t.datetime "completed_at", precision: nil
    t.boolean "passed"
    t.boolean "confirm", default: false
    t.boolean "supplier_confirm", default: false
    t.boolean "manually_positioned", default: false
    t.datetime "manually_positioned_at", precision: nil
    t.string "confirm_status", limit: 50
    t.datetime "confirm_requested_at", precision: nil
    t.datetime "supplier_confirmed_at", precision: nil
    t.bigint "supplier_confirmed_by_id"
    t.boolean "is_hold_task", default: false
    t.bigint "hold_reason_id"
    t.datetime "hold_started_at", precision: nil
    t.bigint "hold_started_by_id"
    t.datetime "hold_released_at", precision: nil
    t.bigint "hold_released_by_id"
    t.text "hold_release_reason"
    t.bigint "purchase_order_id"
    t.bigint "assigned_user_id"
    t.bigint "supplier_id"
    t.string "trade", limit: 100
    t.string "stage", limit: 100
    t.integer "documentation_category_ids", default: [], array: true
    t.boolean "show_in_docs_tab", default: false
    t.jsonb "linked_task_ids", default: []
    t.boolean "spawn_photo_task", default: false
    t.boolean "spawn_scan_task", default: false
    t.jsonb "spawn_office_tasks", default: []
    t.boolean "pass_fail_enabled", default: false
    t.bigint "checklist_id"
    t.integer "order_time_days"
    t.integer "call_time_days"
    t.boolean "order_reminder_sent", default: false
    t.boolean "call_reminder_sent", default: false
    t.boolean "require_photo", default: false
    t.boolean "require_certificate", default: false
    t.boolean "require_supervisor_check", default: false
    t.boolean "po_required", default: false
    t.boolean "critical_po", default: false
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sm_template_row_id"
    t.index ["assigned_user_id"], name: "index_tasks_on_assigned_user_id"
    t.index ["checklist_id"], name: "index_tasks_on_checklist_id"
    t.index ["confirm_status"], name: "index_tasks_on_confirm_status"
    t.index ["created_by_id"], name: "index_tasks_on_created_by_id"
    t.index ["hold_reason_id"], name: "index_tasks_on_hold_reason_id"
    t.index ["hold_released_by_id"], name: "index_tasks_on_hold_released_by_id"
    t.index ["hold_started_by_id"], name: "index_tasks_on_hold_started_by_id"
    t.index ["is_hold_task"], name: "index_tasks_on_is_hold_task", where: "(is_hold_task = true)"
    t.index ["job_id", "status", "start_date"], name: "idx_tasks_job_status_start"
    t.index ["job_id", "status"], name: "idx_tasks_job_status"
    t.index ["job_id", "task_number"], name: "index_tasks_on_job_id_and_task_number", unique: true
    t.index ["job_id"], name: "index_tasks_on_job_id"
    t.index ["parent_task_id"], name: "index_tasks_on_parent_task_id"
    t.index ["purchase_order_id"], name: "index_tasks_on_purchase_order_id"
    t.index ["sequence_order"], name: "index_tasks_on_sequence_order"
    t.index ["sm_template_row_id"], name: "index_tasks_on_sm_template_row_id"
    t.index ["start_date"], name: "index_tasks_on_start_date"
    t.index ["status"], name: "index_tasks_on_status"
    t.index ["supplier_confirmed_by_id"], name: "index_tasks_on_supplier_confirmed_by_id"
    t.index ["supplier_id"], name: "index_tasks_on_supplier_id"
    t.index ["template_row_id"], name: "index_tasks_on_template_row_id"
    t.index ["trade"], name: "index_tasks_on_trade"
    t.index ["updated_by_id"], name: "index_tasks_on_updated_by_id"
  end

  create_table "trinity", force: :cascade do |t|
    t.integer "chapter_number", null: false
    t.string "chapter_name", null: false
    t.string "component"
    t.string "title", null: false
    t.string "status", default: "open"
    t.string "severity", default: "medium"
    t.date "first_reported"
    t.date "last_occurred"
    t.date "fixed_date"
    t.text "scenario"
    t.text "root_cause"
    t.text "solution"
    t.text "prevention"
    t.jsonb "metadata", default: {}
    t.text "search_text"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "entry_type", default: "bug", null: false
    t.text "description"
    t.text "details"
    t.text "examples"
    t.text "recommendations"
    t.string "rule_reference"
    t.string "section_number"
    t.string "difficulty"
    t.text "summary"
    t.text "code_example"
    t.text "common_mistakes"
    t.text "testing_strategy"
    t.text "related_rules"
    t.string "category", null: false
    t.string "created_by"
    t.string "updated_by"
    t.boolean "exclude_from_export", default: false, null: false
    t.text "dense_index"
    t.index ["category", "chapter_number"], name: "index_trinity_on_category_and_chapter_number"
    t.index ["category"], name: "index_trinity_on_category"
    t.index ["chapter_number", "entry_type"], name: "index_trinity_on_chapter_number_and_entry_type"
    t.index ["chapter_number", "section_number"], name: "index_trinity_on_chapter_number_and_section_number"
    t.index ["chapter_number", "status"], name: "index_trinity_on_chapter_number_and_status"
    t.index ["chapter_number"], name: "index_trinity_on_chapter_number"
    t.index ["dense_index"], name: "index_trinity_on_dense_index"
    t.index ["entry_type"], name: "index_trinity_on_entry_type"
    t.index ["exclude_from_export"], name: "index_trinity_on_exclude_from_export"
    t.index ["search_text"], name: "index_trinity_on_search_text", opclass: :gin_trgm_ops, using: :gin
    t.index ["section_number"], name: "index_trinity_on_section_number"
    t.index ["severity"], name: "index_trinity_on_severity"
    t.index ["status"], name: "index_trinity_on_status"
  end

  create_table "unreal_variables", force: :cascade do |t|
    t.string "variable_name", null: false
    t.decimal "claude_value", precision: 10, scale: 2, default: "0.0"
    t.boolean "is_active", default: true
    t.text "variable_rule"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["variable_name"], name: "index_unreal_variables_on_variable_name", unique: true
  end

  create_table "user_groups", force: :cascade do |t|
    t.string "name"
    t.string "label"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_user_groups_on_name", unique: true
  end

  create_table "user_job_tab_configs", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "job_tab_id", null: false
    t.integer "position", default: 0, null: false
    t.integer "parent_job_tab_id"
    t.boolean "is_hidden", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_tab_id"], name: "index_user_job_tab_configs_on_job_tab_id"
    t.index ["user_id", "job_tab_id"], name: "idx_user_job_tab_config_unique", unique: true
    t.index ["user_id", "parent_job_tab_id"], name: "index_user_job_tab_configs_on_user_id_and_parent_job_tab_id"
    t.index ["user_id", "position"], name: "index_user_job_tab_configs_on_user_id_and_position"
    t.index ["user_id"], name: "index_user_job_tab_configs_on_user_id"
  end

  create_table "user_microsoft_tokens", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "token_expires_at"
    t.text "scopes"
    t.string "email"
    t.string "status", default: "pending"
    t.datetime "last_sync_at"
    t.text "sync_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "refresh_token_dead", default: false, null: false
    t.integer "consecutive_failures", default: 0, null: false
    t.datetime "last_refresh_attempt_at"
    t.index ["email"], name: "index_user_microsoft_tokens_on_email"
    t.index ["status"], name: "index_user_microsoft_tokens_on_status"
    t.index ["user_id"], name: "index_user_microsoft_tokens_on_user_id"
  end

  create_table "user_navigation_configs", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "navigation_item_id", null: false
    t.boolean "is_collapsed", default: true
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.datetime "updated_at", default: -> { "now()" }, null: false
    t.index ["user_id", "navigation_item_id"], name: "idx_user_nav_config_unique", unique: true
  end

  create_table "user_outlook_credentials", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "email"
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "expires_at", precision: nil
    t.string "tenant_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_user_outlook_credentials_on_user_id", unique: true
  end

  create_table "user_permissions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "permission_id", null: false
    t.boolean "granted", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["permission_id"], name: "index_user_permissions_on_permission_id"
    t.index ["user_id", "permission_id"], name: "index_user_permissions_on_user_id_and_permission_id", unique: true
    t.index ["user_id"], name: "index_user_permissions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email"
    t.string "password_digest"
    t.string "name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "role", default: "user", null: false
    t.datetime "last_chat_read_at"
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "last_login_at"
    t.string "mobile_phone"
    t.string "provider"
    t.string "uid"
    t.text "oauth_token"
    t.datetime "oauth_expires_at"
    t.boolean "wphs_appointee", default: false, null: false
    t.boolean "preload_price_books", default: false, null: false
    t.jsonb "assigned_roles", default: []
    t.bigint "user_group_id"
    t.datetime "last_seen_at"
    t.boolean "can_view_confidential_fields", default: false, null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["role"], name: "index_users_on_role"
    t.index ["user_group_id"], name: "index_users_on_user_group_id"
    t.index ["wphs_appointee"], name: "index_users_on_wphs_appointee"
  end

  create_table "versions", force: :cascade do |t|
    t.integer "current_version", default: 101, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "warehouse_bank_transactions", force: :cascade do |t|
    t.string "xero_id", null: false
    t.string "tenant_id"
    t.string "source", default: "xero"
    t.string "bank_account_id"
    t.string "bank_account_code"
    t.string "bank_account_name"
    t.string "transaction_type"
    t.date "transaction_date", null: false
    t.string "reference"
    t.string "status"
    t.boolean "is_reconciled", default: false
    t.string "xero_contact_id"
    t.string "contact_name"
    t.bigint "contact_id"
    t.decimal "sub_total", precision: 15, scale: 2
    t.decimal "total_tax", precision: 15, scale: 2
    t.decimal "total", precision: 15, scale: 2
    t.string "currency_code", default: "AUD"
    t.jsonb "line_items", default: []
    t.text "description"
    t.integer "transaction_month"
    t.integer "transaction_year"
    t.string "financial_year"
    t.boolean "has_attachments", default: false
    t.datetime "last_synced_at"
    t.datetime "xero_updated_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "warehouse_contact_id"
    t.index ["bank_account_id"], name: "index_warehouse_bank_transactions_on_bank_account_id"
    t.index ["contact_id"], name: "index_warehouse_bank_transactions_on_contact_id"
    t.index ["financial_year"], name: "index_warehouse_bank_transactions_on_financial_year"
    t.index ["tenant_id"], name: "index_warehouse_bank_transactions_on_tenant_id"
    t.index ["transaction_date"], name: "index_warehouse_bank_transactions_on_transaction_date"
    t.index ["transaction_year", "transaction_month"], name: "idx_on_transaction_year_transaction_month_398491194a"
    t.index ["warehouse_contact_id"], name: "index_warehouse_bank_transactions_on_warehouse_contact_id"
    t.index ["xero_contact_id"], name: "index_warehouse_bank_transactions_on_xero_contact_id"
    t.index ["xero_id"], name: "index_warehouse_bank_transactions_on_xero_id", unique: true
  end

  create_table "warehouse_contacts", force: :cascade do |t|
    t.string "xero_id", null: false
    t.string "tenant_id", null: false
    t.string "source", default: "xero", null: false
    t.string "name"
    t.string "first_name"
    t.string "last_name"
    t.string "email_address"
    t.string "phone_number"
    t.string "abn"
    t.string "tax_number"
    t.string "account_number"
    t.string "contact_status"
    t.string "currency_code"
    t.boolean "is_customer", default: false
    t.boolean "is_supplier", default: false
    t.jsonb "addresses", default: []
    t.jsonb "phones", default: []
    t.string "bank_account_details"
    t.string "batch_payments_bank_account_name"
    t.string "batch_payments_bank_account_number"
    t.string "batch_payments_bank_bsb"
    t.bigint "contact_id"
    t.datetime "xero_updated_at"
    t.datetime "last_synced_at"
    t.jsonb "raw_data"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "sync_enabled", default: true
    t.string "sync_direction", default: "bidirectional"
    t.text "sync_error"
    t.jsonb "conflict_fields", default: {}
    t.string "match_type"
    t.decimal "match_confidence", precision: 5, scale: 4
    t.boolean "needs_review", default: false
    t.datetime "reviewed_at"
    t.string "reviewed_by"
    t.index ["contact_id"], name: "index_warehouse_contacts_on_contact_id"
    t.index ["email_address"], name: "index_warehouse_contacts_on_email_address"
    t.index ["is_customer", "tenant_id"], name: "idx_warehouse_contacts_customers"
    t.index ["is_supplier", "tenant_id"], name: "idx_warehouse_contacts_suppliers"
    t.index ["name"], name: "index_warehouse_contacts_on_name"
    t.index ["needs_review"], name: "index_warehouse_contacts_on_needs_review"
    t.index ["sync_enabled"], name: "index_warehouse_contacts_on_sync_enabled"
    t.index ["tenant_id"], name: "index_warehouse_contacts_on_tenant_id"
    t.index ["xero_id", "tenant_id"], name: "idx_warehouse_contacts_xero_tenant", unique: true
  end

  create_table "whs_action_items", force: :cascade do |t|
    t.string "actionable_type", null: false
    t.bigint "actionable_id", null: false
    t.bigint "assigned_to_user_id"
    t.bigint "created_by_id", null: false
    t.bigint "project_task_id"
    t.string "title", null: false
    t.text "description"
    t.string "action_type", null: false
    t.string "priority", default: "medium", null: false
    t.string "status", default: "open", null: false
    t.date "due_date"
    t.datetime "completed_at"
    t.text "completion_notes"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sm_task_id"
    t.index ["actionable_type", "actionable_id"], name: "index_whs_action_items_on_actionable"
    t.index ["assigned_to_user_id"], name: "index_whs_action_items_on_assigned_to_user_id"
    t.index ["created_by_id"], name: "index_whs_action_items_on_created_by_id"
    t.index ["due_date"], name: "index_whs_action_items_on_due_date"
    t.index ["priority"], name: "index_whs_action_items_on_priority"
    t.index ["project_task_id"], name: "index_whs_action_items_on_project_task_id"
    t.index ["sm_task_id"], name: "index_whs_action_items_on_sm_task_id"
    t.index ["status"], name: "index_whs_action_items_on_status"
  end

  create_table "whs_incidents", force: :cascade do |t|
    t.bigint "job_id"
    t.bigint "reported_by_user_id", null: false
    t.bigint "investigated_by_user_id"
    t.string "incident_number", null: false
    t.datetime "incident_date", null: false
    t.datetime "report_date", null: false
    t.string "location_description"
    t.string "status", default: "reported", null: false
    t.string "incident_category", null: false
    t.string "incident_type"
    t.string "severity_level", null: false
    t.text "what_happened", null: false
    t.string "activity_being_performed"
    t.string "equipment_involved"
    t.string "weather_conditions"
    t.string "time_of_day"
    t.string "lighting_conditions"
    t.jsonb "contributing_factors", default: []
    t.string "injured_person_name"
    t.string "injured_person_company"
    t.string "injured_person_role"
    t.string "injury_type"
    t.string "body_part_affected"
    t.boolean "first_aid_given", default: false
    t.boolean "medical_treatment_required", default: false
    t.string "hospital_attended"
    t.integer "time_lost_hours"
    t.date "likely_return_date"
    t.jsonb "witnesses", default: []
    t.text "immediate_actions_taken"
    t.date "investigation_date"
    t.text "immediate_cause"
    t.text "underlying_causes"
    t.text "recommendations"
    t.jsonb "photo_urls", default: []
    t.jsonb "evidence_urls", default: []
    t.boolean "workcov_notification_required", default: false
    t.boolean "notifiable_incident", default: false
    t.date "workcov_notification_date"
    t.string "workcov_reference_number"
    t.datetime "closed_at"
    t.text "closure_notes"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sm_task_id"
    t.index ["incident_category"], name: "index_whs_incidents_on_incident_category"
    t.index ["incident_date"], name: "index_whs_incidents_on_incident_date"
    t.index ["incident_number"], name: "index_whs_incidents_on_incident_number", unique: true
    t.index ["investigated_by_user_id"], name: "index_whs_incidents_on_investigated_by_user_id"
    t.index ["job_id", "status"], name: "index_whs_incidents_on_job_id_and_status"
    t.index ["job_id"], name: "index_whs_incidents_on_job_id"
    t.index ["reported_by_user_id"], name: "index_whs_incidents_on_reported_by_user_id"
    t.index ["severity_level"], name: "index_whs_incidents_on_severity_level"
    t.index ["sm_task_id"], name: "index_whs_incidents_on_sm_task_id"
    t.index ["status"], name: "index_whs_incidents_on_status"
    t.index ["workcov_notification_required"], name: "index_whs_incidents_on_workcov_notification_required"
  end

  create_table "whs_induction_templates", force: :cascade do |t|
    t.string "name", null: false
    t.string "induction_type", null: false
    t.text "description"
    t.boolean "active", default: true
    t.decimal "version", precision: 3, scale: 1, default: "1.0"
    t.jsonb "content_sections", default: []
    t.integer "expiry_months"
    t.boolean "requires_renewal", default: false
    t.boolean "has_quiz", default: false
    t.integer "min_passing_score"
    t.text "acknowledgment_statement"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active"], name: "index_whs_induction_templates_on_active"
    t.index ["induction_type"], name: "index_whs_induction_templates_on_induction_type"
    t.index ["name"], name: "index_whs_induction_templates_on_name"
  end

  create_table "whs_inductions", force: :cascade do |t|
    t.bigint "whs_induction_template_id", null: false
    t.bigint "job_id"
    t.bigint "user_id"
    t.bigint "conducted_by_user_id", null: false
    t.string "certificate_number", null: false
    t.string "induction_type", null: false
    t.string "status", default: "valid", null: false
    t.string "worker_name", null: false
    t.string "worker_company"
    t.string "worker_contact"
    t.datetime "completion_date", null: false
    t.date "expiry_date"
    t.integer "quiz_score"
    t.boolean "passed", default: true
    t.text "worker_signature"
    t.text "supervisor_signature"
    t.text "acknowledgment_statement"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["certificate_number"], name: "index_whs_inductions_on_certificate_number", unique: true
    t.index ["conducted_by_user_id"], name: "index_whs_inductions_on_conducted_by_user_id"
    t.index ["expiry_date"], name: "index_whs_inductions_on_expiry_date"
    t.index ["job_id"], name: "index_whs_inductions_on_job_id"
    t.index ["status"], name: "index_whs_inductions_on_status"
    t.index ["user_id"], name: "index_whs_inductions_on_user_id"
    t.index ["whs_induction_template_id"], name: "index_whs_inductions_on_whs_induction_template_id"
    t.index ["worker_name", "induction_type"], name: "index_whs_inductions_on_worker_name_and_induction_type"
  end

  create_table "whs_inspection_items", force: :cascade do |t|
    t.bigint "whs_inspection_id", null: false
    t.string "item_description", null: false
    t.string "category"
    t.string "result"
    t.boolean "photo_required", default: false
    t.boolean "notes_required", default: false
    t.integer "weight", default: 1
    t.integer "position", default: 0
    t.text "notes"
    t.jsonb "photo_urls", default: []
    t.boolean "action_required", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["action_required"], name: "index_whs_inspection_items_on_action_required"
    t.index ["result"], name: "index_whs_inspection_items_on_result"
    t.index ["whs_inspection_id"], name: "index_whs_inspection_items_on_whs_inspection_id"
  end

  create_table "whs_inspection_templates", force: :cascade do |t|
    t.string "name", null: false
    t.string "inspection_type"
    t.string "category"
    t.text "description"
    t.integer "pass_threshold_percentage", default: 80
    t.boolean "active", default: true
    t.jsonb "checklist_items", default: []
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active"], name: "index_whs_inspection_templates_on_active"
    t.index ["inspection_type"], name: "index_whs_inspection_templates_on_inspection_type"
    t.index ["name"], name: "index_whs_inspection_templates_on_name"
  end

  create_table "whs_inspections", force: :cascade do |t|
    t.bigint "job_id"
    t.bigint "whs_inspection_template_id"
    t.bigint "inspector_user_id"
    t.bigint "created_by_id", null: false
    t.bigint "meeting_id"
    t.string "inspection_number", null: false
    t.string "inspection_type", null: false
    t.string "status", default: "scheduled", null: false
    t.string "title"
    t.text "description"
    t.date "scheduled_date"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.string "weather_conditions"
    t.text "site_conditions"
    t.integer "total_items", default: 0
    t.integer "pass_count", default: 0
    t.integer "fail_count", default: 0
    t.integer "na_count", default: 0
    t.decimal "compliance_score", precision: 5, scale: 2
    t.boolean "overall_pass", default: false
    t.boolean "critical_issues_found", default: false
    t.text "inspector_signature"
    t.text "overall_notes"
    t.boolean "follow_up_required", default: false
    t.date "follow_up_date"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_whs_inspections_on_created_by_id"
    t.index ["critical_issues_found"], name: "index_whs_inspections_on_critical_issues_found"
    t.index ["inspection_number"], name: "index_whs_inspections_on_inspection_number", unique: true
    t.index ["inspection_type"], name: "index_whs_inspections_on_inspection_type"
    t.index ["inspector_user_id"], name: "index_whs_inspections_on_inspector_user_id"
    t.index ["job_id", "status"], name: "index_whs_inspections_on_job_id_and_status"
    t.index ["job_id"], name: "index_whs_inspections_on_job_id"
    t.index ["meeting_id"], name: "index_whs_inspections_on_meeting_id"
    t.index ["scheduled_date"], name: "index_whs_inspections_on_scheduled_date"
    t.index ["status"], name: "index_whs_inspections_on_status"
  end

  create_table "whs_settings", force: :cascade do |t|
    t.string "setting_key", null: false
    t.text "setting_value"
    t.string "setting_type", default: "string"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["setting_key"], name: "index_whs_settings_on_setting_key", unique: true
  end

  create_table "whs_swms", force: :cascade do |t|
    t.bigint "job_id"
    t.bigint "created_by_id", null: false
    t.bigint "approved_by_id"
    t.bigint "superseded_by_id"
    t.string "swms_number", null: false
    t.string "title", null: false
    t.decimal "version", precision: 3, scale: 1, default: "1.0", null: false
    t.string "status", default: "draft", null: false
    t.boolean "company_wide", default: false, null: false
    t.text "activity_description"
    t.string "location_area"
    t.string "high_risk_type"
    t.date "start_date"
    t.integer "expected_duration_days"
    t.integer "workers_involved"
    t.string "supervisor_responsible"
    t.text "emergency_procedures"
    t.text "emergency_contact_numbers"
    t.string "first_aid_location"
    t.string "fire_extinguisher_location"
    t.string "emergency_assembly_point"
    t.text "evacuation_procedures"
    t.text "legislative_references"
    t.jsonb "ppe_requirements", default: {}
    t.jsonb "required_qualifications", default: []
    t.datetime "approved_at"
    t.datetime "superseded_at"
    t.string "rejection_reason"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sm_task_id"
    t.index ["approved_by_id"], name: "index_whs_swms_on_approved_by_id"
    t.index ["company_wide"], name: "index_whs_swms_on_company_wide"
    t.index ["created_by_id"], name: "index_whs_swms_on_created_by_id"
    t.index ["high_risk_type"], name: "index_whs_swms_on_high_risk_type"
    t.index ["job_id", "status"], name: "index_whs_swms_on_job_id_and_status"
    t.index ["job_id"], name: "index_whs_swms_on_job_id"
    t.index ["sm_task_id"], name: "index_whs_swms_on_sm_task_id"
    t.index ["status"], name: "index_whs_swms_on_status"
    t.index ["superseded_by_id"], name: "index_whs_swms_on_superseded_by_id"
    t.index ["swms_number"], name: "index_whs_swms_on_swms_number", unique: true
  end

  create_table "whs_swms_acknowledgments", force: :cascade do |t|
    t.bigint "whs_swms_id", null: false
    t.bigint "user_id"
    t.string "worker_name", null: false
    t.string "worker_company"
    t.string "worker_role"
    t.text "signature_data"
    t.datetime "acknowledged_at", null: false
    t.string "ip_address"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["acknowledged_at"], name: "index_whs_swms_acknowledgments_on_acknowledged_at"
    t.index ["user_id"], name: "index_whs_swms_acknowledgments_on_user_id"
    t.index ["whs_swms_id"], name: "index_whs_swms_acknowledgments_on_whs_swms_id"
  end

  create_table "whs_swms_controls", force: :cascade do |t|
    t.bigint "whs_swms_hazard_id", null: false
    t.text "control_description", null: false
    t.string "control_type", null: false
    t.string "responsibility"
    t.integer "residual_likelihood"
    t.integer "residual_consequence"
    t.integer "residual_risk_score"
    t.string "residual_risk_level"
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["control_type"], name: "index_whs_swms_controls_on_control_type"
    t.index ["whs_swms_hazard_id"], name: "index_whs_swms_controls_on_whs_swms_hazard_id"
  end

  create_table "whs_swms_hazards", force: :cascade do |t|
    t.bigint "whs_swms_id", null: false
    t.text "hazard_description", null: false
    t.integer "likelihood", null: false
    t.integer "consequence", null: false
    t.integer "risk_score", null: false
    t.string "risk_level"
    t.text "affected_persons"
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["risk_level"], name: "index_whs_swms_hazards_on_risk_level"
    t.index ["whs_swms_id"], name: "index_whs_swms_hazards_on_whs_swms_id"
  end

  create_table "xero_accounts", force: :cascade do |t|
    t.string "code", null: false
    t.string "name", null: false
    t.string "account_type"
    t.string "tax_type"
    t.text "description"
    t.boolean "active", default: true
    t.string "account_class"
    t.boolean "system_account", default: false
    t.boolean "enable_payments_to_account", default: false
    t.boolean "show_in_expense_claims", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_type"], name: "index_xero_accounts_on_account_type"
    t.index ["active"], name: "index_xero_accounts_on_active"
    t.index ["code"], name: "index_xero_accounts_on_code", unique: true
  end

  create_table "xero_alerts", force: :cascade do |t|
    t.bigint "xero_credential_id"
    t.bigint "corporate_company_id"
    t.string "alert_type", null: false
    t.string "severity", null: false
    t.string "title", null: false
    t.text "message"
    t.boolean "dismissed", default: false, null: false
    t.datetime "dismissed_at"
    t.bigint "dismissed_by_id"
    t.boolean "auto_resolved", default: false, null: false
    t.datetime "auto_resolved_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["corporate_company_id", "dismissed", "created_at"], name: "idx_xero_alerts_company_active"
    t.index ["corporate_company_id"], name: "index_xero_alerts_on_corporate_company_id"
    t.index ["dismissed_by_id"], name: "index_xero_alerts_on_dismissed_by_id"
    t.index ["severity", "dismissed"], name: "idx_xero_alerts_severity_active"
    t.index ["xero_credential_id", "alert_type", "dismissed"], name: "idx_xero_alerts_credential_type"
    t.index ["xero_credential_id"], name: "index_xero_alerts_on_xero_credential_id"
  end

  create_table "xero_chart_of_accounts", force: :cascade do |t|
    t.bigint "company_group_id"
    t.string "account_code", null: false
    t.string "account_name", null: false
    t.string "account_type"
    t.string "tax_type"
    t.text "description"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_code"], name: "index_xero_chart_of_accounts_on_account_code"
    t.index ["account_type"], name: "index_xero_chart_of_accounts_on_account_type"
    t.index ["active"], name: "index_xero_chart_of_accounts_on_active"
    t.index ["company_group_id", "account_code"], name: "idx_xero_coa_group_code", unique: true
    t.index ["company_group_id"], name: "index_xero_chart_of_accounts_on_company_group_id"
  end

  create_table "xero_credentials", force: :cascade do |t|
    t.string "access_token", null: false
    t.string "refresh_token", null: false
    t.datetime "expires_at", null: false
    t.string "tenant_id", null: false
    t.string "tenant_name"
    t.string "tenant_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "is_primary", default: false, null: false
    t.string "status", default: "connected", null: false
    t.datetime "refresh_token_expires_at"
    t.datetime "last_refresh_at"
    t.text "last_refresh_error"
    t.integer "refresh_failure_count", default: 0, null: false
    t.datetime "last_successful_api_call_at"
    t.string "circuit_state", default: "closed", null: false
    t.datetime "circuit_opened_at"
    t.integer "circuit_failure_count", default: 0, null: false
    t.string "granted_scopes"
    t.datetime "token_poisoned_at"
    t.string "poisoned_reason"
    t.index ["circuit_state"], name: "index_xero_credentials_on_circuit_state"
    t.index ["is_primary"], name: "index_xero_credentials_on_is_primary"
    t.index ["last_successful_api_call_at"], name: "index_xero_credentials_on_last_successful_api_call_at"
    t.index ["status"], name: "index_xero_credentials_on_status"
    t.index ["tenant_id"], name: "index_xero_credentials_on_tenant_id"
  end

  create_table "xero_duplicate_groups", force: :cascade do |t|
    t.string "group_key", null: false
    t.string "match_type", null: false
    t.decimal "confidence_score", precision: 5, scale: 2
    t.string "status", default: "pending"
    t.integer "merge_target_id"
    t.datetime "reviewed_at"
    t.string "reviewed_by"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["group_key"], name: "index_xero_duplicate_groups_on_group_key", unique: true
    t.index ["status"], name: "index_xero_duplicate_groups_on_status"
  end

  create_table "xero_duplicate_items", force: :cascade do |t|
    t.bigint "duplicate_group_id", null: false
    t.bigint "contact_id", null: false
    t.boolean "is_merge_target", default: false
    t.jsonb "data_snapshot"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id"], name: "index_xero_duplicate_items_on_contact_id"
    t.index ["duplicate_group_id", "contact_id"], name: "idx_on_duplicate_group_id_contact_id_22d95f474a", unique: true
    t.index ["duplicate_group_id"], name: "index_xero_duplicate_items_on_duplicate_group_id"
  end

  create_table "xero_feature_tabs", force: :cascade do |t|
    t.string "tab_key", null: false
    t.string "display_name", null: false
    t.string "tab_group", default: "data"
    t.integer "order_position", default: 0
    t.boolean "enabled", default: true
    t.string "component_name"
    t.bigint "document_folder_id"
    t.string "icon_name"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "group_member", default: false, null: false
    t.string "parent_key"
    t.boolean "visible", default: true, null: false
    t.index ["document_folder_id"], name: "index_xero_feature_tabs_on_document_folder_id"
    t.index ["enabled"], name: "index_xero_feature_tabs_on_enabled"
    t.index ["order_position"], name: "index_xero_feature_tabs_on_order_position"
    t.index ["tab_key"], name: "index_xero_feature_tabs_on_tab_key", unique: true
  end

  create_table "xero_health_events", force: :cascade do |t|
    t.bigint "xero_credential_id"
    t.string "event_type", null: false
    t.string "from_status"
    t.string "to_status"
    t.string "trigger"
    t.text "message"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["event_type", "created_at"], name: "index_xero_health_events_on_event_type_and_created_at"
    t.index ["from_status", "to_status"], name: "index_xero_health_events_on_from_status_and_to_status"
    t.index ["xero_credential_id", "created_at"], name: "index_xero_health_events_on_xero_credential_id_and_created_at"
    t.index ["xero_credential_id"], name: "index_xero_health_events_on_xero_credential_id"
  end

  create_table "xero_sync_events", force: :cascade do |t|
    t.bigint "xero_credential_id"
    t.string "sync_type", null: false
    t.string "event_type", null: false
    t.string "trigger", null: false
    t.integer "records_processed", default: 0, null: false
    t.integer "records_created", default: 0, null: false
    t.integer "records_updated", default: 0, null: false
    t.integer "records_skipped", default: 0, null: false
    t.integer "records_failed", default: 0, null: false
    t.text "error_message"
    t.string "error_class"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.integer "duration_ms"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_xero_sync_events_on_created_at"
    t.index ["sync_type", "event_type", "created_at"], name: "idx_xero_sync_events_type_status"
    t.index ["xero_credential_id", "sync_type", "created_at"], name: "idx_xero_sync_events_cred_type_time"
    t.index ["xero_credential_id"], name: "index_xero_sync_events_on_xero_credential_id"
  end

  create_table "xero_sync_statuses", force: :cascade do |t|
    t.string "sync_type", null: false
    t.string "tenant_id"
    t.datetime "last_synced_at"
    t.datetime "next_sync_at"
    t.string "status"
    t.integer "records_synced"
    t.text "last_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["sync_type", "tenant_id"], name: "index_xero_sync_statuses_on_sync_type_and_tenant_id", unique: true
  end

  create_table "xero_tax_rates", force: :cascade do |t|
    t.string "code"
    t.string "name"
    t.decimal "rate"
    t.boolean "active"
    t.string "display_rate"
    t.string "tax_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  add_foreign_key "account_mappings", "accounting_integrations"
  add_foreign_key "accounting_integrations", "contacts"
  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "agent_definitions", "users", column: "created_by_id"
  add_foreign_key "agent_definitions", "users", column: "last_run_by_id", on_delete: :nullify
  add_foreign_key "agent_definitions", "users", column: "updated_by_id"
  add_foreign_key "ai_processing_logs", "users", column: "corrected_by_id"
  add_foreign_key "asset_insurances", "assets"
  add_foreign_key "asset_service_histories", "assets"
  add_foreign_key "asset_service_histories", "users"
  add_foreign_key "assets", "corporate_companies", column: "company_id"
  add_foreign_key "attachments", "organization_microsoft_app_credentials"
  add_foreign_key "balance_sheet_reports", "corporate_companies", column: "company_id"
  add_foreign_key "bank_accounts", "corporate_companies", column: "company_id"
  add_foreign_key "bank_transactions", "bank_accounts"
  add_foreign_key "bank_transactions", "corporate_companies", column: "company_id"
  add_foreign_key "batch_operations", "jobs"
  add_foreign_key "batch_operations", "users"
  add_foreign_key "bill_inboxes", "bpmn_process_instances"
  add_foreign_key "bill_inboxes", "contacts", column: "supplier_id"
  add_foreign_key "bill_inboxes", "corporate_companies"
  add_foreign_key "bill_inboxes", "corporate_companies", column: "detected_company_id"
  add_foreign_key "bill_inboxes", "external_invoices"
  add_foreign_key "bill_inboxes", "purchase_orders", column: "matched_purchase_order_id"
  add_foreign_key "bill_inboxes", "users", column: "approved_by_id"
  add_foreign_key "bill_payment_batches", "bank_accounts"
  add_foreign_key "bill_payment_batches", "bpmn_process_instances"
  add_foreign_key "bill_payment_batches", "corporate_companies"
  add_foreign_key "bill_payment_batches", "users", column: "approved_by_id"
  add_foreign_key "bill_payment_batches", "users", column: "created_by_id"
  add_foreign_key "bill_payments", "bill_inboxes"
  add_foreign_key "bill_payments", "bill_payment_batches"
  add_foreign_key "bill_payments", "purchase_orders"
  add_foreign_key "bpmn_edges", "bpmn_nodes", column: "source_node_id", on_delete: :cascade
  add_foreign_key "bpmn_edges", "bpmn_nodes", column: "target_node_id", on_delete: :cascade
  add_foreign_key "bpmn_edges", "bpmn_processes", on_delete: :cascade
  add_foreign_key "bpmn_nodes", "bpmn_processes", on_delete: :cascade
  add_foreign_key "bpmn_process_instances", "bpmn_processes"
  add_foreign_key "bpmn_task_instances", "bpmn_nodes"
  add_foreign_key "bpmn_task_instances", "bpmn_tokens", on_delete: :cascade
  add_foreign_key "bpmn_tokens", "bpmn_nodes", column: "current_node_id"
  add_foreign_key "bpmn_tokens", "bpmn_process_instances", on_delete: :cascade
  add_foreign_key "bpmn_tokens", "bpmn_tokens", column: "parent_token_id"
  add_foreign_key "bpmn_triggers", "bpmn_processes", on_delete: :cascade
  add_foreign_key "case_actions", "cases"
  add_foreign_key "case_actions", "users", column: "created_by_id"
  add_foreign_key "case_companies", "cases"
  add_foreign_key "case_companies", "corporate_companies", column: "company_id"
  add_foreign_key "case_contacts", "cases"
  add_foreign_key "case_contacts", "contacts"
  add_foreign_key "case_contacts", "users", column: "added_by_id"
  add_foreign_key "case_documents", "cases"
  add_foreign_key "case_documents", "corporate_company_documents", column: "company_document_id"
  add_foreign_key "case_documents", "users", column: "added_by_id"
  add_foreign_key "case_jobs", "cases"
  add_foreign_key "case_jobs", "jobs"
  add_foreign_key "case_timeline_events", "cases"
  add_foreign_key "case_timeline_events", "contacts"
  add_foreign_key "case_timeline_events", "corporate_companies", column: "company_id"
  add_foreign_key "case_timeline_events", "jobs"
  add_foreign_key "cases", "cases", column: "parent_case_id"
  add_foreign_key "cases", "contacts"
  add_foreign_key "cases", "corporate_companies", column: "company_id"
  add_foreign_key "cases", "corporate_groups", column: "company_group_id"
  add_foreign_key "cases", "users", column: "assigned_to_id"
  add_foreign_key "cases", "users", column: "created_by_id"
  add_foreign_key "chat_messages", "jobs"
  add_foreign_key "chat_messages", "projects"
  add_foreign_key "chat_messages", "users"
  add_foreign_key "claim_stage_templates", "job_types"
  add_foreign_key "colour_selection_templates", "job_types"
  add_foreign_key "columns", "column_type_definitions"
  add_foreign_key "columns", "foundations"
  add_foreign_key "company_approval_rules", "bpmn_processes"
  add_foreign_key "company_approval_rules", "corporate_companies"
  add_foreign_key "company_approval_rules", "users", column: "approver_id"
  add_foreign_key "company_approval_rules", "users", column: "escalation_to_user_id"
  add_foreign_key "contact_activities", "contacts"
  add_foreign_key "contact_addresses", "contacts"
  add_foreign_key "contact_corporate_group_memberships", "contacts"
  add_foreign_key "contact_corporate_group_memberships", "corporate_companies", column: "company_id"
  add_foreign_key "contact_corporate_group_memberships", "corporate_groups", column: "company_group_id"
  add_foreign_key "contact_external_links", "contacts"
  add_foreign_key "contact_group_memberships", "contact_groups"
  add_foreign_key "contact_group_memberships", "contacts"
  add_foreign_key "contact_persons", "contacts"
  add_foreign_key "contact_phones", "contacts"
  add_foreign_key "contact_quality_reviews", "contacts"
  add_foreign_key "contact_quality_reviews", "contacts", column: "suggested_company_id"
  add_foreign_key "contact_quality_reviews", "users", column: "reviewed_by_id"
  add_foreign_key "contact_relationships", "contacts", column: "related_contact_id"
  add_foreign_key "contact_relationships", "contacts", column: "source_contact_id"
  add_foreign_key "contacts", "contacts", column: "primary_company_id"
  add_foreign_key "contacts", "corporate_groups", column: "company_group_id"
  add_foreign_key "corporate_companies", "contacts"
  add_foreign_key "corporate_companies", "corporate_companies", column: "consolidation_parent_id", on_delete: :nullify
  add_foreign_key "corporate_companies", "corporate_companies", column: "parent_company_id"
  add_foreign_key "corporate_companies", "corporate_groups", column: "company_group_id"
  add_foreign_key "corporate_company_activities", "corporate_companies", column: "company_id"
  add_foreign_key "corporate_company_activities", "users"
  add_foreign_key "corporate_company_compliance_items", "corporate_companies", column: "company_id"
  add_foreign_key "corporate_company_directors", "contacts"
  add_foreign_key "corporate_company_directors", "corporate_companies", column: "company_id"
  add_foreign_key "corporate_company_documents", "assets"
  add_foreign_key "corporate_company_documents", "contacts"
  add_foreign_key "corporate_company_documents", "corporate_companies", column: "company_id"
  add_foreign_key "corporate_company_documents", "corporate_company_loans", column: "loan_id"
  add_foreign_key "corporate_company_documents", "document_types"
  add_foreign_key "corporate_company_loans", "corporate_companies", column: "borrower_company_id"
  add_foreign_key "corporate_company_loans", "corporate_companies", column: "lender_company_id"
  add_foreign_key "corporate_company_minutes", "corporate_companies", column: "company_id"
  add_foreign_key "corporate_company_minutes", "minute_templates"
  add_foreign_key "corporate_company_monthly_pls", "corporate_companies"
  add_foreign_key "corporate_company_shareholdings", "corporate_companies", column: "company_id"
  add_foreign_key "corporate_company_xero_accounts", "corporate_company_xero_connections", column: "company_xero_connection_id"
  add_foreign_key "corporate_company_xero_connections", "corporate_companies", column: "company_id"
  add_foreign_key "corporate_company_xero_connections", "xero_credentials"
  add_foreign_key "director_onboarding_requests", "contacts"
  add_foreign_key "director_onboarding_requests", "corporate_companies", column: "company_id"
  add_foreign_key "director_onboarding_requests", "users", column: "invited_by_id"
  add_foreign_key "director_onboarding_requests", "users", column: "reviewed_by_id"
  add_foreign_key "dividend_payments", "contacts", column: "shareholder_id"
  add_foreign_key "dividend_payments", "dividends"
  add_foreign_key "dividends", "corporate_companies", column: "company_id"
  add_foreign_key "document_activities", "corporate_company_documents", column: "company_document_id"
  add_foreign_key "document_activities", "users"
  add_foreign_key "document_duplicate_reviews", "cases"
  add_foreign_key "document_duplicate_reviews", "corporate_company_documents", column: "existing_document_id"
  add_foreign_key "document_duplicate_reviews", "corporate_company_documents", column: "new_document_id"
  add_foreign_key "document_duplicate_reviews", "users", column: "resolved_by_id"
  add_foreign_key "document_folders", "document_folders", column: "parent_id"
  add_foreign_key "document_tasks", "jobs"
  add_foreign_key "document_type_folders", "document_folders"
  add_foreign_key "document_type_folders", "document_types"
  add_foreign_key "document_verification_feedbacks", "corporate_company_documents", column: "company_document_id"
  add_foreign_key "document_verification_feedbacks", "users"
  add_foreign_key "e_signature_certificates", "e_signature_requests"
  add_foreign_key "e_signature_events", "e_signature_requests"
  add_foreign_key "e_signature_events", "e_signature_signers"
  add_foreign_key "e_signature_events", "users", column: "actor_user_id"
  add_foreign_key "e_signature_fields", "e_signature_requests"
  add_foreign_key "e_signature_fields", "e_signature_signers"
  add_foreign_key "e_signature_requests", "users", column: "created_by_id"
  add_foreign_key "e_signature_signers", "contacts"
  add_foreign_key "e_signature_signers", "e_signature_requests"
  add_foreign_key "entity_tab_document_types", "document_types"
  add_foreign_key "entity_tab_document_types", "entity_tabs"
  add_foreign_key "entity_tabs", "entity_tabs", column: "parent_id"
  add_foreign_key "entity_tabs", "jobs"
  add_foreign_key "estimate_line_items", "estimates"
  add_foreign_key "estimate_reviews", "estimates"
  add_foreign_key "estimates", "jobs"
  add_foreign_key "external_invoices", "contacts"
  add_foreign_key "external_invoices", "jobs"
  add_foreign_key "external_invoices", "warehouse_contacts"
  add_foreign_key "fact_job_daily_snapshots", "jobs"
  add_foreign_key "feature_trackers", "feature_chapters"
  add_foreign_key "financial_transactions", "corporate_companies", column: "company_id"
  add_foreign_key "financial_transactions", "jobs"
  add_foreign_key "financial_transactions", "users"
  add_foreign_key "folder_template_items", "folder_template_items", column: "parent_id"
  add_foreign_key "folder_template_items", "folder_templates"
  add_foreign_key "folder_templates", "users", column: "created_by_id"
  add_foreign_key "grok_plans", "users"
  add_foreign_key "health_kudos_events", "users", on_delete: :nullify
  add_foreign_key "imap_credentials", "users"
  add_foreign_key "insurance_policies", "corporate_companies", column: "company_id"
  add_foreign_key "intercompany_balances", "corporate_companies", column: "company_id"
  add_foreign_key "intercompany_balances", "corporate_companies", column: "related_company_id"
  add_foreign_key "job_activities", "jobs"
  add_foreign_key "job_activities", "users"
  add_foreign_key "job_claim_stages", "claim_stage_templates"
  add_foreign_key "job_claim_stages", "external_invoices"
  add_foreign_key "job_claim_stages", "jobs"
  add_foreign_key "job_claims", "contacts"
  add_foreign_key "job_claims", "jobs"
  add_foreign_key "job_colour_selections", "jobs"
  add_foreign_key "job_colour_selections", "pricebook", column: "pricebook_item_id"
  add_foreign_key "job_contacts", "contacts"
  add_foreign_key "job_contacts", "jobs"
  add_foreign_key "job_contacts", "users"
  add_foreign_key "job_documentation_tabs", "job_documentation_tabs", column: "parent_id", on_delete: :cascade
  add_foreign_key "job_documentation_tabs", "jobs"
  add_foreign_key "job_documents", "document_types"
  add_foreign_key "job_documents", "document_types", column: "ai_suggested_type_id", on_delete: :nullify
  add_foreign_key "job_documents", "jobs"
  add_foreign_key "job_documents", "users", column: "rename_approved_by_id", on_delete: :nullify
  add_foreign_key "job_people", "contacts"
  add_foreign_key "job_people", "jobs"
  add_foreign_key "job_plan_revisions", "job_plans"
  add_foreign_key "job_plan_revisions", "users", column: "issued_by_id"
  add_foreign_key "job_plan_tabs", "job_plan_tabs", column: "parent_id"
  add_foreign_key "job_plan_tabs", "jobs"
  add_foreign_key "job_plan_tabs", "plan_categories"
  add_foreign_key "job_plans", "job_plan_revisions", column: "current_revision_id"
  add_foreign_key "job_plans", "job_plan_tabs"
  add_foreign_key "job_plans", "jobs"
  add_foreign_key "job_plans", "plan_types"
  add_foreign_key "job_specifications", "jobs"
  add_foreign_key "job_specifications", "pricebook", column: "pricebook_item_id"
  add_foreign_key "job_status_stages", "job_stages"
  add_foreign_key "job_status_stages", "job_status"
  add_foreign_key "job_status_stages", "job_types"
  add_foreign_key "job_type_statuses", "job_status"
  add_foreign_key "job_type_statuses", "job_types"
  add_foreign_key "jobs", "job_stages", on_delete: :nullify
  add_foreign_key "jobs", "job_status", on_delete: :nullify
  add_foreign_key "jobs", "job_types", on_delete: :nullify
  add_foreign_key "jobs", "users", column: "archived_by_id", on_delete: :nullify
  add_foreign_key "known_parties", "contacts"
  add_foreign_key "kudos_events", "purchase_orders"
  add_foreign_key "kudos_events", "quote_responses"
  add_foreign_key "kudos_events", "subcontractor_accounts"
  add_foreign_key "leads", "jobs"
  add_foreign_key "maintenance_requests", "contacts", column: "supplier_contact_id"
  add_foreign_key "maintenance_requests", "jobs"
  add_foreign_key "maintenance_requests", "purchase_orders"
  add_foreign_key "maintenance_requests", "users", column: "reported_by_user_id"
  add_foreign_key "meeting_agenda_items", "meetings"
  add_foreign_key "meeting_agenda_items", "project_tasks", column: "created_task_id"
  add_foreign_key "meeting_agenda_items", "tasks", column: "sm_task_id"
  add_foreign_key "meeting_agenda_items", "users", column: "presenter_id"
  add_foreign_key "meeting_participants", "contacts"
  add_foreign_key "meeting_participants", "meetings"
  add_foreign_key "meeting_participants", "users"
  add_foreign_key "meetings", "jobs"
  add_foreign_key "meetings", "meeting_types"
  add_foreign_key "meetings", "users", column: "created_by_id"
  add_foreign_key "microsoft_credentials", "organizations"
  add_foreign_key "microsoft_credentials", "users", column: "connected_by_id"
  add_foreign_key "microsoft_credentials", "users", column: "setup_by_id"
  add_foreign_key "navigation_items", "navigation_groups", name: "navigation_items_navigation_group_id_fkey"
  add_foreign_key "navigation_items", "navigation_items", column: "parent_id", name: "fk_navigation_items_parent"
  add_foreign_key "notifications", "users"
  add_foreign_key "one_drive_credentials", "jobs"
  add_foreign_key "organization_microsoft_app_credentials", "organizations"
  add_foreign_key "organization_microsoft_app_credentials", "users", column: "setup_by_id", name: "organization_microsoft_app_credentials_setup_by_id_fkey"
  add_foreign_key "organization_one_drive_credentials", "users", column: "connected_by_id"
  add_foreign_key "pay_now_requests", "contacts"
  add_foreign_key "pay_now_requests", "pay_now_weekly_limits"
  add_foreign_key "pay_now_requests", "payments"
  add_foreign_key "pay_now_requests", "portal_users", column: "requested_by_portal_user_id"
  add_foreign_key "pay_now_requests", "purchase_orders"
  add_foreign_key "pay_now_requests", "users", column: "approved_by_builder_id"
  add_foreign_key "pay_now_requests", "users", column: "reviewed_by_supervisor_id"
  add_foreign_key "pay_now_weekly_limits", "users", column: "set_by_id"
  add_foreign_key "payments", "purchase_orders"
  add_foreign_key "payments", "users", column: "created_by_id"
  add_foreign_key "plan_category_plan_types", "plan_categories"
  add_foreign_key "plan_category_plan_types", "plan_types"
  add_foreign_key "plan_folder_scans", "job_plans"
  add_foreign_key "plan_folder_scans", "jobs"
  add_foreign_key "plan_identification_rules", "plan_types"
  add_foreign_key "plan_identification_rules", "users", column: "created_by_id"
  add_foreign_key "plan_identifications", "job_plans"
  add_foreign_key "plan_identifications", "plan_categories", column: "identified_plan_category_id"
  add_foreign_key "plan_identifications", "plan_types", column: "identified_plan_type_id"
  add_foreign_key "plan_identifications", "users", column: "reviewed_by_id"
  add_foreign_key "plan_reextractions", "jobs"
  add_foreign_key "plan_uploads", "job_plan_tabs"
  add_foreign_key "plan_uploads", "jobs"
  add_foreign_key "plan_uploads", "users", column: "uploaded_by_id"
  add_foreign_key "portal_access_logs", "portal_users"
  add_foreign_key "portal_users", "contacts"
  add_foreign_key "price_histories", "contacts", column: "supplier_id", name: "fk_rails_price_histories_contact"
  add_foreign_key "price_histories", "pricebook", column: "pricebook_item_id"
  add_foreign_key "pricebook", "contacts", column: "default_supplier_id", name: "fk_rails_pricebook_items_default_supplier"
  add_foreign_key "pricebook", "contacts", column: "supplier_id", name: "fk_rails_pricebook_items_contact"
  add_foreign_key "pricebook", "pricebook_categories", column: "category_id"
  add_foreign_key "profit_loss_reports", "corporate_companies", column: "company_id"
  add_foreign_key "project_task_checklist_items", "project_tasks"
  add_foreign_key "project_tasks", "project_tasks", column: "parent_task_id"
  add_foreign_key "project_tasks", "projects"
  add_foreign_key "project_tasks", "purchase_orders"
  add_foreign_key "project_tasks", "schedule_template_rows"
  add_foreign_key "project_tasks", "task_templates"
  add_foreign_key "project_tasks", "users", column: "assigned_to_id"
  add_foreign_key "project_tasks", "users", column: "supervisor_checked_by_id"
  add_foreign_key "projects", "jobs"
  add_foreign_key "projects", "users", column: "project_manager_id"
  add_foreign_key "purchase_order_documents", "document_tasks"
  add_foreign_key "purchase_order_documents", "purchase_orders"
  add_foreign_key "purchase_order_line_items", "pricebook", column: "pricebook_item_id"
  add_foreign_key "purchase_order_line_items", "purchase_orders"
  add_foreign_key "purchase_orders", "bill_inboxes", column: "last_bill_inbox_id"
  add_foreign_key "purchase_orders", "contacts", column: "supplier_id", name: "fk_rails_purchase_orders_contact"
  add_foreign_key "purchase_orders", "estimates"
  add_foreign_key "purchase_orders", "jobs"
  add_foreign_key "purchase_orders", "quote_responses"
  add_foreign_key "quote_request_contacts", "contacts"
  add_foreign_key "quote_request_contacts", "quote_requests"
  add_foreign_key "quote_requests", "jobs"
  add_foreign_key "quote_requests", "quote_responses", column: "selected_quote_response_id"
  add_foreign_key "quote_requests", "users", column: "created_by_id"
  add_foreign_key "quote_responses", "contacts"
  add_foreign_key "quote_responses", "portal_users", column: "responded_by_portal_user_id"
  add_foreign_key "quote_responses", "quote_requests"
  add_foreign_key "rain_logs", "jobs"
  add_foreign_key "rain_logs", "users", column: "created_by_user_id"
  add_foreign_key "reconciliation_reports", "corporate_groups", column: "company_group_id"
  add_foreign_key "role_permissions", "permissions"
  add_foreign_key "schedule_task_checklist_items", "schedule_tasks"
  add_foreign_key "schedule_tasks", "jobs"
  add_foreign_key "schedule_tasks", "purchase_orders"
  add_foreign_key "schedule_template_row_audits", "schedule_template_rows"
  add_foreign_key "schedule_template_row_audits", "users"
  add_foreign_key "schedule_template_rows", "contacts", column: "supplier_id"
  add_foreign_key "schedule_template_rows", "schedule_templates"
  add_foreign_key "schedule_template_rows", "users", column: "assigned_user_id"
  add_foreign_key "schedule_templates", "users", column: "created_by_id"
  add_foreign_key "share_transfers", "contacts", column: "from_shareholder_id"
  add_foreign_key "share_transfers", "contacts", column: "to_shareholder_id"
  add_foreign_key "share_transfers", "corporate_companies", column: "company_id"
  add_foreign_key "sm_dependencies", "tasks", column: "predecessor_task_id", on_delete: :cascade
  add_foreign_key "sm_dependencies", "tasks", column: "successor_task_id", on_delete: :cascade
  add_foreign_key "sm_dependencies", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "sm_dependencies", "users", column: "deleted_by_id", on_delete: :nullify
  add_foreign_key "sm_hold_logs", "jobs", on_delete: :cascade
  add_foreign_key "sm_hold_logs", "sm_hold_reasons", column: "hold_reason_id", on_delete: :nullify
  add_foreign_key "sm_hold_logs", "tasks", column: "hold_task_id", on_delete: :cascade
  add_foreign_key "sm_hold_logs", "users", column: "hold_released_by_id", on_delete: :nullify
  add_foreign_key "sm_hold_logs", "users", column: "hold_started_by_id", on_delete: :nullify
  add_foreign_key "sm_resource_allocations", "sm_resources", column: "resource_id", on_delete: :cascade
  add_foreign_key "sm_resource_allocations", "tasks", on_delete: :cascade
  add_foreign_key "sm_resources", "contacts", on_delete: :nullify
  add_foreign_key "sm_resources", "users", on_delete: :nullify
  add_foreign_key "sm_rollover_logs", "jobs", on_delete: :cascade
  add_foreign_key "sm_rollover_logs", "tasks", on_delete: :cascade
  add_foreign_key "sm_settings", "schedule_templates", column: "default_template_id", on_delete: :nullify
  add_foreign_key "sm_spawn_logs", "tasks", column: "parent_task_id", on_delete: :cascade
  add_foreign_key "sm_spawn_logs", "tasks", column: "spawned_task_id", on_delete: :cascade
  add_foreign_key "sm_spawn_logs", "users", column: "spawned_by_id", on_delete: :nullify
  add_foreign_key "sm_template_rows", "contacts", column: "supplier_id"
  add_foreign_key "sm_template_rows", "sm_template_rows", column: "parent_row_id"
  add_foreign_key "sm_template_rows", "sm_templates"
  add_foreign_key "sm_template_rows", "supervisor_checklist_templates", column: "checklist_id"
  add_foreign_key "sm_template_rows", "users", column: "created_by_id"
  add_foreign_key "sm_template_rows", "users", column: "updated_by_id"
  add_foreign_key "sm_templates", "users", column: "created_by_id"
  add_foreign_key "sm_templates", "users", column: "updated_by_id"
  add_foreign_key "sm_time_entries", "sm_resource_allocations", column: "allocation_id", on_delete: :nullify
  add_foreign_key "sm_time_entries", "sm_resources", column: "resource_id", on_delete: :cascade
  add_foreign_key "sm_time_entries", "tasks", on_delete: :cascade
  add_foreign_key "sm_time_entries", "users", column: "approved_by_id", on_delete: :nullify
  add_foreign_key "sm_time_entries", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "sm_working_drawing_pages", "tasks", on_delete: :cascade
  add_foreign_key "sms_messages", "contacts"
  add_foreign_key "sms_messages", "users"
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "specification_templates", "job_types"
  add_foreign_key "subcontractor_accounts", "contacts", column: "invited_by_contact_id"
  add_foreign_key "subcontractor_accounts", "portal_users"
  add_foreign_key "subcontractor_invoices", "accounting_integrations"
  add_foreign_key "subcontractor_invoices", "contacts"
  add_foreign_key "subcontractor_invoices", "purchase_orders"
  add_foreign_key "table_health_checks", "foundations"
  add_foreign_key "task_dependencies", "project_tasks", column: "predecessor_task_id"
  add_foreign_key "task_dependencies", "project_tasks", column: "successor_task_id"
  add_foreign_key "task_updates", "project_tasks"
  add_foreign_key "task_updates", "users"
  add_foreign_key "tasks", "contacts", column: "supplier_id", on_delete: :nullify
  add_foreign_key "tasks", "jobs", on_delete: :cascade
  add_foreign_key "tasks", "purchase_orders", on_delete: :nullify
  add_foreign_key "tasks", "schedule_template_rows", column: "template_row_id", on_delete: :nullify
  add_foreign_key "tasks", "sm_hold_reasons", column: "hold_reason_id", on_delete: :nullify
  add_foreign_key "tasks", "sm_template_rows"
  add_foreign_key "tasks", "supervisor_checklist_templates", column: "checklist_id", on_delete: :nullify
  add_foreign_key "tasks", "tasks", column: "parent_task_id", on_delete: :nullify
  add_foreign_key "tasks", "users", column: "assigned_user_id", on_delete: :nullify
  add_foreign_key "tasks", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "tasks", "users", column: "hold_released_by_id", on_delete: :nullify
  add_foreign_key "tasks", "users", column: "hold_started_by_id", on_delete: :nullify
  add_foreign_key "tasks", "users", column: "supplier_confirmed_by_id", on_delete: :nullify
  add_foreign_key "tasks", "users", column: "updated_by_id", on_delete: :nullify
  add_foreign_key "user_job_tab_configs", "job_tabs"
  add_foreign_key "user_job_tab_configs", "job_tabs", column: "parent_job_tab_id"
  add_foreign_key "user_job_tab_configs", "users"
  add_foreign_key "user_microsoft_tokens", "users"
  add_foreign_key "user_navigation_configs", "navigation_items", name: "user_navigation_configs_navigation_item_id_fkey"
  add_foreign_key "user_navigation_configs", "users", name: "user_navigation_configs_user_id_fkey"
  add_foreign_key "user_outlook_credentials", "users", name: "user_outlook_credentials_user_id_fkey"
  add_foreign_key "user_permissions", "permissions"
  add_foreign_key "user_permissions", "users"
  add_foreign_key "users", "user_groups"
  add_foreign_key "warehouse_bank_transactions", "contacts"
  add_foreign_key "warehouse_bank_transactions", "warehouse_contacts"
  add_foreign_key "warehouse_contacts", "contacts"
  add_foreign_key "whs_action_items", "project_tasks"
  add_foreign_key "whs_action_items", "tasks", column: "sm_task_id"
  add_foreign_key "whs_action_items", "users", column: "assigned_to_user_id"
  add_foreign_key "whs_action_items", "users", column: "created_by_id"
  add_foreign_key "whs_incidents", "jobs"
  add_foreign_key "whs_incidents", "tasks", column: "sm_task_id"
  add_foreign_key "whs_incidents", "users", column: "investigated_by_user_id"
  add_foreign_key "whs_incidents", "users", column: "reported_by_user_id"
  add_foreign_key "whs_inductions", "jobs"
  add_foreign_key "whs_inductions", "users"
  add_foreign_key "whs_inductions", "users", column: "conducted_by_user_id"
  add_foreign_key "whs_inspection_items", "whs_inspections"
  add_foreign_key "whs_inspections", "jobs"
  add_foreign_key "whs_inspections", "meetings"
  add_foreign_key "whs_inspections", "users", column: "created_by_id"
  add_foreign_key "whs_inspections", "users", column: "inspector_user_id"
  add_foreign_key "whs_swms", "jobs"
  add_foreign_key "whs_swms", "tasks", column: "sm_task_id"
  add_foreign_key "whs_swms", "users", column: "approved_by_id"
  add_foreign_key "whs_swms", "users", column: "created_by_id"
  add_foreign_key "whs_swms", "whs_swms", column: "superseded_by_id"
  add_foreign_key "whs_swms_acknowledgments", "users"
  add_foreign_key "whs_swms_acknowledgments", "whs_swms"
  add_foreign_key "whs_swms_controls", "whs_swms_hazards"
  add_foreign_key "whs_swms_hazards", "whs_swms"
  add_foreign_key "xero_alerts", "corporate_companies"
  add_foreign_key "xero_alerts", "users", column: "dismissed_by_id"
  add_foreign_key "xero_alerts", "xero_credentials"
  add_foreign_key "xero_chart_of_accounts", "corporate_groups", column: "company_group_id"
  add_foreign_key "xero_duplicate_items", "contacts"
  add_foreign_key "xero_duplicate_items", "xero_duplicate_groups", column: "duplicate_group_id"
  add_foreign_key "xero_feature_tabs", "document_folders"
  add_foreign_key "xero_health_events", "xero_credentials"
  add_foreign_key "xero_sync_events", "xero_credentials"
end

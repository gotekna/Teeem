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

ActiveRecord::Schema[8.0].define(version: 2025_12_15_085455) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pg_stat_statements"
  enable_extension "pg_trgm"

  create_table "account_mappings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "accounting_integration_id", null: false
    t.bigint "keepr_account_id", null: false
    t.string "external_account_id", null: false
    t.string "external_account_name"
    t.string "external_account_code"
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "accounting_integrations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "active_storage_attachments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
  end

  create_table "active_storage_blobs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
  end

  create_table "active_storage_variant_records", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
  end

  create_table "agent_definitions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "asset_insurances", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "asset_service_histories", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "assets", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "attachments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "sharepoint_file_id", null: false
    t.string "sharepoint_path", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.bigint "file_size"
    t.string "content_hash", null: false
    t.bigint "organization_microsoft_app_credential_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "australian_councils", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "postcode", limit: 4, null: false
    t.string "suburb", null: false
    t.string "state", limit: 3, null: false
    t.string "council_name", null: false
    t.string "council_type"
    t.decimal "latitude", precision: 10, scale: 6
    t.decimal "longitude", precision: 10, scale: 6
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "balance_sheet_reports", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bank_accounts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bank_statement_reports", id: false, force: :cascade do |t|
    t.serial "id", null: false
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
  end

  create_table "bank_transactions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bill_inboxes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bill_payment_batches", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bill_payments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bpmn_edges", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bpmn_nodes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bpmn_process_instances", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bpmn_processes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bpmn_task_instances", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bpmn_tokens", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "bpmn_process_instance_id", null: false
    t.bigint "current_node_id", null: false
    t.bigint "parent_token_id"
    t.string "status", default: "active"
    t.datetime "arrived_at"
    t.datetime "completed_at"
    t.jsonb "data", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "bpmn_triggers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "bpmn_process_id", null: false
    t.string "trigger_type", null: false
    t.string "name", null: false
    t.boolean "is_active", default: true
    t.jsonb "config", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "bug_hunter_test_runs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "test_id", null: false
    t.string "status", null: false
    t.text "message"
    t.float "duration"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "template_id"
    t.text "console_output"
  end

  create_table "case_actions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "case_companies", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "case_id", null: false
    t.bigint "company_id", null: false
    t.string "role"
    t.text "notes"
    t.boolean "is_primary", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "case_contacts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "case_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "case_email_qas", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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

  create_table "case_emails", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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

  create_table "case_jobs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "case_id", null: false
    t.bigint "job_id", null: false
    t.text "notes"
    t.string "relevance"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "case_timeline_events", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "cases", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.string "onedrive_folder_id"
    t.string "onedrive_folder_path"
  end

  create_table "chat_messages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "column_type_definitions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "columns", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "company_approval_rules", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "company_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "title", null: false
    t.text "description"
    t.string "document_type", null: false
    t.date "document_date"
    t.string "file_url"
    t.string "file_name"
    t.integer "file_size"
    t.string "mime_type"
    t.datetime "uploaded_at"
    t.string "folder"
    t.string "storage_type"
    t.string "filed_by"
    t.date "filed_date"
    t.string "company_code"
    t.string "source", default: "manual"
    t.bigint "document_type_id"
    t.string "onedrive_file_id"
    t.string "onedrive_download_url"
    t.datetime "last_modified_at"
    t.string "expected_onedrive_path"
    t.string "register_folder"
    t.integer "financial_years", default: [], array: true
    t.string "display_title"
    t.datetime "ai_verified_at"
    t.string "ai_verification_status"
    t.string "ai_suggested_name"
    t.string "ai_suggested_folder"
    t.string "ai_suggested_type"
    t.integer "ai_suggested_fy", default: [], array: true
    t.decimal "ai_confidence_score"
    t.string "ai_extracted_description"
    t.date "ai_extracted_date"
    t.integer "ai_source_page"
    t.text "ai_source_quote"
    t.text "ai_analysis_notes"
    t.boolean "ai_contains_multiple_documents", default: false
    t.jsonb "ai_split_recommendation"
    t.datetime "user_validated_at"
    t.bigint "user_validated_by_id"
    t.boolean "validation_required", default: false
    t.date "ref_date"
    t.bigint "asset_id"
    t.bigint "loan_id"
    t.string "documentable_type"
    t.bigint "documentable_id"
    t.string "content_hash"
    t.string "external_id"
    t.datetime "synced_to_xero_at"
    t.string "xero_attachment_id"
    t.boolean "sync_to_xero", default: false, null: false
    t.bigint "legacy_corporate_document_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "contact_activities", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "contact_id", null: false
    t.string "activity_type"
    t.text "description"
    t.jsonb "metadata"
    t.string "performed_by_type"
    t.bigint "performed_by_id"
    t.datetime "occurred_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "contact_addresses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "contact_corporate_group_memberships", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "contact_emails", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "contact_id", null: false
    t.string "email", null: false
    t.boolean "is_primary", default: false, null: false
    t.string "label"
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "contact_external_links", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "contact_group_memberships", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "contact_id", null: false
    t.bigint "contact_group_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "contact_groups", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "xero_contact_group_id", null: false
    t.string "name", null: false
    t.string "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "contact_persons", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "contact_phones", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "contact_id", null: false
    t.string "phone_number", null: false
    t.string "phone_type", default: "mobile", null: false
    t.boolean "is_primary", default: false, null: false
    t.string "label"
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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

  create_table "contact_relationships", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "contact_roles", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "contact_types", default: "{}"
  end

  create_table "contact_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "display_name", null: false
    t.string "tab_label"
    t.text "description"
    t.boolean "active", default: true, null: false
    t.integer "position", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "contacts", force: :cascade do |t|
    t.string "tax_number"
    t.string "xero_id"
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
    t.string "xero_contact_status"
    t.string "xero_account_number"
    t.string "default_sales_account"
    t.decimal "default_discount", precision: 5, scale: 2
    t.integer "sales_due_day"
    t.string "sales_due_type"
    t.boolean "portal_enabled", default: false
    t.string "company_name_or_trust"
    t.bigint "primary_company_id"
    t.string "entity_type"
    t.boolean "xero_synced", default: false, null: false
    t.string "place_of_birth"
    t.string "birth_state"
    t.string "birth_country"
    t.text "residential_address"
    t.boolean "is_family_member", default: false
    t.boolean "is_potential_director", default: false
    t.bigint "company_group_id"
    t.integer "xero_invoice_count", default: 0
    t.boolean "xero_disconnect", default: false
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
  end

  create_table "corporate_companies", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.string "onedrive_folder_id"
    t.string "onedrive_folder_path"
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
  end

  create_table "corporate_company_activities", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "user_id"
    t.string "activity_type", null: false
    t.text "description"
    t.jsonb "change_details", default: {}
    t.string "related_type"
    t.bigint "related_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "corporate_company_compliance_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "corporate_company_directors", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.string "position"
    t.date "appointment_date"
    t.date "resignation_date"
    t.boolean "is_current", default: true
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "corporate_company_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id"
    t.string "title", null: false
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
    t.string "onedrive_file_id"
    t.string "onedrive_download_url"
    t.datetime "last_modified_at"
    t.string "expected_onedrive_path"
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
    t.string "display_title"
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
  end

  create_table "corporate_company_loans", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "corporate_company_minutes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "corporate_company_settings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "corporate_company_shareholdings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "corporate_company_xero_accounts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "corporate_company_xero_connections", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "xero_tenant_id", null: false
    t.string "xero_tenant_name"
    t.datetime "last_sync_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "connection_status", default: "disconnected"
    t.text "last_sync_error"
    t.bigint "xero_credential_id"
    t.string "accounting_method"
    t.date "financial_year_end"
  end

  create_table "corporate_groups", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.string "default_registered_office"
    t.string "default_principal_place"
    t.string "default_accountant"
    t.string "default_accountant_contact"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "data_quality_issues", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "designs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.decimal "size", precision: 10, scale: 2
    t.decimal "frontage_required", precision: 10, scale: 2
    t.string "floor_plan_url"
    t.text "description"
    t.boolean "is_active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "director_onboarding_requests", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "dividend_payments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "dividends", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "document_activities", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_document_id", null: false
    t.bigint "user_id"
    t.string "action", null: false
    t.jsonb "old_values", default: {}
    t.jsonb "new_values", default: {}
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "document_duplicate_reviews", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "document_folders", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.integer "order_position", default: 0, null: false
    t.jsonb "entity_types", default: [], null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "sharepoint_path"
    t.integer "parent_id"
  end

  create_table "document_tasks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "document_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "document_type_folders", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "document_type_id", null: false
    t.bigint "document_folder_id", null: false
    t.boolean "is_primary", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "document_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "document_verification_feedbacks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "documentation_categories", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "e_signature_certificates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "e_signature_events", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "e_signature_requests", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "e_signature_signers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "email_attachments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_warehouse_id", null: false
    t.string "outlook_attachment_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "attachment_id"
    t.string "filename"
    t.string "sharepoint_path"
    t.string "content_hash"
  end

  create_table "email_blacklist_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "pattern", null: false
    t.string "pattern_type", null: false
    t.text "description"
    t.boolean "active", default: true, null: false
    t.integer "match_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_case_proposals", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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

  create_table "email_job_proposals", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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

  create_table "email_recipients", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_warehouse_id", null: false
    t.bigint "user_id"
    t.bigint "contact_id"
    t.string "email_address", null: false
    t.string "recipient_type", null: false
    t.boolean "is_internal", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_sync_statuses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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

  create_table "email_warehouse", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "emails", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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

  create_table "estimate_line_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "estimate_id", null: false
    t.string "category"
    t.string "item_description", null: false
    t.decimal "quantity", precision: 15, scale: 3, default: "1.0"
    t.string "unit", default: "ea"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "estimate_reviews", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "estimates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "external_integrations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "api_key_digest", null: false
    t.boolean "is_active", default: true
    t.datetime "last_used_at"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "external_invoices", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "fact_job_daily_snapshots", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "feature_chapters", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.integer "chapter_number", null: false
    t.string "name", null: false
    t.text "description"
    t.integer "sort_order", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "feature_trackers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "financial_transactions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "folder_template_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "folder_template_id", null: false
    t.string "name", null: false
    t.integer "level", default: 0, null: false
    t.integer "order", default: 0, null: false
    t.bigint "parent_id"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "folder_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "template_type"
    t.boolean "is_system_default", default: false, null: false
    t.boolean "is_active", default: true, null: false
    t.bigint "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "foundation_views", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "foundations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "gold_standard_table", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "grok_plans", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "title"
    t.text "description"
    t.jsonb "conversation", default: []
    t.string "status", default: "planning"
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "health_check_caches", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.integer "foundation_id"
    t.string "check_type"
    t.jsonb "results"
    t.datetime "last_run_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "health_kudos_events", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "implementation_patterns", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "import_sessions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "inspiring_quotes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.text "quote", null: false
    t.string "author"
    t.string "category"
    t.boolean "is_active", default: true, null: false
    t.integer "display_order", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "aussie_slang"
  end

  create_table "insurance_policies", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "intercompany_balances", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "job_activities", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "job_claims", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "job_contacts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.bigint "contact_id"
    t.boolean "primary", default: false, null: false
    t.string "role"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
  end

  create_table "job_documentation_tabs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "job_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.bigint "document_type_id"
    t.string "onedrive_item_id", null: false
    t.string "onedrive_drive_id"
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
  end

  create_table "job_people", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.bigint "contact_id", null: false
    t.string "role"
    t.text "notes"
    t.boolean "is_primary", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "job_stages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.string "color"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "job_status_id"
  end

  create_table "job_status", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.string "color"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "job_status_stages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_type_id", null: false
    t.bigint "job_status_id", null: false
    t.bigint "job_stage_id", null: false
    t.integer "position", default: 0
    t.boolean "is_required", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "job_type_statuses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_type_id", null: false
    t.bigint "job_status_id", null: false
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "job_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "icon"
  end

  create_table "jobs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.string "onedrive_folder_creation_status", default: "not_requested"
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
  end

  create_table "known_parties", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "kudos_events", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "leads", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "maintenance_requests", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "meeting_agenda_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "meeting_participants", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "meeting_id", null: false
    t.bigint "user_id"
    t.bigint "contact_id"
    t.string "response_status", default: "pending"
    t.boolean "is_organizer", default: false
    t.boolean "is_required", default: true
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.check_constraint "user_id IS NOT NULL AND contact_id IS NULL OR user_id IS NULL AND contact_id IS NOT NULL", name: "meeting_participants_must_have_user_or_contact"
  end

  create_table "meeting_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "meetings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "minute_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "template_type"
    t.text "body"
    t.jsonb "required_fields", default: []
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "mv_refresh_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "notifications", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "notification_type", null: false
    t.string "notifiable_type"
    t.bigint "notifiable_id"
    t.string "title", null: false
    t.text "message"
    t.boolean "read", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "one_drive_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "organization_microsoft_app_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "organization_one_drive_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "organization_outlook_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "expires_at"
    t.string "email"
    t.string "tenant_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
  end

  create_table "pay_now_requests", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "pay_now_weekly_limits", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "payments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "people_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "permissions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.boolean "enabled", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "portal_access_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "portal_user_id", null: false
    t.string "action"
    t.string "ip_address"
    t.string "user_agent"
    t.jsonb "metadata"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "portal_users", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "price_histories", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "pricebook", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "pricebook_categories", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "display_name"
    t.string "color", default: "#6B7280"
    t.string "icon"
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "profit_loss_reports", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "project_task_checklist_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "project_tasks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "projects", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "public_holidays", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name"
    t.date "date"
    t.string "region"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "purchase_order_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "purchase_order_id", null: false
    t.bigint "document_task_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "purchase_order_line_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "purchase_orders", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "quote_request_contacts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "quote_request_id", null: false
    t.bigint "contact_id", null: false
    t.datetime "notified_at"
    t.string "notification_method"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "quote_requests", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "quote_responses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "rain_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "reconciliation_reports", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "role_permissions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "role", null: false
    t.bigint "permission_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "roles", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "display_name", null: false
    t.text "description"
    t.boolean "active", default: true, null: false
    t.integer "position", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "schedule_task_checklist_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "schedule_tasks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "schedule_template_row_audits", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "schedule_template_row_id", null: false
    t.bigint "user_id", null: false
    t.string "field_name", null: false
    t.boolean "old_value"
    t.boolean "new_value"
    t.datetime "changed_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "schedule_template_rows", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "schedule_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "is_default", default: false, null: false
    t.bigint "created_by_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "share_transfers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "sm_dependencies", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.check_constraint "predecessor_task_id <> successor_task_id", name: "no_self_dependency"
  end

  create_table "sm_hold_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "sm_hold_reasons", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", limit: 100, null: false
    t.text "description"
    t.string "color", limit: 20, default: "#EF4444"
    t.string "icon", limit: 50, default: "pause"
    t.integer "sequence_order", default: 0, null: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_resource_allocations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "task_id", null: false
    t.bigint "resource_id", null: false
    t.decimal "allocated_hours", precision: 10, scale: 2
    t.decimal "allocated_quantity", precision: 10, scale: 2
    t.date "allocation_date"
    t.string "status", limit: 20, default: "planned"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_resources", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "sm_rollover_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "sm_settings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.time "rollover_time", default: "2000-01-01 00:00:00", null: false
    t.string "rollover_timezone", limit: 50, default: "Australia/Brisbane", null: false
    t.boolean "rollover_enabled", default: true
    t.boolean "notify_on_hold", default: true
    t.boolean "notify_on_supplier_confirm", default: true
    t.boolean "notify_on_rollover", default: true
    t.bigint "default_template_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_spawn_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "parent_task_id", null: false
    t.bigint "spawned_task_id", null: false
    t.string "spawn_type", limit: 50, null: false
    t.string "spawn_trigger", limit: 50, null: false
    t.datetime "spawned_at", precision: nil, default: -> { "now()" }, null: false
    t.bigint "spawned_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_template_rows", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "sm_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "is_default", default: false
    t.boolean "is_active", default: true
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_time_entries", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "sm_working_drawing_pages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "task_id", null: false
    t.integer "page_number", null: false
    t.text "image_url", null: false
    t.string "category", limit: 100, null: false
    t.decimal "ai_confidence", precision: 5, scale: 4
    t.boolean "category_overridden", default: false
    t.string "manual_category", limit: 100
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sms_messages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "solid_cache_entries", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.binary "key", null: false
    t.binary "value", null: false
    t.datetime "created_at", null: false
    t.bigint "key_hash", null: false
    t.integer "byte_size", null: false
  end

  create_table "solid_queue_blocked_executions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.string "concurrency_key", null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
  end

  create_table "solid_queue_claimed_executions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.datetime "created_at", null: false
  end

  create_table "solid_queue_failed_executions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.text "error"
    t.datetime "created_at", null: false
  end

  create_table "solid_queue_jobs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "solid_queue_pauses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "queue_name", null: false
    t.datetime "created_at", null: false
  end

  create_table "solid_queue_processes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.bigint "supervisor_id"
    t.integer "pid", null: false
    t.string "hostname"
    t.text "metadata"
    t.datetime "created_at", null: false
    t.string "name", null: false
  end

  create_table "solid_queue_ready_executions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.datetime "created_at", null: false
  end

  create_table "solid_queue_recurring_executions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.string "task_key", null: false
    t.datetime "run_at", null: false
    t.datetime "created_at", null: false
  end

  create_table "solid_queue_recurring_tasks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "solid_queue_scheduled_executions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.string "queue_name", null: false
    t.integer "priority", default: 0, null: false
    t.datetime "scheduled_at", null: false
    t.datetime "created_at", null: false
  end

  create_table "solid_queue_semaphores", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "key", null: false
    t.integer "value", default: 1, null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "subcontractor_accounts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "subcontractor_invoices", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "suburbs", force: :cascade do |t|
    t.string "name", null: false
    t.string "postcode", null: false
    t.string "state", null: false
    t.string "council"
    t.integer "position"
    t.boolean "is_active", default: true
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.datetime "updated_at", default: -> { "now()" }, null: false
    t.index ["council"], name: "idx_suburbs_council"
    t.index ["name", "state"], name: "idx_suburbs_name_state", unique: true
    t.index ["name"], name: "idx_suburbs_name"
    t.index ["postcode"], name: "idx_suburbs_postcode"
    t.index ["state"], name: "idx_suburbs_state"
  end

  create_table "supervisor_checklist_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.integer "sequence_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "response_type", default: "checkbox"
  end

  create_table "sync_configurations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "system_settings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "setting_key", null: false
    t.text "setting_value"
    t.string "setting_type", default: "string"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "table_health_checks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "table_protections", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "table_name", null: false
    t.boolean "is_protected", default: true, null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "tables", force: :cascade do |t|
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
    t.index ["database_table_name"], name: "index_tables_on_database_table_name", unique: true
  end

  create_table "task_dependencies", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "successor_task_id", null: false
    t.bigint "predecessor_task_id", null: false
    t.string "dependency_type", default: "finish_to_start"
    t.integer "lag_days", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.check_constraint "successor_task_id <> predecessor_task_id", name: "check_no_self_dependency"
  end

  create_table "task_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "task_updates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "tasks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "trinity", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "unreal_variables", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "variable_name", null: false
    t.decimal "claude_value", precision: 10, scale: 2, default: "0.0"
    t.boolean "is_active", default: true
    t.text "variable_rule"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_groups", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name"
    t.string "label"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_microsoft_tokens", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "user_outlook_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "email"
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "expires_at", precision: nil
    t.string "tenant_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_permissions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "permission_id", null: false
    t.boolean "granted", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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
  end

  create_table "versions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.integer "current_version", default: 101, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "warehouse_bank_transactions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "warehouse_contacts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_action_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_incidents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_induction_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_inductions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_inspection_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_inspection_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_inspections", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_settings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "setting_key", null: false
    t.text "setting_value"
    t.string "setting_type", default: "string"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "whs_swms", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_swms_acknowledgments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_swms_controls", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "whs_swms_hazards", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "xero_accounts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "xero_alerts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "xero_chart_of_accounts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_group_id"
    t.string "account_code", null: false
    t.string "account_name", null: false
    t.string "account_type"
    t.string "tax_type"
    t.text "description"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "xero_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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

  create_table "xero_sync_events", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "xero_sync_statuses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "sync_type", null: false
    t.string "tenant_id"
    t.datetime "last_synced_at"
    t.datetime "next_sync_at"
    t.string "status"
    t.integer "records_synced"
    t.text "last_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "xero_tax_rates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "code"
    t.string "name"
    t.decimal "rate"
    t.boolean "active"
    t.string "display_rate"
    t.string "tax_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  add_foreign_key "contact_quality_reviews", "contacts"
  add_foreign_key "contact_quality_reviews", "contacts", column: "suggested_company_id"
  add_foreign_key "contact_quality_reviews", "users", column: "reviewed_by_id"
  add_foreign_key "xero_duplicate_items", "contacts"
  add_foreign_key "xero_duplicate_items", "xero_duplicate_groups", column: "duplicate_group_id"
end

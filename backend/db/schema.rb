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

ActiveRecord::Schema[8.0].define(version: 2026_02_26_000000) do
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

  create_table "ai_processing_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "ai_service_configs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "service_type", null: false
    t.string "display_name", null: false
    t.boolean "ocr_enabled", default: true
    t.integer "ai_threshold", default: 80
    t.string "ai_model", default: "sonnet"
    t.boolean "ai_always", default: false
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "ai_timesheet_suggestions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "worker_profile_id", null: false
    t.bigint "job_id", null: false
    t.date "suggestion_date", null: false
    t.datetime "suggested_start_time"
    t.datetime "suggested_end_time"
    t.decimal "suggested_hours", precision: 5, scale: 2
    t.decimal "suggested_break_minutes", precision: 5, default: "0"
    t.jsonb "photo_evidence", default: []
    t.jsonb "gps_evidence", default: []
    t.jsonb "calendar_evidence", default: []
    t.decimal "confidence_score", precision: 5, scale: 2
    t.text "reasoning"
    t.string "model_version", limit: 50
    t.string "detected_work_type", limit: 50
    t.integer "detected_progress_percent"
    t.string "status", limit: 20, default: "pending"
    t.bigint "actioned_by_id"
    t.datetime "actioned_at"
    t.text "user_notes"
    t.bigint "labour_cost_entry_id"
    t.datetime "expires_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "app_versions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.integer "current_version", default: 101, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "asset_depreciation_profiles", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "asset_id", null: false
    t.decimal "depreciable_cost", precision: 14, scale: 2, null: false
    t.decimal "residual_value", precision: 14, scale: 2, default: "0.0"
    t.string "book_method", default: "straight_line", null: false
    t.string "tax_method", default: "diminishing_value", null: false
    t.decimal "effective_life_years", precision: 5, scale: 2
    t.decimal "book_rate", precision: 8, scale: 4
    t.decimal "tax_rate", precision: 8, scale: 4
    t.date "depreciation_start_date", null: false
    t.boolean "in_low_value_pool", default: false
    t.date "pool_entry_date"
    t.boolean "is_division_43", default: false
    t.decimal "division_43_rate", precision: 5, scale: 2
    t.boolean "instant_writeoff_applied", default: false
    t.date "instant_writeoff_date"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "asset_depreciation_schedules", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "asset_id", null: false
    t.string "financial_year", null: false
    t.date "period_start", null: false
    t.date "period_end", null: false
    t.integer "days_held", null: false
    t.integer "days_in_year", default: 365, null: false
    t.decimal "book_opening_wdv", precision: 14, scale: 2
    t.decimal "book_depreciation", precision: 14, scale: 2
    t.decimal "book_closing_wdv", precision: 14, scale: 2
    t.decimal "book_accumulated", precision: 14, scale: 2
    t.decimal "tax_opening_wdv", precision: 14, scale: 2
    t.decimal "tax_depreciation", precision: 14, scale: 2
    t.decimal "tax_closing_wdv", precision: 14, scale: 2
    t.decimal "tax_accumulated", precision: 14, scale: 2
    t.string "book_method_applied"
    t.string "tax_method_applied"
    t.string "status", default: "draft"
    t.datetime "finalized_at"
    t.bigint "finalized_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "asset_disposals", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "asset_id", null: false
    t.bigint "user_id", null: false
    t.date "disposal_date", null: false
    t.date "settlement_date"
    t.string "disposal_type", null: false
    t.decimal "sale_proceeds", precision: 14, scale: 2, default: "0.0"
    t.decimal "disposal_costs", precision: 14, scale: 2, default: "0.0"
    t.decimal "net_proceeds", precision: 14, scale: 2
    t.decimal "book_wdv_at_disposal", precision: 14, scale: 2, null: false
    t.decimal "tax_wdv_at_disposal", precision: 14, scale: 2, null: false
    t.decimal "book_gain_loss", precision: 14, scale: 2, null: false
    t.decimal "tax_gain_loss", precision: 14, scale: 2, null: false
    t.decimal "balancing_adjustment", precision: 14, scale: 2
    t.bigint "replacement_asset_id"
    t.decimal "trade_in_value", precision: 14, scale: 2
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "asset_expenses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "asset_id", null: false
    t.bigint "user_id"
    t.bigint "financial_transaction_id"
    t.date "expense_date", null: false
    t.string "expense_type", null: false
    t.decimal "amount", precision: 12, scale: 2, null: false
    t.string "description"
    t.string "vendor"
    t.string "reference"
    t.string "xero_invoice_id"
    t.datetime "synced_to_xero_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "storage_blob_id"
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

  create_table "asset_odometer_readings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "asset_id", null: false
    t.bigint "user_id"
    t.date "reading_date", null: false
    t.integer "odometer_km"
    t.integer "hours"
    t.string "reading_type", default: "manual"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "storage_blob_id"
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
    t.bigint "invoice_blob_id"
    t.bigint "document_blob_id"
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
    t.string "asset_number"
    t.string "serial_number"
    t.string "registration_number"
    t.string "location"
    t.bigint "assigned_user_id"
    t.integer "odometer_reading"
    t.integer "hours_reading"
    t.date "last_reading_date"
    t.string "address"
    t.decimal "land_area_sqm", precision: 12, scale: 2
    t.decimal "building_area_sqm", precision: 12, scale: 2
    t.date "construction_date"
    t.jsonb "metadata", default: {}
    t.bigint "tenant_id"
    t.jsonb "photo_blob_ids", default: [], null: false
  end

  create_table "assistant_actions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "assistant_conversation_id"
    t.string "action_type", limit: 50, null: false
    t.string "status", limit: 20, default: "pending", null: false
    t.text "description"
    t.jsonb "action_data", default: {}
    t.jsonb "result_data", default: {}
    t.string "source_type"
    t.bigint "source_id"
    t.datetime "approved_at"
    t.datetime "executed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "assistant_alerts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "tenant_id", null: false
    t.string "alert_type", limit: 50, null: false
    t.string "priority", limit: 20, default: "medium", null: false
    t.string "status", limit: 20, default: "pending", null: false
    t.string "title", limit: 255, null: false
    t.text "summary"
    t.jsonb "context_data", default: {}
    t.string "source_type"
    t.bigint "source_id"
    t.bigint "assistant_action_id"
    t.datetime "seen_at"
    t.datetime "actioned_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "suggested_action_data"
  end

  create_table "assistant_conversations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "tenant_id", null: false
    t.string "title", limit: 255
    t.string "channel", limit: 50, default: "web", null: false
    t.string "status", limit: 20, default: "active", null: false
    t.jsonb "metadata", default: {}
    t.datetime "last_message_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "assistant_messages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "assistant_conversation_id", null: false
    t.string "role", limit: 20, null: false
    t.text "content"
    t.string "content_type", limit: 30, default: "text"
    t.jsonb "tool_calls", default: []
    t.jsonb "tool_results", default: []
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "ato_effective_life_categories", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "code", null: false
    t.string "name", null: false
    t.string "parent_code"
    t.text "description"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "ato_effective_life_rates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "ato_effective_life_category_id", null: false
    t.string "description", null: false
    t.decimal "effective_life_years", precision: 5, scale: 2, null: false
    t.decimal "straight_line_rate", precision: 8, scale: 4
    t.decimal "diminishing_value_rate", precision: 8, scale: 4
    t.date "effective_from", null: false
    t.date "effective_until"
    t.boolean "is_division_43", default: false
    t.decimal "division_43_rate", precision: 5, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "attachments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "storage_file_id", null: false
    t.string "storage_path", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.bigint "file_size"
    t.string "content_hash", null: false
    t.bigint "organization_microsoft_app_credential_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "storage_item_id"
  end

  create_table "background_job_progress", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "job_type", null: false
    t.string "job_id", null: false
    t.string "scope"
    t.string "status", default: "pending"
    t.integer "total_items", default: 0
    t.integer "processed_items", default: 0
    t.integer "success_count", default: 0
    t.integer "error_count", default: 0
    t.string "current_item"
    t.text "message"
    t.jsonb "error_details", default: []
    t.jsonb "metadata", default: {}
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "backup_configurations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.boolean "enabled", default: false, null: false
    t.string "database_schedule", default: "weekly_sunday", null: false
    t.string "document_schedule", default: "daily_2am", null: false
    t.integer "retention_days", default: 90, null: false
    t.boolean "mirror_enabled", default: false, null: false
    t.bigint "primary_credential_id"
    t.bigint "secondary_credential_id"
    t.datetime "last_database_backup_at"
    t.datetime "last_document_backup_at"
    t.datetime "last_mirror_sync_at"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
    t.integer "retention_count", default: 5, null: false
    t.string "mirror_schedule", default: "daily_2am", null: false
  end

  create_table "backup_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "backup_configuration_id", null: false
    t.string "backup_type", null: false
    t.string "status", null: false
    t.bigint "size_bytes"
    t.integer "duration_seconds"
    t.integer "files_count"
    t.string "storage_key"
    t.string "provider_name"
    t.text "error_message"
    t.jsonb "metadata", default: {}
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
    t.string "period"
    t.date "period_end_date"
    t.bigint "document_type_id"
    t.string "display_name"
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
    t.bigint "tenant_id", null: false
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
    t.bigint "company_id"
    t.bigint "document_type_id"
    t.string "display_name"
  end

  create_table "bank_statement_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.bigint "tenant_id", null: false
  end

  create_table "basiq_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "owner_type", null: false
    t.bigint "owner_id", null: false
    t.string "basiq_user_id", null: false
    t.string "status", default: "pending", null: false
    t.string "connected_institution_name"
    t.string "connected_institution_id"
    t.datetime "last_sync_at"
    t.datetime "consent_expires_at"
    t.string "last_error"
    t.datetime "last_error_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "batch_operations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "bill_inboxes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "source", default: "email", null: false
    t.string "email_message_id"
    t.bigint "email_warehouse_id"
    t.bigint "company_id"
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
    t.string "storage_file_id"
    t.integer "match_confidence"
    t.string "match_source", limit: 30
    t.string "storage_item_id"
    t.bigint "storage_blob_id"
    t.bigint "tenant_id", null: false
  end

  create_table "bill_payment_batches", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
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
    t.bigint "created_by_id"
    t.bigint "approved_by_id"
    t.datetime "approved_at"
    t.bigint "bpmn_process_instance_id"
    t.datetime "submitted_to_bank_at"
    t.datetime "completed_at"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
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
    t.string "xero_payment_id"
    t.datetime "synced_to_xero_at"
    t.string "sync_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
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
    t.text "svg_preview"
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
    t.bigint "id", null: false
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
    t.bigint "id", null: false
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
    t.string "storage_folder_id"
    t.string "storage_folder_path"
    t.bigint "tenant_id"
  end

  create_table "chat_conversation_participants", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "chat_conversation_id", null: false
    t.bigint "user_id", null: false
    t.datetime "last_read_at"
    t.boolean "is_admin", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "chat_conversations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "conversation_type", default: "group", null: false
    t.string "name"
    t.bigint "created_by_id", null: false
    t.bigint "tenant_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "chat_guest_sessions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "host_user_id", null: false
    t.string "token", null: false
    t.string "guest_name"
    t.string "guest_email"
    t.string "status", default: "pending", null: false
    t.datetime "expires_at"
    t.datetime "guest_joined_at"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "job_id"
  end

  create_table "chat_messages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id"
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
    t.string "storage_file_id"
    t.string "storage_item_id"
    t.bigint "storage_blob_id"
    t.bigint "chat_conversation_id"
    t.bigint "tenant_id"
    t.bigint "chat_guest_session_id"
    t.string "guest_sender_name"
  end

  create_table "claim_invoice_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "description"
    t.string "style_key", null: false
    t.boolean "is_default", default: false
    t.boolean "is_active", default: true
    t.string "primary_color", default: "#1e40af"
    t.string "secondary_color", default: "#64748b"
    t.string "font_family", default: "Inter"
    t.boolean "show_logo", default: true
    t.boolean "show_company_details", default: true
    t.boolean "show_bank_details", default: true
    t.boolean "show_payment_terms", default: true
    t.string "logo_position", default: "left"
    t.string "header_style", default: "standard"
    t.text "header_text"
    t.text "footer_text"
    t.text "payment_instructions"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "claim_stage_template_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "claim_stage_template_id", null: false
    t.string "name", limit: 100, null: false
    t.decimal "percentage", precision: 5, scale: 2, null: false
    t.integer "sequence_order", default: 0, null: false
    t.string "description"
    t.decimal "retainage_percentage", precision: 5, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "match_keywords"
  end

  create_table "claim_stage_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.string "name", limit: 100, null: false
    t.text "description"
    t.boolean "is_active", default: true, null: false
    t.integer "position", default: 0
    t.decimal "default_retainage_pct", precision: 5, scale: 2
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cloudflare_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "api_token", null: false
    t.string "account_id", null: false
    t.string "email"
    t.integer "status", default: 0, null: false
    t.boolean "is_active", default: true, null: false
    t.datetime "last_connected_at"
    t.datetime "last_error_at"
    t.string "error_message"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
  end

  create_table "colour_selection_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.bigint "job_type_id"
    t.jsonb "categories", default: []
    t.boolean "is_default", default: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
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
    t.string "display_formatter", default: "text"
    t.string "display_format"
    t.string "link_template"
    t.string "input_mask"
    t.string "validation_message"
    t.string "locale", default: "en-AU"
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
    t.integer "type_version_applied", default: 0
    t.datetime "last_compliance_check"
    t.string "lookup_foundation_slug"
    t.jsonb "choice_descriptions", default: {}
    t.jsonb "lookup_filter", default: {}
  end

  create_table "company_approval_rules", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
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
    t.bigint "escalation_to_user_id"
    t.bigint "bpmn_process_id"
    t.jsonb "config", default: {}
    t.integer "priority", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "company_groups", id: false, force: :cascade do |t|
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
    t.string "code"
    t.string "slug"
    t.integer "tier", default: 0
    t.integer "environment", default: 0
    t.boolean "is_master_tenant", default: false
    t.string "website"
    t.string "logo_url"
    t.string "primary_color"
    t.string "secondary_color"
    t.bigint "tenant_id"
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

  create_table "contact_company_group_memberships", id: false, force: :cascade do |t|
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
    t.bigint "tenant_id"
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
    t.string "xero_org_id", null: false
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
    t.string "external_name"
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

  create_table "contact_quality_reviews", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.integer "role_ids", default: [], array: true
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
    t.bigint "tenant_id"
    t.string "sync_key"
  end

  create_table "contacts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "abn"
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
    t.integer "default_purchase_account"
    t.integer "bill_due_day"
    t.string "bill_due_type"
    t.string "xero_contact_number"
    t.string "xero_account_number"
    t.integer "default_sales_account"
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
    t.boolean "tpar_required", default: false
    t.string "tpar_industry_code", limit: 10
    t.integer "team_size"
    t.decimal "daily_rate_per_person", precision: 10, scale: 2, default: "800.0"
    t.tsvector "searchable"
    t.boolean "is_saas_customer", default: false
    t.decimal "annual_turnover", precision: 15, scale: 2
    t.string "saas_status", default: "active"
    t.date "saas_started_at"
    t.date "saas_churned_at"
    t.bigint "support_contact_id"
    t.bigint "upline_contact_id"
    t.string "referrer_status", default: "pending"
    t.datetime "referrer_training_completed_at"
    t.datetime "referrer_training_expires_at"
    t.datetime "l1_eligible_at"
    t.datetime "l2_eligible_at"
    t.decimal "total_network_fees", precision: 12, scale: 2, default: "0.0"
    t.decimal "total_commissions_earned", precision: 12, scale: 2, default: "0.0"
    t.decimal "total_commissions_paid", precision: 12, scale: 2, default: "0.0"
    t.string "direct_line"
    t.boolean "is_customer_cached", default: false, null: false
    t.boolean "is_supplier_cached", default: false, null: false
    t.boolean "is_director_cached", default: false, null: false
    t.string "stripe_customer_id"
    t.string "contact_code", null: false
    t.bigint "tenant_id"
    t.boolean "is_user_cached", default: false, null: false
    t.boolean "is_corporate_managed", default: false, null: false
    t.bigint "parent_company_contact_id"
    t.string "sync_key"
    t.date "date_of_birth"
    t.string "emergency_contact_name"
    t.string "emergency_contact_phone"
    t.string "emergency_contact_relationship"
  end

  create_table "corporate_activities", id: false, force: :cascade do |t|
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
    t.bigint "tenant_id"
  end

  create_table "corporate_compliance_items", id: false, force: :cascade do |t|
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
    t.bigint "tenant_id"
  end

  create_table "corporate_directors", id: false, force: :cascade do |t|
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
    t.bigint "tenant_id"
  end

  create_table "corporate_loans", id: false, force: :cascade do |t|
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
    t.bigint "tenant_id"
  end

  create_table "corporate_minutes", id: false, force: :cascade do |t|
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
    t.bigint "tenant_id"
  end

  create_table "corporate_monthly_pls", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "corporate_id", null: false
    t.date "month", null: false
    t.string "month_label"
    t.decimal "revenue", precision: 15, scale: 2, default: "0.0"
    t.decimal "expenses", precision: 15, scale: 2, default: "0.0"
    t.decimal "net_profit", precision: 15, scale: 2, default: "0.0"
    t.datetime "synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
  end

  create_table "corporate_shareholdings", id: false, force: :cascade do |t|
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
    t.bigint "tenant_id"
  end

  create_table "corporate_xero_accounts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "corporate_xero_connection_id", null: false
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
    t.string "consolidated_account_code"
    t.bigint "tenant_id"
  end

  create_table "corporate_xero_connections", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.date "xero_start_date"
    t.bigint "tenant_id"
  end

  create_table "corporates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
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
    t.string "code"
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
    t.bigint "tenant_id"
    t.string "trading_names", default: [], array: true
  end

  create_table "cost_centres", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "parent_id"
    t.string "code", limit: 20, null: false
    t.string "name", limit: 100, null: false
    t.text "description"
    t.string "centre_type", limit: 30
    t.decimal "overhead_allocation_percent", precision: 5, scale: 2, default: "0.0"
    t.decimal "budget_amount", precision: 14, scale: 2
    t.boolean "active", default: true
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "custom_pricings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "contact_id", null: false
    t.string "pricing_type", default: "default", null: false
    t.decimal "custom_percentage", precision: 5, scale: 2
    t.decimal "monthly_fee", precision: 10, scale: 2
    t.decimal "per_job_fee", precision: 10, scale: 2
    t.boolean "gst_included", default: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "custom_quote_allocations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "custom_quote_supplier_id", null: false
    t.bigint "custom_quote_line_id", null: false
    t.decimal "allocated_amount", precision: 12, scale: 2, null: false
    t.text "notes"
    t.bigint "purchase_order_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "custom_quote_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "custom_quote_id", null: false
    t.bigint "parent_id"
    t.bigint "cost_centre_id"
    t.bigint "sm_schedule_master_id"
    t.bigint "sm_task_id"
    t.string "name", null: false
    t.string "quote_level", default: "po", null: false
    t.integer "position", default: 0, null: false
    t.text "tender_description"
    t.text "po_description"
    t.text "rfq_instructions"
    t.decimal "budget_amount", precision: 12, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "document_type_ids", default: [], null: false, array: true
  end

  create_table "custom_quote_suppliers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "custom_quote_line_id", null: false
    t.bigint "supplier_id", null: false
    t.bigint "contact_person_id"
    t.string "contact_email"
    t.string "status", default: "draft", null: false
    t.decimal "price_quoted", precision: 12, scale: 2
    t.string "quote_number"
    t.date "date_sent"
    t.date "date_received"
    t.date "valid_to"
    t.text "response_notes"
    t.string "timeframe"
    t.boolean "is_best_price", default: false, null: false
    t.bigint "sent_by_id"
    t.datetime "sent_at"
    t.string "email_message_id"
    t.bigint "purchase_order_id"
    t.bigint "warehouse_document_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "custom_quote_template_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "custom_quote_template_id", null: false
    t.bigint "parent_id"
    t.bigint "cost_centre_id"
    t.bigint "sm_schedule_master_id"
    t.string "name", null: false
    t.string "quote_level", default: "po", null: false
    t.integer "position", default: 0, null: false
    t.text "tender_description"
    t.text "po_description"
    t.text "default_instructions"
    t.jsonb "default_supplier_ids", default: []
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "custom_quote_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "is_active", default: true, null: false
    t.integer "position", default: 0, null: false
    t.bigint "po_template_pack_id"
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "custom_quotes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "job_id", null: false
    t.bigint "custom_quote_template_id"
    t.string "name", null: false
    t.string "status", default: "draft", null: false
    t.decimal "total_quoted", precision: 12, scale: 2, default: "0.0"
    t.decimal "total_allocated", precision: 12, scale: 2, default: "0.0"
    t.bigint "created_by_id"
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

  create_table "desktop_clients", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "device_id", null: false
    t.string "device_name", null: false
    t.string "platform"
    t.string "app_version"
    t.text "refresh_token"
    t.datetime "token_expires_at"
    t.string "device_code"
    t.datetime "device_code_expires_at"
    t.boolean "is_active", default: true
    t.datetime "last_seen_at"
    t.datetime "last_sync_at"
    t.string "last_sync_status"
    t.jsonb "sync_settings", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
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

  create_table "document_inboxes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "storage_blob_id"
    t.bigint "warehouse_document_id"
    t.bigint "synced_email_id"
    t.bigint "uploaded_by_id"
    t.string "source", default: "upload", null: false
    t.string "status", default: "pending", null: false
    t.string "document_type"
    t.decimal "classification_confidence", precision: 5, scale: 4
    t.jsonb "classification_result", default: {}
    t.string "original_filename"
    t.string "content_type"
    t.integer "file_size"
    t.string "from_email"
    t.string "subject"
    t.string "routed_to_type"
    t.bigint "routed_to_id"
    t.datetime "routed_at"
    t.boolean "user_override", default: false
    t.bigint "overridden_by_id"
    t.datetime "overridden_at"
    t.jsonb "metadata", default: {}
    t.text "error_message"
    t.datetime "processed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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
    t.string "storage_url"
    t.bigint "storage_blob_id"
  end

  create_table "document_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name"
    t.text "description"
    t.string "category"
    t.string "storage_site_id"
    t.string "storage_drive_id"
    t.string "storage_item_id"
    t.string "storage_path"
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
    t.bigint "tenant_id"
    t.string "sync_key"
  end

  create_table "document_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "folder"
    t.text "description"
    t.boolean "requires_filing", default: false
    t.integer "retention_years"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "download_name"
    t.string "abbreviation"
    t.jsonb "aliases", default: []
    t.string "ui_name"
    t.string "scope", default: "company"
    t.string "file_extensions", default: [], array: true
    t.string "target_folder"
    t.boolean "skip_rename", default: false, null: false
    t.boolean "supports_versioning", default: false, null: false
    t.jsonb "form_number_mapping", default: {}
    t.boolean "generates_certificate", default: false
    t.string "certificate_template"
    t.jsonb "filename_patterns", default: []
    t.jsonb "signature_field_config", default: []
    t.bigint "tenant_id"
    t.bigint "warehouse_type_id"
    t.string "sync_key"
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

  create_table "e_signature_fields", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.string "original_storage_file_id"
    t.string "signed_storage_file_id"
    t.string "storage_site_id"
    t.string "storage_drive_id"
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
    t.string "original_storage_item_id"
    t.string "signed_storage_item_id"
    t.bigint "document_type_id"
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
    t.bigint "contact_id"
    t.text "decline_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_aliases", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_subscription_id", null: false
    t.string "alias_address", null: false
    t.string "target_address", null: false
    t.string "alias_type", default: "alias"
    t.boolean "is_active", default: true
    t.datetime "provisioned_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_attachments", id: false, force: :cascade do |t|
    t.bigint "id", null: false
    t.bigint "email_warehouse_id", null: false
    t.string "outlook_attachment_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "attachment_id"
    t.string "filename"
    t.string "storage_path"
    t.string "content_hash"
    t.bigint "storage_blob_id"
    t.string "content_id"
  end

  create_table "email_blacklist_items", id: false, force: :cascade do |t|
    t.bigint "id", null: false
    t.string "pattern", null: false
    t.string "pattern_type", null: false
    t.text "description"
    t.boolean "active", default: true, null: false
    t.integer "match_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_case_proposals", id: false, force: :cascade do |t|
    t.bigint "id", null: false
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

  create_table "email_dns_records", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_subscription_id", null: false
    t.string "record_type", null: false
    t.string "name", null: false
    t.text "content", null: false
    t.integer "priority"
    t.boolean "proxied", default: false
    t.string "cloudflare_record_id"
    t.string "cloudflare_zone_id"
    t.integer "status", default: 0, null: false
    t.string "error_message"
    t.datetime "last_verified_at"
    t.datetime "provisioned_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_drafts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "imap_credential_id"
    t.string "from_address"
    t.text "to_addresses"
    t.text "cc_addresses"
    t.text "bcc_addresses"
    t.string "subject", limit: 998, null: false
    t.text "body", null: false
    t.string "reply_to_message_id"
    t.jsonb "attachments", default: []
    t.string "status", default: "draft", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
    t.string "provider_draft_id"
    t.string "provider_type"
    t.bigint "microsoft_credential_id"
    t.datetime "provider_synced_at"
    t.string "provider_sync_error"
  end

  create_table "email_folder_preferences", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "account_id", null: false
    t.string "folder_id", null: false
    t.integer "position", default: 0, null: false
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

  create_table "email_label_assignments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_warehouse_id", null: false
    t.bigint "email_label_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_labels", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "name", null: false
    t.string "color", default: "#6B7280"
    t.boolean "is_system", default: false
    t.integer "position", default: 0
    t.integer "email_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_mailbox_favorites", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "account_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_mailboxes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_subscription_id", null: false
    t.bigint "contact_id"
    t.string "email_address", null: false
    t.string "display_name"
    t.string "mailbox_type", default: "user", null: false
    t.string "status", default: "pending", null: false
    t.integer "storage_quota_gb", default: 50
    t.decimal "storage_used_gb", precision: 10, scale: 2
    t.string "polaris_mailbox_id"
    t.datetime "provisioned_at"
    t.datetime "last_sync_at"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "source_email"
  end

  create_table "email_migration_invites", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_subscription_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "created_by_id"
    t.string "token", null: false
    t.string "status", default: "pending", null: false
    t.decimal "total_monthly", precision: 10, scale: 2
    t.jsonb "mailboxes_data", default: []
    t.datetime "expires_at"
    t.datetime "viewed_at"
    t.integer "view_count", default: 0
    t.datetime "payment_completed_at"
    t.datetime "migration_started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_migrations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_subscription_id", null: false
    t.bigint "email_mailbox_id"
    t.bigint "initiated_by_id"
    t.bigint "microsoft_credential_id"
    t.string "migration_type", null: false
    t.string "status", default: "pending", null: false
    t.string "source_email"
    t.string "source_tenant_id"
    t.integer "total_items", default: 0
    t.integer "processed_items", default: 0
    t.integer "failed_items", default: 0
    t.bigint "total_bytes", default: 0
    t.bigint "processed_bytes", default: 0
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "failed_at"
    t.text "error_message"
    t.jsonb "migration_log", default: {}
    t.jsonb "options", default: {}
    t.boolean "is_self_service", default: false
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

  create_table "email_rules", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "imap_credential_id"
    t.string "name", null: false
    t.integer "priority", default: 0
    t.boolean "is_active", default: true
    t.boolean "stop_processing", default: false
    t.jsonb "conditions", default: {}
    t.jsonb "actions", default: {}
    t.integer "emails_matched", default: 0
    t.datetime "last_matched_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "microsoft_credential_id"
    t.string "mailbox_email"
  end

  create_table "email_snoozes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_warehouse_id", null: false
    t.bigint "user_id", null: false
    t.datetime "snooze_until", null: false
    t.boolean "is_active", default: true
    t.string "reason"
    t.datetime "woken_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_subscription_invoices", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_subscription_id", null: false
    t.bigint "gl_invoice_id"
    t.date "billing_period_start", null: false
    t.date "billing_period_end", null: false
    t.decimal "retail_amount", precision: 10, scale: 2
    t.decimal "wholesale_amount", precision: 10, scale: 2
    t.string "stripe_invoice_id"
    t.string "status", default: "pending", null: false
    t.datetime "paid_at"
    t.string "failure_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_subscriptions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "contact_id", null: false
    t.string "polaris_account_id"
    t.string "domain", null: false
    t.string "status", default: "pending", null: false
    t.string "billing_interval", default: "monthly", null: false
    t.decimal "retail_price", precision: 10, scale: 2
    t.decimal "wholesale_cost", precision: 10, scale: 2
    t.string "stripe_subscription_id"
    t.string "stripe_customer_id"
    t.date "next_billing_date"
    t.date "current_period_start"
    t.date "current_period_end"
    t.integer "mailbox_count", default: 0
    t.integer "total_storage_gb", default: 0
    t.jsonb "metadata", default: {}
    t.datetime "started_at"
    t.datetime "cancelled_at"
    t.string "cancellation_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "dns_status", default: "pending"
    t.bigint "tenant_id"
  end

  create_table "email_sync_statuses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "status", default: "pending"
    t.datetime "last_sync_at"
    t.datetime "sync_started_at"
    t.integer "total_emails_synced", default: 0
    t.integer "emails_synced_this_run", default: 0
    t.text "last_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "email_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "name", null: false
    t.string "subject"
    t.text "body_html"
    t.text "body_text"
    t.jsonb "variables", default: []
    t.string "category"
    t.boolean "is_shared", default: false
    t.boolean "is_favorite", default: false
    t.integer "usage_count", default: 0
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "email_user_states", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "email_warehouse_id", null: false
    t.bigint "user_id", null: false
    t.boolean "is_pinned", default: false
    t.boolean "is_starred", default: false
    t.string "star_color"
    t.datetime "remind_at"
    t.boolean "reminder_sent", default: false
    t.boolean "is_read", default: false
    t.boolean "is_archived", default: false
    t.string "priority"
    t.text "notes"
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
    t.bigint "tenant_id"
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
    t.bigint "tenant_id", null: false
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
    t.boolean "sync_to_xero", default: false, null: false
    t.datetime "synced_to_xero_at"
    t.datetime "xero_updated_at"
    t.datetime "local_updated_at"
    t.boolean "sync_conflict", default: false, null: false
    t.string "payment_link_token"
    t.string "xero_org_id"
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

  create_table "feature_requests", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "title", null: false
    t.text "description"
    t.string "category", default: "feature", null: false
    t.string "status", default: "submitted", null: false
    t.integer "priority_order"
    t.bigint "submitted_by_user_id"
    t.bigint "submitted_by_tenant_id"
    t.string "submitted_by_name"
    t.string "submitted_by_company"
    t.text "admin_notes"
    t.text "status_update"
    t.integer "follower_count", default: 0, null: false
    t.jsonb "follower_user_ids", default: []
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
    t.string "storage_file_id"
    t.string "storage_item_id"
    t.bigint "storage_blob_id"
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
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "foundation_trading_names", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "abn"
    t.string "address"
    t.boolean "is_default", default: false
    t.boolean "is_active", default: true
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
    t.string "slug"
    t.integer "tenant_id", null: false
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
    t.jsonb "edit_modal_config", default: {}
  end

  create_table "geofence_events", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "site_presence_session_id", null: false
    t.bigint "worker_profile_id", null: false
    t.bigint "job_id", null: false
    t.string "event_type", limit: 20, null: false
    t.decimal "latitude", precision: 10, scale: 7
    t.decimal "longitude", precision: 10, scale: 7
    t.integer "distance_from_site"
    t.datetime "detected_at", null: false
    t.datetime "resolved_at"
    t.integer "duration_seconds"
    t.boolean "acknowledged", default: false
    t.bigint "acknowledged_by_id"
    t.datetime "acknowledged_at"
    t.text "acknowledgment_notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_account_balances", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "gl_account_id", null: false
    t.bigint "gl_period_id", null: false
    t.decimal "opening_balance", precision: 15, scale: 2, default: "0.0"
    t.decimal "period_debits", precision: 15, scale: 2, default: "0.0"
    t.decimal "period_credits", precision: 15, scale: 2, default: "0.0"
    t.decimal "closing_balance", precision: 15, scale: 2, default: "0.0"
    t.decimal "net_movement", precision: 15, scale: 2, default: "0.0"
    t.decimal "ytd_debits", precision: 15, scale: 2, default: "0.0"
    t.decimal "ytd_credits", precision: 15, scale: 2, default: "0.0"
    t.decimal "ytd_balance", precision: 15, scale: 2, default: "0.0"
    t.datetime "calculated_at"
    t.integer "transaction_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_accounts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "company_id", null: false
    t.string "external_provider"
    t.string "external_tenant_id"
    t.string "external_account_id"
    t.datetime "external_synced_at"
    t.string "code", default: "", null: false
    t.string "name", default: "", null: false
    t.string "description"
    t.string "account_type", default: "asset", null: false
    t.string "account_class"
    t.string "system_account"
    t.string "tax_type"
    t.boolean "is_bank_account", default: false
    t.boolean "is_system_account", default: false
    t.boolean "active", default: true
    t.boolean "show_in_expense_claims", default: false
    t.bigint "parent_account_id"
    t.integer "display_order"
    t.string "currency_code", default: "AUD"
  end

  create_table "gl_ai_categorization_attempts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "transaction_description", limit: 500, null: false
    t.decimal "transaction_amount", precision: 15, scale: 2
    t.bigint "suggested_account_id"
    t.decimal "confidence", precision: 4, scale: 3
    t.boolean "was_successful", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_ai_categorization_learnings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "transaction_description", limit: 500, null: false
    t.string "transaction_amount_type", limit: 10, null: false
    t.string "transaction_reference", limit: 255
    t.bigint "ai_suggested_account_id"
    t.decimal "ai_confidence", precision: 4, scale: 3
    t.bigint "user_chosen_account_id", null: false
    t.boolean "was_accepted", default: false, null: false
    t.datetime "feedback_date", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_ai_po_match_attempts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "bill_inbox_id"
    t.bigint "matched_po_id"
    t.boolean "successful", default: false
    t.integer "suggestions_count", default: 0
    t.integer "best_confidence"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_ai_po_match_learnings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "bill_inbox_id", null: false
    t.bigint "purchase_order_id", null: false
    t.bigint "user_id"
    t.boolean "was_accepted", null: false
    t.string "bill_supplier_name", limit: 255
    t.decimal "bill_amount", precision: 15, scale: 2
    t.string "po_supplier_name", limit: 255
    t.decimal "po_amount", precision: 15, scale: 2
    t.jsonb "match_data", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_anomalies", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "anomalable_type"
    t.bigint "anomalable_id"
    t.string "anomaly_type", null: false
    t.string "severity", default: "medium", null: false
    t.text "description", null: false
    t.float "anomaly_score"
    t.jsonb "details", default: {}
    t.jsonb "comparison_data", default: {}
    t.string "status", default: "open"
    t.bigint "assigned_to_id"
    t.bigint "resolved_by_id"
    t.datetime "resolved_at"
    t.text "resolution_notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_anomaly_reviews", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "transaction_type", limit: 50, null: false
    t.bigint "transaction_id", null: false
    t.string "status", limit: 30, default: "acknowledged", null: false
    t.integer "anomaly_score"
    t.text "notes"
    t.bigint "reviewed_by_id"
    t.datetime "reviewed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_anomaly_rules", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "name", null: false
    t.string "rule_type", null: false
    t.string "entity_type", null: false
    t.jsonb "conditions", null: false
    t.string "severity", default: "medium"
    t.boolean "active", default: true
    t.integer "trigger_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_approval_actions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "approval_request_id", null: false
    t.bigint "workflow_step_id"
    t.bigint "user_id"
    t.integer "step_number", null: false
    t.string "action", limit: 20, null: false
    t.text "comments"
    t.datetime "acted_at", null: false
    t.bigint "delegated_to_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_approval_requests", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "workflow_id"
    t.bigint "requested_by_id"
    t.string "approvable_type", null: false
    t.bigint "approvable_id", null: false
    t.decimal "amount", precision: 15, scale: 2
    t.text "notes"
    t.string "status", limit: 20, default: "pending", null: false
    t.integer "current_step", default: 1
    t.integer "total_steps"
    t.datetime "submitted_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_approval_workflow_steps", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "workflow_id", null: false
    t.integer "step_order", default: 1, null: false
    t.string "approval_type", limit: 20, default: "user", null: false
    t.bigint "approver_id"
    t.string "required_role", limit: 50
    t.text "approver_ids"
    t.boolean "required", default: true
    t.integer "timeout_hours"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_approval_workflows", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "created_by_id"
    t.string "name", null: false
    t.string "document_type", limit: 30, null: false
    t.text "description"
    t.decimal "min_amount", precision: 15, scale: 2
    t.decimal "max_amount", precision: 15, scale: 2
    t.string "category"
    t.boolean "active", default: true
    t.integer "priority", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_audit_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "user_id"
    t.string "auditable_type", null: false
    t.bigint "auditable_id", null: false
    t.string "action", limit: 20, null: false
    t.json "changes_made"
    t.json "previous_values"
    t.json "new_values"
    t.string "ip_address"
    t.string "user_agent"
    t.string "request_id"
    t.string "source", limit: 30
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_audit_snapshots", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "created_by_id"
    t.string "snapshot_type", limit: 30, null: false
    t.date "snapshot_date", null: false
    t.string "reference"
    t.integer "invoice_count", default: 0
    t.integer "payment_count", default: 0
    t.integer "journal_count", default: 0
    t.decimal "total_revenue", precision: 15, scale: 2
    t.decimal "total_expenses", precision: 15, scale: 2
    t.decimal "total_assets", precision: 15, scale: 2
    t.decimal "total_liabilities", precision: 15, scale: 2
    t.string "file_path"
    t.string "checksum"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_bank_reconciliations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "gl_account_id", null: false
    t.string "external_provider"
    t.string "external_tenant_id"
    t.date "statement_date", null: false
    t.date "period_start"
    t.date "period_end"
    t.decimal "statement_opening_balance", precision: 15, scale: 2
    t.decimal "statement_closing_balance", precision: 15, scale: 2, null: false
    t.decimal "gl_opening_balance", precision: 15, scale: 2
    t.decimal "gl_closing_balance", precision: 15, scale: 2
    t.decimal "reconciled_balance", precision: 15, scale: 2
    t.decimal "difference", precision: 15, scale: 2, default: "0.0"
    t.string "status", default: "in_progress"
    t.datetime "completed_at"
    t.bigint "completed_by_id"
    t.integer "matched_count", default: 0
    t.integer "unmatched_count", default: 0
    t.integer "adjustment_count", default: 0
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_bank_rule_learnings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "gl_account_id", null: false
    t.bigint "user_id"
    t.bigint "bank_line_id"
    t.string "transaction_description", null: false
    t.decimal "transaction_amount", precision: 15, scale: 2
    t.string "transaction_type", limit: 10
    t.string "payee_name"
    t.datetime "learned_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_bas_lodgements", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "period_code", limit: 10, null: false
    t.integer "period_year", null: false
    t.string "status", limit: 20, default: "pending", null: false
    t.boolean "is_amendment", default: false
    t.string "lodgement_reference", limit: 100
    t.datetime "lodged_at"
    t.text "error_message"
    t.jsonb "ato_response", default: {}
    t.jsonb "data", default: {}
    t.bigint "lodged_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_benchmarks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "industry_code", null: false
    t.string "industry_name", null: false
    t.string "kpi_code", null: false
    t.integer "year", null: false
    t.decimal "percentile_25", precision: 15, scale: 4
    t.decimal "percentile_50", precision: 15, scale: 4
    t.decimal "percentile_75", precision: 15, scale: 4
    t.decimal "percentile_90", precision: 15, scale: 4
    t.string "source"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_billable_expenses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "job_id", null: false
    t.bigint "contact_id"
    t.bigint "user_id"
    t.bigint "source_invoice_id"
    t.bigint "billed_invoice_id"
    t.date "expense_date", null: false
    t.string "expense_type", limit: 30, null: false
    t.string "description", null: false
    t.string "vendor_name"
    t.string "receipt_reference"
    t.decimal "cost_amount", precision: 15, scale: 2, null: false
    t.decimal "markup_percent", precision: 5, scale: 2, default: "0.0"
    t.decimal "markup_amount", precision: 15, scale: 2, default: "0.0"
    t.decimal "billable_amount", precision: 15, scale: 2
    t.string "status", limit: 20, default: "pending"
    t.boolean "billable", default: true
    t.boolean "reimbursable", default: false
    t.text "notes"
    t.string "document_file_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_billable_rates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "user_id"
    t.bigint "job_id"
    t.bigint "contact_id"
    t.string "rate_type", limit: 20, null: false
    t.string "role_name"
    t.decimal "hourly_rate", precision: 15, scale: 2, null: false
    t.decimal "overtime_rate", precision: 15, scale: 2
    t.decimal "weekend_rate", precision: 15, scale: 2
    t.date "effective_from"
    t.date "effective_to"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_billable_time_entries", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "time_entry_id", null: false
    t.bigint "job_id"
    t.bigint "user_id", null: false
    t.bigint "billable_rate_id"
    t.bigint "invoice_id"
    t.date "entry_date", null: false
    t.decimal "hours", precision: 8, scale: 2, null: false
    t.decimal "billable_hours", precision: 8, scale: 2
    t.decimal "hourly_rate", precision: 15, scale: 2, null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.string "description"
    t.string "task_type"
    t.string "status", limit: 20, default: "unbilled"
    t.datetime "approved_at"
    t.bigint "approved_by_id"
    t.text "notes"
    t.boolean "billable", default: true
    t.boolean "invoiced", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_billing_milestones", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "job_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "invoice_id"
    t.bigint "completed_by_id"
    t.string "name", null: false
    t.text "description"
    t.integer "sort_order", default: 0
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.decimal "percentage_of_contract", precision: 5, scale: 2
    t.boolean "is_percentage", default: false
    t.date "target_date"
    t.date "completed_date"
    t.string "status", limit: 20, default: "pending", null: false
    t.datetime "invoiced_at"
    t.boolean "auto_invoice", default: false
    t.text "completion_notes"
    t.text "deliverables"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_budget_scenarios", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "created_by_id"
    t.string "name", null: false
    t.string "scenario_type", limit: 30, default: "base", null: false
    t.integer "fiscal_year", null: false
    t.text "description"
    t.text "assumptions"
    t.decimal "revenue_adjustment_pct", precision: 5, scale: 2, default: "0.0"
    t.decimal "expense_adjustment_pct", precision: 5, scale: 2, default: "0.0"
    t.string "status", limit: 20, default: "draft"
    t.boolean "is_default", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_budgets", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "gl_account_id", null: false
    t.bigint "gl_period_id", null: false
    t.string "external_provider"
    t.string "external_tenant_id"
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.string "budget_type", default: "monthly"
    t.string "tracking_category"
    t.string "tracking_option"
    t.bigint "job_id"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "scenario", limit: 30, default: "base"
    t.text "scenario_assumptions"
  end

  create_table "gl_categorization_predictions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "bank_transaction_id"
    t.bigint "predicted_category_id"
    t.bigint "predicted_account_id"
    t.bigint "actual_category_id"
    t.bigint "actual_account_id"
    t.float "confidence_score", null: false
    t.jsonb "features_used", default: {}
    t.string "status", default: "pending"
    t.bigint "reviewed_by_id"
    t.datetime "reviewed_at"
    t.text "rejection_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_change_order_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "change_order_id", null: false
    t.integer "sort_order", default: 0
    t.string "description", null: false
    t.decimal "quantity", precision: 15, scale: 4, default: "1.0"
    t.string "unit_of_measure", limit: 20
    t.decimal "unit_price", precision: 15, scale: 4
    t.decimal "amount", precision: 15, scale: 2
    t.string "cost_code"
    t.string "cost_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_change_orders", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "job_id", null: false
    t.bigint "contact_id"
    t.bigint "requested_by_id"
    t.bigint "approved_by_id"
    t.string "change_order_number", null: false
    t.string "title", null: false
    t.text "description"
    t.string "reason"
    t.string "status", limit: 20, default: "draft"
    t.decimal "contract_amount_change", precision: 15, scale: 2, default: "0.0"
    t.decimal "cost_change", precision: 15, scale: 2, default: "0.0"
    t.integer "schedule_days_change", default: 0
    t.decimal "original_contract_value", precision: 15, scale: 2
    t.decimal "revised_contract_value", precision: 15, scale: 2
    t.datetime "submitted_at"
    t.datetime "approved_at"
    t.datetime "rejected_at"
    t.text "rejection_reason"
    t.string "client_signature"
    t.datetime "client_signed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_class_assignments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tracking_class_id", null: false
    t.string "assignable_type", null: false
    t.bigint "assignable_id", null: false
    t.decimal "percentage", precision: 5, scale: 2, default: "100.0"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_currencies", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "code", null: false
    t.string "name", null: false
    t.string "symbol"
    t.boolean "is_base_currency", default: false
    t.boolean "active", default: true
    t.integer "decimal_places", default: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_custom_reports", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "created_by_id"
    t.string "name", null: false
    t.text "description"
    t.string "report_type", default: "table", null: false
    t.string "base_entity", null: false
    t.string "category"
    t.boolean "is_public", default: false
    t.boolean "is_template", default: false
    t.jsonb "columns", default: []
    t.jsonb "filters", default: []
    t.jsonb "groupings", default: []
    t.jsonb "aggregations", default: []
    t.jsonb "sort_order", default: []
    t.jsonb "chart_config", default: {}
    t.jsonb "formatting", default: {}
    t.integer "usage_count", default: 0
    t.datetime "last_run_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_customer_payment_stats", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.integer "total_invoices", default: 0
    t.integer "paid_on_time", default: 0
    t.integer "paid_late", default: 0
    t.float "average_days_to_pay"
    t.float "average_days_late"
    t.decimal "total_invoiced", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_outstanding", precision: 15, scale: 2, default: "0.0"
    t.decimal "largest_invoice", precision: 15, scale: 2
    t.date "last_payment_date"
    t.date "last_late_payment"
    t.float "payment_reliability_score"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_customer_statement_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "statement_id", null: false
    t.bigint "invoice_id"
    t.bigint "payment_id"
    t.date "transaction_date", null: false
    t.string "transaction_type", limit: 20
    t.string "reference"
    t.string "description"
    t.decimal "amount", precision: 15, scale: 2
    t.decimal "running_balance", precision: 15, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_customer_statements", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "generated_by_id"
    t.string "reference", null: false
    t.date "statement_date", null: false
    t.date "period_start"
    t.date "period_end"
    t.decimal "opening_balance", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_invoices", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_payments", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_credits", precision: 15, scale: 2, default: "0.0"
    t.decimal "closing_balance", precision: 15, scale: 2, default: "0.0"
    t.decimal "current_amount", precision: 15, scale: 2, default: "0.0"
    t.decimal "days_30", precision: 15, scale: 2, default: "0.0"
    t.decimal "days_60", precision: 15, scale: 2, default: "0.0"
    t.decimal "days_90", precision: 15, scale: 2, default: "0.0"
    t.decimal "days_90_plus", precision: 15, scale: 2, default: "0.0"
    t.string "status", limit: 20, default: "generated"
    t.datetime "sent_at"
    t.datetime "viewed_at"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_dashboard_widgets", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "dashboard_id", null: false
    t.bigint "custom_report_id"
    t.string "widget_type", null: false
    t.string "title"
    t.jsonb "config", default: {}
    t.integer "row", null: false
    t.integer "col", null: false
    t.integer "width", default: 1, null: false
    t.integer "height", default: 1, null: false
    t.datetime "last_refreshed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_departments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "name", null: false
    t.string "code"
    t.bigint "parent_id"
    t.bigint "manager_id"
    t.boolean "active", default: true
    t.decimal "budget_amount", precision: 15, scale: 2
    t.text "description"
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_deposit_allocations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "deposit_id", null: false
    t.bigint "invoice_id", null: false
    t.bigint "allocated_by_id"
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.datetime "allocated_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_deposits", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "job_id"
    t.bigint "received_by_id"
    t.bigint "bank_account_id"
    t.string "reference", null: false
    t.date "received_date", null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.decimal "applied_amount", precision: 15, scale: 2, default: "0.0"
    t.decimal "refunded_amount", precision: 15, scale: 2, default: "0.0"
    t.decimal "balance", precision: 15, scale: 2
    t.string "deposit_type", limit: 20, default: "deposit", null: false
    t.string "status", limit: 20, default: "received", null: false
    t.string "payment_method", limit: 30
    t.string "payment_reference"
    t.text "description"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_direct_debit_mandates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.string "mandate_reference", null: false
    t.string "status", limit: 20, default: "pending"
    t.string "bsb", limit: 7
    t.string "account_number", limit: 15
    t.string "account_name", limit: 100
    t.datetime "authorized_at"
    t.string "authorization_method"
    t.string "ip_address"
    t.text "signature"
    t.date "start_date"
    t.date "end_date"
    t.decimal "max_amount", precision: 15, scale: 2
    t.string "frequency"
    t.datetime "cancelled_at"
    t.string "cancellation_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_document_requests", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "job_id"
    t.bigint "created_by_id"
    t.string "title", null: false
    t.text "description"
    t.string "status", default: "pending"
    t.date "due_date"
    t.datetime "sent_at"
    t.datetime "completed_at"
    t.string "access_token"
    t.integer "reminder_count", default: 0
    t.datetime "last_reminder_at"
    t.jsonb "email_settings", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_duplicate_bill_reviews", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "bill1_id", null: false
    t.bigint "bill2_id", null: false
    t.string "status", limit: 30, default: "pending", null: false
    t.string "action_taken", limit: 30
    t.bigint "kept_bill_id"
    t.bigint "voided_bill_id"
    t.bigint "reviewed_by_id"
    t.datetime "reviewed_at"
    t.text "notes"
    t.integer "detection_score"
    t.string "match_type", limit: 50
    t.text "detection_reasoning"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_duplicate_groups", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "entity_type", null: false
    t.string "status", default: "pending"
    t.float "similarity_score"
    t.jsonb "matching_fields", default: []
    t.bigint "reviewed_by_id"
    t.datetime "reviewed_at"
    t.string "resolution"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_duplicate_members", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "duplicate_group_id", null: false
    t.string "duplicable_type"
    t.bigint "duplicable_id"
    t.boolean "is_primary", default: false
    t.boolean "is_retained", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_equipment", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "equipment_number", null: false
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.string "status", limit: 20, default: "active"
    t.string "ownership_type", limit: 20, default: "owned"
    t.decimal "purchase_price", precision: 15, scale: 2
    t.date "purchase_date"
    t.decimal "current_value", precision: 15, scale: 2
    t.string "vendor_name"
    t.decimal "hourly_rate", precision: 10, scale: 2
    t.decimal "daily_rate", precision: 10, scale: 2
    t.decimal "weekly_rate", precision: 10, scale: 2
    t.decimal "monthly_rate", precision: 10, scale: 2
    t.decimal "fuel_cost_per_hour", precision: 10, scale: 4
    t.decimal "maintenance_cost_per_hour", precision: 10, scale: 4
    t.decimal "total_hours", precision: 15, scale: 2, default: "0.0"
    t.datetime "last_used_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_equipment_usages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "equipment_id", null: false
    t.bigint "job_id", null: false
    t.bigint "user_id"
    t.date "usage_date", null: false
    t.decimal "hours", precision: 8, scale: 2, null: false
    t.decimal "hourly_rate", precision: 10, scale: 2
    t.decimal "total_cost", precision: 15, scale: 2
    t.string "cost_code"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_exchange_rates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "gl_currency_id", null: false
    t.date "effective_date", null: false
    t.decimal "rate", precision: 15, scale: 6, null: false
    t.string "source"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_inventory_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "pricebook_item_id"
    t.bigint "cogs_account_id"
    t.bigint "inventory_account_id"
    t.bigint "income_account_id"
    t.string "sku", null: false
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.string "unit_of_measure", limit: 20, default: "each"
    t.decimal "cost_price", precision: 15, scale: 4
    t.decimal "sale_price", precision: 15, scale: 2
    t.string "costing_method", limit: 20, default: "average"
    t.decimal "quantity_on_hand", precision: 15, scale: 4, default: "0.0"
    t.decimal "quantity_committed", precision: 15, scale: 4, default: "0.0"
    t.decimal "quantity_on_order", precision: 15, scale: 4, default: "0.0"
    t.decimal "quantity_available", precision: 15, scale: 4, default: "0.0"
    t.decimal "reorder_point", precision: 15, scale: 4
    t.decimal "reorder_quantity", precision: 15, scale: 4
    t.boolean "track_inventory", default: true
    t.string "status", limit: 20, default: "active"
    t.boolean "is_sellable", default: true
    t.boolean "is_purchasable", default: true
    t.datetime "last_counted_at"
    t.datetime "last_received_at"
    t.datetime "last_sold_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_inventory_transactions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "inventory_item_id", null: false
    t.bigint "user_id"
    t.string "transaction_type", limit: 30, null: false
    t.decimal "quantity", precision: 15, scale: 4, null: false
    t.decimal "unit_cost", precision: 15, scale: 4
    t.decimal "total_cost", precision: 15, scale: 2
    t.decimal "quantity_before", precision: 15, scale: 4
    t.decimal "quantity_after", precision: 15, scale: 4
    t.string "reference_type"
    t.bigint "reference_id"
    t.text "notes"
    t.datetime "transaction_date", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_invoice_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "gl_invoice_id", null: false
    t.bigint "gl_account_id"
    t.integer "line_number", default: 1
    t.string "item_code"
    t.text "description"
    t.decimal "quantity", precision: 15, scale: 4, default: "1.0"
    t.decimal "unit_price", precision: 15, scale: 4, default: "0.0"
    t.decimal "discount_rate", precision: 5, scale: 2, default: "0.0"
    t.decimal "discount_amount", precision: 15, scale: 2, default: "0.0"
    t.decimal "line_amount", precision: 15, scale: 2, default: "0.0"
    t.decimal "tax_amount", precision: 15, scale: 2, default: "0.0"
    t.bigint "gl_tax_rate_id"
    t.string "tax_type"
    t.bigint "job_id"
    t.string "tracking_category_1"
    t.string "tracking_option_1"
    t.string "tracking_category_2"
    t.string "tracking_option_2"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_invoices", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "external_provider"
    t.string "external_tenant_id"
    t.string "external_invoice_id"
    t.datetime "external_synced_at"
    t.datetime "external_updated_at"
    t.string "invoice_number"
    t.string "invoice_type", null: false
    t.string "reference"
    t.date "invoice_date", null: false
    t.date "due_date"
    t.bigint "contact_id"
    t.string "external_contact_id"
    t.string "contact_name"
    t.decimal "subtotal", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_tax", precision: 15, scale: 2, default: "0.0"
    t.decimal "total", precision: 15, scale: 2, default: "0.0"
    t.decimal "amount_due", precision: 15, scale: 2, default: "0.0"
    t.decimal "amount_paid", precision: 15, scale: 2, default: "0.0"
    t.string "currency_code", default: "AUD"
    t.decimal "exchange_rate", precision: 15, scale: 6, default: "1.0"
    t.string "status", default: "draft"
    t.datetime "approved_at"
    t.bigint "approved_by_id"
    t.bigint "job_id"
    t.bigint "gl_journal_entry_id"
    t.boolean "journalized", default: false
    t.boolean "sync_enabled", default: true
    t.boolean "pending_push", default: false
    t.boolean "created_in_teeem", default: false
    t.datetime "teeem_updated_at"
    t.string "sync_error"
    t.text "description"
    t.text "notes"
    t.boolean "has_attachments", default: false
    t.jsonb "tracking_data", default: []
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "recurring_invoice_id"
    t.integer "recurring_sequence"
    t.string "payment_url"
    t.string "payment_token"
    t.bigint "department_id"
  end

  create_table "gl_journal_entries", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "gl_period_id", null: false
    t.string "external_provider"
    t.string "external_tenant_id"
    t.string "entry_number"
    t.date "entry_date", null: false
    t.string "description"
    t.string "source_type", null: false
    t.string "source_id"
    t.string "external_source_id"
    t.string "source_number"
    t.decimal "total_debits", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_credits", precision: 15, scale: 2, default: "0.0"
    t.string "currency_code", default: "AUD"
    t.decimal "exchange_rate", precision: 15, scale: 6, default: "1.0"
    t.string "status", default: "posted"
    t.datetime "voided_at"
    t.string "void_reason"
    t.bigint "job_id"
    t.datetime "external_created_at"
    t.datetime "external_synced_at"
    t.bigint "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "department_id"
  end

  create_table "gl_kpi_definitions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "name", null: false
    t.string "code", null: false
    t.string "category"
    t.string "formula_type", null: false
    t.jsonb "formula", null: false
    t.string "format"
    t.decimal "target_value", precision: 15, scale: 4
    t.string "target_direction"
    t.decimal "warning_threshold", precision: 15, scale: 4
    t.decimal "critical_threshold", precision: 15, scale: 4
    t.boolean "active", default: true
    t.boolean "show_on_dashboard", default: false
    t.integer "position"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_ledger_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "gl_journal_entry_id", null: false
    t.bigint "gl_account_id", null: false
    t.decimal "debit", precision: 15, scale: 2, default: "0.0"
    t.decimal "credit", precision: 15, scale: 2, default: "0.0"
    t.string "description"
    t.string "reference"
    t.string "tax_type"
    t.decimal "tax_amount", precision: 15, scale: 2, default: "0.0"
    t.string "tracking_category_1"
    t.string "tracking_option_1"
    t.string "tracking_category_2"
    t.string "tracking_option_2"
    t.bigint "job_id"
    t.bigint "contact_id"
    t.decimal "running_balance", precision: 15, scale: 2
    t.integer "line_number"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_lien_waivers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "job_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "progress_claim_id"
    t.string "waiver_type", limit: 30, null: false
    t.date "waiver_date", null: false
    t.decimal "through_amount", precision: 15, scale: 2
    t.date "through_date"
    t.string "status", limit: 20, default: "requested"
    t.string "document_file_id"
    t.datetime "received_at"
    t.string "received_from"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_opening_balances", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "gl_account_id", null: false
    t.string "external_provider"
    t.string "external_tenant_id"
    t.date "effective_date", null: false
    t.decimal "balance", precision: 15, scale: 2, default: "0.0"
    t.string "source"
    t.string "financial_year"
    t.decimal "reconciled_balance", precision: 15, scale: 2
    t.date "reconciled_date"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_payment_allocations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "gl_payment_id", null: false
    t.bigint "gl_invoice_id", null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_payment_batch_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "payment_batch_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "invoice_id"
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.string "reference"
    t.string "bsb", limit: 7
    t.string "account_number", limit: 9
    t.string "account_name", limit: 32
    t.string "status", limit: 20, default: "pending"
    t.text "notes"
    t.string "error_message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_payment_batches", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "bank_account_id"
    t.bigint "created_by_id"
    t.bigint "approved_by_id"
    t.string "reference", null: false
    t.date "payment_date", null: false
    t.string "status", limit: 20, default: "draft"
    t.integer "payment_count", default: 0
    t.decimal "total_amount", precision: 15, scale: 2, default: "0.0"
    t.text "aba_file_content"
    t.string "aba_file_name"
    t.datetime "aba_generated_at"
    t.datetime "approved_at"
    t.datetime "processed_at"
    t.datetime "completed_at"
    t.text "processing_notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_payment_predictions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "invoice_id", null: false
    t.bigint "contact_id"
    t.float "probability_late", null: false
    t.integer "predicted_days_late"
    t.date "predicted_payment_date"
    t.jsonb "risk_factors", default: []
    t.string "risk_level"
    t.boolean "prediction_correct"
    t.date "actual_payment_date"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_payments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "external_provider"
    t.string "external_tenant_id"
    t.string "external_payment_id"
    t.datetime "external_synced_at"
    t.datetime "external_updated_at"
    t.string "payment_number"
    t.string "payment_type", null: false
    t.date "payment_date", null: false
    t.string "reference"
    t.bigint "contact_id"
    t.string "external_contact_id"
    t.string "contact_name"
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.string "currency_code", default: "AUD"
    t.decimal "exchange_rate", precision: 15, scale: 6, default: "1.0"
    t.bigint "gl_account_id"
    t.string "bank_account_code"
    t.string "bank_account_name"
    t.string "status", default: "pending"
    t.bigint "gl_journal_entry_id"
    t.boolean "journalized", default: false
    t.boolean "sync_enabled", default: true
    t.boolean "pending_push", default: false
    t.boolean "created_in_teeem", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_period_locks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "locked_by_id"
    t.bigint "unlocked_by_id"
    t.date "period_start", null: false
    t.date "period_end", null: false
    t.string "period_type", limit: 20, null: false
    t.string "status", limit: 20, default: "locked", null: false
    t.datetime "locked_at"
    t.datetime "unlocked_at"
    t.text "lock_reason"
    t.text "unlock_reason"
    t.integer "transactions_at_lock", default: 0
    t.decimal "balance_at_lock", precision: 15, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_period_snapshots", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "period_type", null: false
    t.date "period_start", null: false
    t.date "period_end", null: false
    t.string "label"
    t.jsonb "account_balances", default: {}
    t.jsonb "department_totals", default: {}
    t.jsonb "class_totals", default: {}
    t.jsonb "kpi_values", default: {}
    t.boolean "finalized", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_periods", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "external_provider"
    t.string "external_tenant_id"
    t.string "financial_year", null: false
    t.integer "period_number", null: false
    t.string "period_name"
    t.date "period_start", null: false
    t.date "period_end", null: false
    t.string "status", default: "open"
    t.datetime "closed_at"
    t.bigint "closed_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_portal_sessions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "portal_token_id", null: false
    t.bigint "contact_id", null: false
    t.string "session_token", null: false
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "expires_at"
    t.datetime "last_activity_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_portal_tokens", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.string "token", null: false
    t.string "token_type", limit: 20, default: "invoice"
    t.bigint "invoice_id"
    t.datetime "expires_at"
    t.datetime "last_accessed_at"
    t.integer "access_count", default: 0
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_progress_claim_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "progress_claim_id", null: false
    t.string "description", null: false
    t.string "category"
    t.integer "sort_order", default: 0
    t.decimal "contract_value", precision: 15, scale: 2, null: false
    t.decimal "previous_pct", precision: 5, scale: 2, default: "0.0"
    t.decimal "this_pct", precision: 5, scale: 2, null: false
    t.decimal "total_pct", precision: 5, scale: 2
    t.decimal "this_claim_amount", precision: 15, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "profit_centre_id"
  end

  create_table "gl_progress_claims", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "job_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "invoice_id"
    t.bigint "created_by_id"
    t.bigint "approved_by_id"
    t.string "claim_number", null: false
    t.integer "claim_sequence", default: 1, null: false
    t.date "claim_date", null: false
    t.date "period_from"
    t.date "period_to"
    t.decimal "contract_value", precision: 15, scale: 2, null: false
    t.decimal "variations_approved", precision: 15, scale: 2, default: "0.0"
    t.decimal "adjusted_contract_value", precision: 15, scale: 2
    t.decimal "previous_claimed_pct", precision: 5, scale: 2, default: "0.0"
    t.decimal "this_claim_pct", precision: 5, scale: 2, null: false
    t.decimal "total_claimed_pct", precision: 5, scale: 2
    t.decimal "previous_claimed_amount", precision: 15, scale: 2, default: "0.0"
    t.decimal "this_claim_amount", precision: 15, scale: 2, null: false
    t.decimal "total_claimed_amount", precision: 15, scale: 2
    t.decimal "retainage_pct", precision: 5, scale: 2, default: "0.0"
    t.decimal "retainage_amount", precision: 15, scale: 2, default: "0.0"
    t.decimal "retainage_released", precision: 15, scale: 2, default: "0.0"
    t.decimal "gst_amount", precision: 15, scale: 2, default: "0.0"
    t.decimal "net_claim_amount", precision: 15, scale: 2
    t.decimal "total_payable", precision: 15, scale: 2
    t.string "status", limit: 20, default: "draft", null: false
    t.datetime "submitted_at"
    t.datetime "approved_at"
    t.datetime "certified_at"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_provider_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "provider", null: false
    t.string "tenant_id", null: false
    t.string "tenant_name"
    t.text "access_token_encrypted"
    t.text "refresh_token_encrypted"
    t.datetime "token_expires_at"
    t.string "status", default: "pending"
    t.string "error_message"
    t.datetime "connected_at"
    t.datetime "disconnected_at"
    t.datetime "last_sync_at"
    t.datetime "last_full_sync_at"
    t.string "last_sync_status"
    t.boolean "sync_enabled", default: true
    t.boolean "two_way_sync", default: false
    t.jsonb "sync_settings", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_quote_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "quote_id", null: false
    t.bigint "pricebook_item_id"
    t.integer "sort_order", default: 0
    t.string "line_type", limit: 20, default: "item"
    t.string "code"
    t.string "description", null: false
    t.decimal "quantity", precision: 15, scale: 4, default: "1.0"
    t.string "unit_of_measure", limit: 20
    t.decimal "unit_price", precision: 15, scale: 4, null: false
    t.decimal "discount_percent", precision: 5, scale: 2
    t.decimal "tax_rate", precision: 5, scale: 2
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.boolean "optional", default: false
    t.boolean "selected", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_quote_versions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "quote_id", null: false
    t.bigint "created_by_id"
    t.integer "version_number", null: false
    t.decimal "total", precision: 15, scale: 2
    t.text "changes_summary"
    t.json "snapshot"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_quotes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "job_id"
    t.bigint "created_by_id"
    t.bigint "invoice_id"
    t.string "quote_number", null: false
    t.date "quote_date", null: false
    t.date "expiry_date"
    t.string "reference"
    t.string "status", limit: 20, default: "draft"
    t.decimal "subtotal", precision: 15, scale: 2, default: "0.0"
    t.decimal "tax", precision: 15, scale: 2, default: "0.0"
    t.decimal "total", precision: 15, scale: 2, default: "0.0"
    t.decimal "discount", precision: 15, scale: 2, default: "0.0"
    t.string "discount_type", limit: 10
    t.text "terms"
    t.text "notes"
    t.text "internal_notes"
    t.datetime "sent_at"
    t.datetime "viewed_at"
    t.datetime "accepted_at"
    t.datetime "rejected_at"
    t.datetime "converted_at"
    t.string "rejection_reason"
    t.string "customer_signature"
    t.datetime "signature_date"
    t.string "signature_ip"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_reconciliation_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "gl_bank_reconciliation_id", null: false
    t.bigint "gl_ledger_line_id"
    t.string "external_transaction_id"
    t.date "transaction_date"
    t.string "description"
    t.decimal "amount", precision: 15, scale: 2
    t.string "reference"
    t.string "status", default: "unmatched"
    t.string "match_type"
    t.decimal "match_confidence", precision: 5, scale: 2
    t.bigint "gl_account_id"
    t.text "adjustment_reason"
    t.jsonb "matched_transaction_ids", default: []
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_reconciliation_rules", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "gl_account_id"
    t.string "name", null: false
    t.string "rule_type", null: false
    t.string "match_field"
    t.string "match_operator"
    t.string "match_value"
    t.decimal "amount_tolerance", precision: 15, scale: 2, default: "0.0"
    t.bigint "target_account_id"
    t.string "tax_type"
    t.text "default_description"
    t.integer "times_used", default: 0
    t.datetime "last_used_at"
    t.boolean "active", default: true
    t.integer "priority", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "auto_created", default: false
    t.decimal "confidence", precision: 5, scale: 2
    t.integer "pattern_count"
  end

  create_table "gl_recurring_invoices", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "invoice_type", default: "sales_invoice", null: false
    t.text "description"
    t.bigint "contact_id"
    t.string "contact_name"
    t.bigint "job_id"
    t.string "frequency", null: false
    t.integer "frequency_interval", default: 1
    t.integer "day_of_month"
    t.integer "day_of_week"
    t.date "start_date", null: false
    t.date "end_date"
    t.integer "occurrences_limit"
    t.integer "occurrences_count", default: 0
    t.date "next_generation_date"
    t.datetime "last_generated_at"
    t.integer "payment_terms_days", default: 14
    t.string "currency_code", default: "AUD"
    t.decimal "exchange_rate", precision: 12, scale: 6, default: "1.0"
    t.text "notes"
    t.jsonb "line_items_template", default: []
    t.decimal "subtotal", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_tax", precision: 15, scale: 2, default: "0.0"
    t.decimal "total", precision: 15, scale: 2, default: "0.0"
    t.boolean "is_active", default: true
    t.string "status", default: "active"
    t.boolean "auto_approve", default: false
    t.boolean "send_email_on_generation", default: false
    t.string "email_to"
    t.string "email_cc"
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_report_columns", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "custom_report_id", null: false
    t.string "field_path", null: false
    t.string "display_name"
    t.string "data_type"
    t.string "aggregation"
    t.string "format"
    t.integer "width"
    t.integer "position", null: false
    t.boolean "visible", default: true
    t.boolean "sortable", default: true
    t.boolean "filterable", default: true
    t.jsonb "conditional_formatting", default: []
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_report_dashboards", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "created_by_id"
    t.string "name", null: false
    t.text "description"
    t.boolean "is_default", default: false
    t.boolean "is_public", default: false
    t.jsonb "layout", default: []
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_report_favorites", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "custom_report_id", null: false
    t.integer "position"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_report_filters", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "custom_report_id", null: false
    t.string "field_path", null: false
    t.string "operator", null: false
    t.jsonb "value"
    t.string "value_type"
    t.string "conjunction", default: "and"
    t.integer "position", null: false
    t.boolean "required", default: false
    t.boolean "user_editable", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_report_runs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "custom_report_id", null: false
    t.bigint "run_by_id"
    t.jsonb "parameters", default: {}
    t.integer "row_count"
    t.decimal "execution_time", precision: 10, scale: 3
    t.string "status", default: "pending", null: false
    t.text "error_message"
    t.jsonb "summary_stats", default: {}
    t.string "export_format"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_report_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.string "category", null: false
    t.string "base_entity", null: false
    t.jsonb "definition", null: false
    t.string "icon"
    t.boolean "active", default: true
    t.integer "usage_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_requested_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "document_request_id", null: false
    t.string "document_type", null: false
    t.string "name", null: false
    t.text "instructions"
    t.string "status", default: "pending"
    t.boolean "required", default: true
    t.bigint "uploaded_file_id"
    t.datetime "uploaded_at"
    t.bigint "reviewed_by_id"
    t.datetime "reviewed_at"
    t.text "rejection_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_retainage_releases", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "job_id", null: false
    t.bigint "progress_claim_id"
    t.bigint "invoice_id"
    t.bigint "approved_by_id"
    t.string "release_type", limit: 20, null: false
    t.date "release_date", null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.decimal "remaining_retainage", precision: 15, scale: 2
    t.string "status", limit: 20, default: "pending"
    t.text "conditions"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_scheduled_invoices", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "invoice_id", null: false
    t.bigint "created_by_id"
    t.datetime "scheduled_for", null: false
    t.string "status", limit: 20, default: "pending", null: false
    t.boolean "send_email", default: true
    t.datetime "sent_at"
    t.datetime "cancelled_at"
    t.text "error_message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_scheduled_reports", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "created_by_id"
    t.string "name", null: false
    t.string "report_type", limit: 50, null: false
    t.string "frequency", limit: 20, null: false
    t.string "format", limit: 10, default: "pdf", null: false
    t.integer "day_of_week"
    t.integer "day_of_month"
    t.time "send_at", default: "2000-01-01 08:00:00"
    t.text "recipients"
    t.string "email_subject"
    t.text "email_body"
    t.jsonb "parameters", default: {}
    t.boolean "active", default: true
    t.datetime "last_sent_at"
    t.datetime "next_send_at"
    t.integer "send_count", default: 0
    t.text "last_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_split_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "split_transaction_id", null: false
    t.bigint "account_id", null: false
    t.bigint "department_id"
    t.bigint "job_id"
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.decimal "percentage", precision: 5, scale: 2
    t.text "description"
    t.bigint "tax_rate_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_split_transactions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "original_transaction_type"
    t.bigint "original_transaction_id"
    t.decimal "original_amount", precision: 15, scale: 2, null: false
    t.string "status", default: "pending"
    t.bigint "created_by_id"
    t.bigint "approved_by_id"
    t.datetime "completed_at"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_stock_count_lines", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "stock_count_id", null: false
    t.bigint "inventory_item_id", null: false
    t.decimal "system_quantity", precision: 15, scale: 4
    t.decimal "counted_quantity", precision: 15, scale: 4
    t.decimal "variance", precision: 15, scale: 4
    t.decimal "variance_value", precision: 15, scale: 2
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_stock_counts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "created_by_id"
    t.bigint "approved_by_id"
    t.string "reference", null: false
    t.date "count_date", null: false
    t.string "status", limit: 20, default: "draft"
    t.text "notes"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_sync_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "gl_provider_credential_id"
    t.string "external_provider", null: false
    t.string "external_tenant_id", null: false
    t.string "sync_type", null: false
    t.string "status", null: false
    t.datetime "started_at"
    t.datetime "completed_at"
    t.integer "records_processed", default: 0
    t.integer "records_created", default: 0
    t.integer "records_updated", default: 0
    t.integer "records_skipped", default: 0
    t.integer "records_failed", default: 0
    t.integer "total_records"
    t.text "error_message"
    t.jsonb "error_details", default: {}
    t.jsonb "details", default: {}
    t.datetime "sync_from"
    t.datetime "sync_to"
    t.string "trigger"
    t.bigint "triggered_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_tax_rates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "external_provider"
    t.string "external_tenant_id"
    t.string "external_tax_type"
    t.string "code", null: false
    t.string "name", null: false
    t.string "tax_type"
    t.decimal "rate", precision: 5, scale: 2, null: false
    t.bigint "gl_account_id"
    t.boolean "active", default: true
    t.boolean "can_apply_to_expenses", default: true
    t.boolean "can_apply_to_revenue", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_time_billing_batches", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.bigint "job_id"
    t.bigint "invoice_id"
    t.bigint "created_by_id"
    t.string "reference", null: false
    t.date "period_start", null: false
    t.date "period_end", null: false
    t.decimal "total_hours", precision: 10, scale: 2
    t.decimal "total_amount", precision: 15, scale: 2
    t.string "status", limit: 20, default: "draft"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_tpar_payees", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tpar_report_id", null: false
    t.bigint "contact_id", null: false
    t.string "abn", limit: 11
    t.string "payee_name"
    t.string "address_line1"
    t.string "address_line2"
    t.string "suburb"
    t.string "state", limit: 3
    t.string "postcode", limit: 4
    t.decimal "gross_paid", precision: 15, scale: 2, default: "0.0"
    t.decimal "gst_paid", precision: 15, scale: 2, default: "0.0"
    t.decimal "tax_withheld", precision: 15, scale: 2, default: "0.0"
    t.boolean "no_abn_quoted", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_tpar_reports", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "created_by_id"
    t.string "financial_year", limit: 10, null: false
    t.date "period_start", null: false
    t.date "period_end", null: false
    t.string "status", limit: 20, default: "draft"
    t.integer "payee_count", default: 0
    t.decimal "total_gross", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_gst", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_tax_withheld", precision: 15, scale: 2, default: "0.0"
    t.datetime "lodged_at"
    t.string "lodgement_reference"
    t.text "lodgement_response"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_tracking_classes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "name", null: false
    t.string "class_type", null: false
    t.string "code"
    t.bigint "parent_id"
    t.boolean "active", default: true
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_transaction_categories", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.string "name", null: false
    t.string "category_type"
    t.bigint "default_account_id"
    t.bigint "default_tax_rate_id"
    t.jsonb "keywords", default: []
    t.jsonb "patterns", default: []
    t.integer "usage_count", default: 0
    t.float "confidence_threshold", default: 0.7
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_wip_report_jobs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "wip_report_id", null: false
    t.bigint "job_id", null: false
    t.decimal "contract_value", precision: 15, scale: 2, null: false
    t.decimal "approved_variations", precision: 15, scale: 2, default: "0.0"
    t.decimal "revised_contract_value", precision: 15, scale: 2
    t.decimal "costs_to_date", precision: 15, scale: 2, default: "0.0"
    t.decimal "estimated_costs_to_complete", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_estimated_costs", precision: 15, scale: 2
    t.decimal "completion_percentage", precision: 5, scale: 2
    t.string "completion_method", limit: 30, default: "cost_to_cost"
    t.decimal "revenue_recognized", precision: 15, scale: 2
    t.decimal "revenue_recognized_prior", precision: 15, scale: 2, default: "0.0"
    t.decimal "revenue_this_period", precision: 15, scale: 2
    t.decimal "billings_to_date", precision: 15, scale: 2, default: "0.0"
    t.decimal "unbilled_revenue", precision: 15, scale: 2
    t.decimal "costs_in_excess_of_billings", precision: 15, scale: 2, default: "0.0"
    t.decimal "billings_in_excess_of_costs", precision: 15, scale: 2, default: "0.0"
    t.decimal "gross_profit", precision: 15, scale: 2
    t.decimal "gross_profit_pct", precision: 5, scale: 2
    t.decimal "estimated_profit_at_completion", precision: 15, scale: 2
    t.text "notes"
    t.string "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "gl_wip_reports", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_id", null: false
    t.bigint "created_by_id"
    t.string "reference", null: false
    t.date "report_date", null: false
    t.date "period_start"
    t.date "period_end"
    t.string "status", limit: 20, default: "draft"
    t.decimal "total_contract_value", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_costs_to_date", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_estimated_costs", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_revenue_recognized", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_billings_to_date", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_wip_asset", precision: 15, scale: 2, default: "0.0"
    t.decimal "total_wip_liability", precision: 15, scale: 2, default: "0.0"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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
    t.integer "lookup"
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

  create_table "gst_codes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.string "code", null: false
    t.string "name", null: false
    t.decimal "rate", precision: 5, scale: 4, default: "0.0", null: false
    t.string "xero_tax_types"
    t.boolean "active", default: true
    t.integer "position", default: 0
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

  create_table "imap_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.integer "sync_interval_minutes", default: 2
    t.bigint "last_uid"
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "email_signature"
    t.text "email_aliases", default: [], array: true
    t.integer "shared_with_user_ids", default: [], array: true
    t.integer "nav_position", default: 0
    t.boolean "sync_all", default: false, null: false
    t.jsonb "branding_config", default: {"use_default"=>true}
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

  create_table "import_audit_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "user_id"
    t.string "import_type", null: false
    t.string "status", default: "completed", null: false
    t.jsonb "counts", default: {}
    t.integer "rows_processed", default: 0
    t.integer "rows_created", default: 0
    t.integer "rows_updated", default: 0
    t.integer "rows_skipped", default: 0
    t.integer "errors_count", default: 0
    t.integer "warnings_count", default: 0
    t.jsonb "error_details", default: []
    t.jsonb "warning_details", default: []
    t.jsonb "options_used", default: {}
    t.string "filename"
    t.integer "file_size"
    t.datetime "started_at"
    t.datetime "completed_at"
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
    t.date "start_date"
    t.date "renewal_date"
    t.decimal "annual_premium"
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

  create_table "invoice_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.bigint "tenant_id", null: false
    t.string "sync_key"
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

  create_table "job_address_searches", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.string "search_term", null: false
    t.string "term_type", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "job_claim_stages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "job_id", null: false
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
    t.decimal "retainage_percentage", precision: 5, scale: 2, default: "0.0"
    t.decimal "retainage_amount", precision: 15, scale: 2, default: "0.0"
    t.datetime "retainage_released_at"
    t.bigint "retainage_release_invoice_id"
    t.integer "claim_sequence_number"
    t.string "match_keywords"
    t.bigint "profit_centre_id"
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
    t.bigint "profit_centre_id"
  end

  create_table "job_colour_selections", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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

  create_table "job_cost_budgets", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.bigint "cost_centre_id"
    t.decimal "labour_budget", precision: 14, scale: 2, default: "0.0"
    t.decimal "materials_budget", precision: 14, scale: 2, default: "0.0"
    t.decimal "subcontractor_budget", precision: 14, scale: 2, default: "0.0"
    t.decimal "equipment_budget", precision: 14, scale: 2, default: "0.0"
    t.decimal "overhead_budget", precision: 14, scale: 2, default: "0.0"
    t.decimal "contingency_budget", precision: 14, scale: 2, default: "0.0"
    t.decimal "total_budget", precision: 14, scale: 2, default: "0.0"
    t.decimal "warning_threshold_percent", precision: 5, scale: 2, default: "80.0"
    t.decimal "critical_threshold_percent", precision: 5, scale: 2, default: "100.0"
    t.decimal "labour_actual", precision: 14, scale: 2, default: "0.0"
    t.decimal "materials_actual", precision: 14, scale: 2, default: "0.0"
    t.decimal "subcontractor_actual", precision: 14, scale: 2, default: "0.0"
    t.decimal "equipment_actual", precision: 14, scale: 2, default: "0.0"
    t.decimal "overhead_actual", precision: 14, scale: 2, default: "0.0"
    t.decimal "total_actual", precision: 14, scale: 2, default: "0.0"
    t.decimal "labour_variance", precision: 14, scale: 2
    t.decimal "labour_variance_percent", precision: 5, scale: 2
    t.decimal "total_variance", precision: 14, scale: 2
    t.decimal "total_variance_percent", precision: 5, scale: 2
    t.decimal "estimated_margin", precision: 14, scale: 2
    t.decimal "estimated_margin_percent", precision: 5, scale: 2
    t.decimal "actual_margin", precision: 14, scale: 2
    t.decimal "actual_margin_percent", precision: 5, scale: 2
    t.string "alert_status", limit: 20, default: "ok"
    t.datetime "last_alert_at"
    t.datetime "last_alert_acknowledged_at"
    t.bigint "alert_acknowledged_by_id"
    t.datetime "last_calculated_at"
    t.string "calculation_status", limit: 20, default: "pending"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "job_designs", id: false, force: :cascade do |t|
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

  create_table "job_plan_revisions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_plan_id", null: false
    t.string "revision", null: false
    t.date "revision_date"
    t.date "issued_date"
    t.boolean "is_on_issue", default: false
    t.string "storage_file_id"
    t.string "storage_web_url"
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
    t.string "storage_item_id"
  end

  create_table "job_plan_tabs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.bigint "plan_category_id"
    t.bigint "parent_id"
    t.string "name", null: false
    t.string "code"
    t.integer "sequence_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "plans_count", default: 0, null: false
    t.integer "on_issue_plans_count", default: 0, null: false
  end

  create_table "job_plans", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.bigint "job_plan_tab_id"
    t.bigint "plan_type_id"
    t.string "variant_suffix"
    t.string "display_name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "current_revision_id"
    t.boolean "is_combined_pdf", default: false, null: false
    t.integer "revisions_count", default: 0, null: false
  end

  create_table "job_quantity_variables", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.bigint "quantity_variable_id", null: false
    t.string "value"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "job_recipes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.bigint "recipe_id", null: false
    t.decimal "quantity_multiplier", precision: 10, scale: 4, default: "1.0"
    t.decimal "applied_total", precision: 12, scale: 2
    t.text "notes"
    t.datetime "applied_at"
    t.bigint "applied_by_id"
    t.string "status", default: "applied"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "job_specifications", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.string "section_key", null: false
    t.string "item_key", null: false
    t.bigint "pricebook_item_id"
    t.string "custom_value"
    t.text "notes"
    t.integer "position", default: 0
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
    t.bigint "tenant_id"
    t.string "sync_key"
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
    t.bigint "tenant_id"
    t.string "sync_key"
  end

  create_table "job_statuses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.string "color"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
    t.string "sync_key"
  end

  create_table "job_tabs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "slug", null: false
    t.string "icon", null: false
    t.integer "position", default: 0, null: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "job_type_statuses", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_type_id", null: false
    t.bigint "job_status_id", null: false
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
    t.string "sync_key"
  end

  create_table "job_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "icon"
    t.string "color", default: "#6366F1"
    t.text "description"
    t.bigint "sm_schedule_master_template_id"
    t.bigint "tenant_id"
    t.string "sync_key"
  end

  create_table "jobs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name"
    t.decimal "contract_value", precision: 15, scale: 2, comment: "DEPRECATED: Use contract_price instead. See TEEEM_DOCS/SSOT_CONTRACT_VALUE_MIGRATION.md"
    t.decimal "live_profit", precision: 15, scale: 2
    t.decimal "profit_percentage", precision: 10, scale: 2
    t.string "certifier_job_no"
    t.date "start_date"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "purchase_orders_count", default: 0, null: false
    t.string "storage_folder_status", default: "not_requested"
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
    t.decimal "external_sales_fee", precision: 15, scale: 2
    t.decimal "default_retainage_percentage", precision: 5, scale: 2, default: "0.0"
    t.tsvector "searchable"
    t.bigint "cost_centre_id"
    t.integer "site_radius_meters", default: 100
    t.boolean "require_photo_checkin", default: false
    t.boolean "require_photo_checkout", default: false
    t.boolean "require_face_verification", default: false
    t.decimal "labour_budget", precision: 14, scale: 2
    t.decimal "labour_actual_cached", precision: 14, scale: 2, default: "0.0"
    t.decimal "labour_variance_percent", precision: 5, scale: 2
    t.decimal "site_latitude", precision: 10, scale: 7
    t.decimal "site_longitude", precision: 10, scale: 7
    t.integer "plans_count", default: 0, null: false
    t.integer "on_issue_plans_count", default: 0, null: false
    t.datetime "template_applied_at"
    t.string "storage_folder_id"
    t.string "level"
    t.string "dwelling_type"
    t.bigint "supervisor_id"
    t.bigint "site_coordinator_id"
    t.bigint "estimator_id"
    t.bigint "internal_sales_id"
    t.bigint "client_coordinator_id"
    t.string "job_code", null: false
    t.bigint "tenant_id"
    t.string "project_type", default: "construction", null: false
    t.string "design_name"
    t.bigint "job_design_id"
    t.bigint "default_profit_centre_id"
    t.string "estate"
    t.string "facade"
    t.boolean "developer_approval", default: false
    t.string "developer_contact"
    t.string "land_registration"
    t.string "building_contract_type"
    t.string "development_application"
    t.string "sales_centre"
    t.string "wind_classification"
    t.string "soil_classification"
    t.string "specification"
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

  create_table "labour_cost_entries", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "site_presence_session_id"
    t.bigint "worker_profile_id", null: false
    t.bigint "job_id", null: false
    t.bigint "sm_task_id"
    t.bigint "cost_centre_id"
    t.date "entry_date", null: false
    t.decimal "regular_hours", precision: 5, scale: 2, default: "0.0"
    t.decimal "overtime_1_5x_hours", precision: 5, scale: 2, default: "0.0"
    t.decimal "overtime_2x_hours", precision: 5, scale: 2, default: "0.0"
    t.decimal "travel_hours", precision: 5, scale: 2, default: "0.0"
    t.decimal "standby_hours", precision: 5, scale: 2, default: "0.0"
    t.decimal "base_rate", precision: 10, scale: 2
    t.decimal "overtime_1_5x_rate", precision: 10, scale: 2
    t.decimal "overtime_2x_rate", precision: 10, scale: 2
    t.decimal "employment_cost_percent_used", precision: 5, scale: 2
    t.decimal "overhead_percent_used", precision: 5, scale: 2
    t.decimal "base_labour_cost", precision: 10, scale: 2, default: "0.0"
    t.decimal "employment_cost", precision: 10, scale: 2, default: "0.0"
    t.decimal "overhead_cost", precision: 10, scale: 2, default: "0.0"
    t.decimal "total_cost", precision: 10, scale: 2, default: "0.0"
    t.string "entry_source", limit: 20, default: "manual"
    t.boolean "billable", default: true
    t.decimal "billable_rate", precision: 10, scale: 2
    t.decimal "billable_amount", precision: 10, scale: 2
    t.string "billing_status", limit: 20, default: "unbilled"
    t.bigint "invoice_id"
    t.text "description"
    t.text "internal_notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "purchase_order_id"
    t.bigint "saas_customer_id"
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

  create_table "location_pings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "site_presence_session_id", null: false
    t.bigint "worker_profile_id", null: false
    t.bigint "job_id", null: false
    t.decimal "latitude", precision: 10, scale: 7, null: false
    t.decimal "longitude", precision: 10, scale: 7, null: false
    t.decimal "accuracy", precision: 8, scale: 2
    t.decimal "altitude", precision: 10, scale: 2
    t.decimal "speed", precision: 6, scale: 2
    t.decimal "heading", precision: 5, scale: 2
    t.integer "distance_from_site"
    t.boolean "within_geofence", default: true
    t.string "source", limit: 20
    t.integer "battery_level"
    t.string "battery_state", limit: 20
    t.datetime "recorded_at", null: false
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
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sm_task_id"
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
    t.bigint "tenant_id"
    t.string "sync_key"
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
    t.bigint "tenant_id"
  end

  create_table "microsoft_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "owner_type"
    t.bigint "owner_id"
    t.string "credential_type", null: false
    t.string "name"
    t.string "client_id"
    t.text "client_secret"
    t.string "azure_tenant_id"
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
    t.integer "lock_version", default: 0, null: false
    t.boolean "is_primary", default: false, null: false
    t.bigint "tenant_id"
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

  create_table "navigation_groups", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "icon", default: "Folder"
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.boolean "is_collapsible", default: true
    t.string "visible_to_roles", default: [], array: true
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.datetime "updated_at", default: -> { "now()" }, null: false
  end

  create_table "navigation_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.bigint "visible_to_tenant_ids", default: [], array: true
  end

  create_table "ndis_addendums", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "document_type", null: false
    t.string "section_key"
    t.string "title", null: false
    t.text "content", null: false
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "notebook_activities", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "notebook_id", null: false
    t.bigint "user_id", null: false
    t.bigint "page_id"
    t.bigint "section_id"
    t.string "activity_type", null: false
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "notebook_page_attachments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "page_id", null: false
    t.bigint "uploaded_by_id"
    t.string "file_name", null: false
    t.string "content_type"
    t.string "storage_key", null: false
    t.integer "file_size"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "storage_blob_id"
  end

  create_table "notebook_pages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "section_id", null: false
    t.string "title", default: "Untitled", null: false
    t.text "content"
    t.jsonb "content_metadata", default: {}
    t.integer "position", default: 0, null: false
    t.bigint "created_by_id"
    t.bigint "last_edited_by_id"
    t.boolean "is_pinned", default: false, null: false
    t.datetime "archived_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "notebook_sections", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "notebook_id", null: false
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.string "color"
    t.datetime "archived_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "notebook_shares", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "notebook_id", null: false
    t.bigint "user_id", null: false
    t.bigint "granted_by_id"
    t.string "permission", default: "view", null: false
    t.datetime "expires_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "notebooks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.string "icon_name"
    t.string "color"
    t.bigint "owner_id", null: false
    t.string "notable_type"
    t.bigint "notable_id"
    t.boolean "is_default", default: false, null: false
    t.datetime "archived_at"
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
    t.string "link"
  end

  create_table "organizations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "slug", null: false
    t.boolean "is_active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "document_provider", null: false
    t.bigint "document_provider_credential_id"
    t.bigint "tenant_id"
    t.bigint "company_id"
  end

  create_table "page_scales", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "job_plan_id"
    t.bigint "job_plan_revision_id"
    t.integer "page_number", default: 1, null: false
    t.decimal "scale_factor", precision: 15, scale: 8
    t.decimal "reference_length_mm", precision: 15, scale: 4
    t.decimal "reference_length_px", precision: 15, scale: 4
    t.string "scale_label"
    t.jsonb "calibration_line", default: {}
    t.string "ai_detected_scale"
    t.decimal "ai_confidence", precision: 5, scale: 4
    t.bigint "calibrated_by_id"
    t.datetime "calibrated_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "document_inbox_id"
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
    t.string "storage_file_id"
    t.jsonb "proof_photos_storage_ids", default: []
    t.string "storage_item_id"
    t.bigint "invoice_blob_id"
    t.jsonb "proof_photo_blob_ids", default: [], null: false
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

  create_table "payment_links", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "invoice_id", null: false
    t.bigint "contact_id", null: false
    t.string "token", null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.string "currency", default: "AUD", null: false
    t.string "status", default: "active", null: false
    t.datetime "expires_at"
    t.datetime "paid_at"
    t.string "stripe_payment_intent_id"
    t.string "stripe_checkout_session_id"
    t.jsonb "metadata", default: {}
    t.integer "view_count", default: 0
    t.datetime "last_viewed_at"
    t.string "created_by_type"
    t.bigint "created_by_id"
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

  create_table "pdf_field_positions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "pdf_generations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "status", default: "pending", null: false
    t.string "generator_type", null: false
    t.jsonb "generator_params", default: {}, null: false
    t.bigint "user_id"
    t.bigint "tenant_id"
    t.bigint "storage_blob_id"
    t.string "result_filename"
    t.string "error_message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "performance_anomalies", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "anomaly_type", null: false
    t.string "severity", null: false
    t.string "endpoint"
    t.string "metric_name"
    t.string "table_name"
    t.float "observed_value", null: false
    t.float "expected_value"
    t.float "threshold"
    t.float "z_score"
    t.string "status", default: "open"
    t.text "description"
    t.jsonb "context", default: {}
    t.datetime "detected_at", null: false
    t.datetime "resolved_at"
    t.bigint "acknowledged_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "performance_requests", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "endpoint", null: false
    t.string "method", null: false
    t.integer "duration_ms", null: false
    t.integer "db_time_ms"
    t.integer "view_time_ms"
    t.integer "status_code"
    t.bigint "user_id"
    t.string "controller_action"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
  end

  create_table "performance_slo_snapshots", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "performance_slo_id", null: false
    t.date "snapshot_date", null: false
    t.integer "total_events", default: 0
    t.integer "good_events", default: 0
    t.integer "bad_events", default: 0
    t.float "compliance_percent"
    t.float "error_budget_remaining"
    t.float "error_budget_consumed"
    t.float "observed_value"
    t.boolean "slo_met"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "performance_slos", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "sli_type", null: false
    t.string "endpoint"
    t.string "metric_name"
    t.float "target_value", null: false
    t.string "target_unit"
    t.string "comparison", default: "lte"
    t.float "error_budget_percent", default: 0.1
    t.boolean "active", default: true
    t.string "owner"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "performance_slow_queries", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.text "query_fingerprint", null: false
    t.integer "duration_ms", null: false
    t.string "table_name"
    t.string "operation"
    t.text "caller_location"
    t.bigint "user_id"
    t.string "endpoint"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "performance_vitals", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "metric_name", null: false
    t.float "value", null: false
    t.string "page_path"
    t.string "session_id"
    t.string "user_agent"
    t.bigint "user_id"
    t.string "rating"
    t.jsonb "metadata", default: {}
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

  create_table "plan_categories", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "code"
    t.integer "sequence_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "plan_category_plan_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "plan_category_id", null: false
    t.bigint "plan_type_id", null: false
    t.integer "sequence_order", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "plan_folder_scans", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.string "storage_file_id", null: false
    t.string "file_name"
    t.datetime "file_modified_at"
    t.integer "file_size"
    t.string "status", default: "pending"
    t.bigint "job_plan_id"
    t.text "error_message"
    t.datetime "processed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "storage_item_id"
  end

  create_table "plan_identification_rules", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "plan_identifications", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_plan_id", null: false
    t.bigint "identified_plan_type_id"
    t.bigint "identified_plan_category_id"
    t.text "ocr_raw_text"
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
  end

  create_table "plan_reextractions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "plan_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "plan_uploads", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
  end

  create_table "po_template_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "po_template_pack_id", null: false
    t.string "name", null: false
    t.bigint "sm_schedule_master_id"
    t.bigint "supplier_id"
    t.string "supplier_sync_key"
    t.integer "position", default: 0, null: false
    t.decimal "budget", precision: 15, scale: 2
    t.text "notes"
    t.string "status_on_create", default: "draft"
    t.bigint "tenant_id"
    t.string "sync_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "profit_centre_id"
  end

  create_table "po_template_line_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "po_template_item_id", null: false
    t.bigint "pricebook_item_id"
    t.string "pricebook_item_code"
    t.text "description", null: false
    t.decimal "quantity", precision: 15, scale: 3, default: "1.0", null: false
    t.decimal "unit_price", precision: 15, scale: 2, default: "0.0", null: false
    t.string "gst_code", default: "GST"
    t.integer "line_number", default: 1, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
  end

  create_table "po_template_packs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "is_active", default: true, null: false
    t.integer "position", default: 0
    t.bigint "tenant_id"
    t.string "sync_key"
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sm_schedule_master_template_id"
  end

  create_table "polaris_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.text "api_key"
    t.text "api_secret"
    t.string "status", default: "pending", null: false
    t.boolean "is_active", default: true, null: false
    t.text "error_message"
    t.datetime "last_connected_at"
    t.datetime "last_error_at"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
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
    t.text "lga", default: [], array: true
    t.date "date_effective"
    t.string "user_name"
    t.bigint "tenant_id"
    t.string "sync_key"
  end

  create_table "pricebook_brands", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "display_name"
    t.string "color", default: "#6B7280"
    t.string "icon"
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.bigint "tenant_id"
    t.string "sync_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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
    t.bigint "tenant_id"
    t.string "sync_key"
  end

  create_table "pricebook_ranges", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "display_name"
    t.string "color", default: "#6B7280"
    t.string "icon"
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.bigint "tenant_id"
    t.string "sync_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "pricebooks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "item_code", null: false
    t.string "item_name", null: false
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
    t.integer "lead_time_days"
    t.integer "call_time_days"
    t.bigint "tenant_id"
    t.string "sync_key"
    t.bigint "image_storage_blob_id"
    t.bigint "spec_storage_blob_id"
    t.bigint "qr_code_storage_blob_id"
    t.bigint "brand_id"
    t.bigint "range_id"
    t.bigint "unit_of_measure_id"
    t.bigint "gst_code_id"
  end

  create_table "profit_centres", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "job_id"
    t.string "code", limit: 20, null: false
    t.string "name", limit: 100, null: false
    t.string "centre_type", limit: 30
    t.text "description"
    t.boolean "is_template", default: false
    t.boolean "active", default: true
    t.integer "sort_order", default: 0
    t.decimal "budget_amount", precision: 15, scale: 2
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "is_default", default: false, null: false
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
    t.string "period"
    t.bigint "document_type_id"
    t.string "display_name"
  end

  create_table "public_holidays", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name"
    t.date "date"
    t.string "region"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
    t.string "sync_key"
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
    t.string "colour"
    t.string "colour_code"
    t.string "spec_reference"
    t.bigint "profit_centre_id"
    t.bigint "tenant_id"
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
    t.string "source"
    t.date "due_date"
    t.bigint "sm_task_id"
    t.tsvector "searchable"
    t.decimal "labour_budget", precision: 12, scale: 2
    t.decimal "labour_actual", precision: 12, scale: 2, default: "0.0"
    t.boolean "is_labour_po", default: false
    t.datetime "budget_locked_at"
    t.bigint "budget_locked_by_id"
    t.datetime "budget_unlocked_at"
    t.bigint "budget_unlocked_by_id"
    t.string "budget_unlock_reason"
    t.bigint "tenant_id"
    t.bigint "external_invoice_id"
    t.decimal "credit_amount", precision: 15, scale: 2, default: "0.0"
    t.integer "tender_id"
  end

  create_table "quantity_variables", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "variable_name", null: false
    t.string "display_name", null: false
    t.string "category", null: false
    t.string "data_type", default: "number"
    t.string "unit_label"
    t.decimal "min_value", precision: 12, scale: 4
    t.decimal "max_value", precision: 12, scale: 4
    t.decimal "default_value", precision: 12, scale: 4
    t.jsonb "select_options", default: []
    t.string "formula"
    t.boolean "is_computed", default: false
    t.boolean "required_for_po_generation", default: false
    t.boolean "is_system_variable", default: false
    t.integer "position", default: 0
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
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

  create_table "quote_template_trade_suppliers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "quote_template_trade_id", null: false
    t.bigint "supplier_id", null: false
    t.bigint "contact_person_id"
    t.integer "position", default: 0, null: false
    t.boolean "is_preferred", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "quote_template_trades", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "quote_template_id", null: false
    t.bigint "sm_trade_id"
    t.integer "position", default: 0, null: false
    t.text "default_instructions"
    t.jsonb "required_document_types", default: []
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sm_schedule_master_id"
  end

  create_table "quote_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "is_active", default: true, null: false
    t.integer "position", default: 0, null: false
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "po_template_pack_id"
  end

  create_table "quote_trackers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "job_id", null: false
    t.bigint "sm_trade_id"
    t.bigint "supplier_id"
    t.bigint "contact_id"
    t.string "contact_email"
    t.date "requested_date"
    t.boolean "received", default: false
    t.date "date_received"
    t.string "quote_number"
    t.decimal "price_quoted", precision: 12, scale: 2
    t.date "valid_to"
    t.text "quote_request_instructions"
    t.text "estimating_notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "status", default: "draft", null: false
    t.datetime "sent_at"
    t.bigint "sent_by_id"
    t.boolean "is_best_price", default: false, null: false
    t.bigint "purchase_order_id"
    t.bigint "quote_template_id"
    t.string "email_message_id"
    t.text "response_notes"
    t.string "timeframe"
    t.integer "reminder_count", default: 0
    t.datetime "last_reminder_at"
    t.bigint "sm_schedule_master_id"
    t.bigint "sm_task_id"
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

  create_table "recipe_categories", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "code", null: false
    t.string "name", null: false
    t.text "description"
    t.bigint "parent_id"
    t.integer "position", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "recipe_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "recipe_id", null: false
    t.bigint "pricebook_item_id"
    t.string "description", null: false
    t.string "unit_of_measure", default: "ea"
    t.string "cost_type", default: "materials"
    t.decimal "base_quantity", precision: 12, scale: 4
    t.string "quantity_formula"
    t.boolean "uses_formula", default: false
    t.decimal "unit_price_override", precision: 12, scale: 2
    t.boolean "use_pricebook_price", default: true
    t.decimal "cached_unit_price", precision: 12, scale: 2
    t.decimal "cached_line_total", precision: 12, scale: 2
    t.integer "sequence_order", default: 0
    t.text "notes"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "recipe_versions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "recipe_id", null: false
    t.integer "version_number", null: false
    t.decimal "total_amount", precision: 12, scale: 2
    t.jsonb "snapshot_data"
    t.string "change_reason"
    t.bigint "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "recipes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "code", null: false
    t.string "name", null: false
    t.text "description"
    t.string "recipe_type", default: "full_assembly"
    t.string "status", default: "draft"
    t.bigint "recipe_category_id"
    t.bigint "default_supplier_id"
    t.decimal "cached_total", precision: 12, scale: 2
    t.datetime "cached_total_at"
    t.integer "version_number", default: 1
    t.text "notes"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "reconciliation_reports", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
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
    t.bigint "tenant_id"
    t.bigint "company_group_id"
  end

  create_table "referral_commissions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "referrer_contact_id", null: false
    t.bigint "customer_contact_id", null: false
    t.bigint "saas_billing_record_id", null: false
    t.string "commission_level", null: false
    t.decimal "customer_fee", precision: 12, scale: 2, null: false
    t.decimal "commission_rate", precision: 5, scale: 4, null: false
    t.decimal "commission_amount", precision: 12, scale: 2, null: false
    t.string "status", default: "pending"
    t.string "ineligible_reason"
    t.datetime "paid_at"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "revision_formats", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "sequence"
    t.boolean "is_default", default: false
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
    t.boolean "god_view_access", default: false, null: false
    t.boolean "can_approve_payments", default: false, null: false
    t.jsonb "settings", default: {}, null: false
  end

  create_table "s3_compatible_credentials", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "organization_id"
    t.string "name", null: false
    t.string "provider_type", null: false
    t.string "endpoint"
    t.string "region", null: false
    t.string "bucket", null: false
    t.string "access_key_id", null: false
    t.string "secret_access_key", null: false
    t.boolean "is_active", default: true, null: false
    t.string "status", default: "pending"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
  end

  create_table "saas_billing_records", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "contact_id", null: false
    t.date "billing_period_start", null: false
    t.date "billing_period_end", null: false
    t.decimal "turnover_reported", precision: 15, scale: 2
    t.decimal "fee_calculated", precision: 12, scale: 2
    t.decimal "effective_rate", precision: 5, scale: 4
    t.string "status", default: "pending"
    t.bigint "gl_invoice_id"
    t.jsonb "tier_breakdown", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "scheduled_emails", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "imap_credential_id"
    t.string "microsoft_credential_id"
    t.string "account_type", limit: 20
    t.string "mailbox_email"
    t.bigint "created_by_id"
    t.text "to_addresses", null: false
    t.text "cc_addresses"
    t.text "bcc_addresses"
    t.string "subject", null: false
    t.text "body", null: false
    t.jsonb "attachments", default: []
    t.string "reply_to_message_id"
    t.datetime "scheduled_for", null: false
    t.string "status", limit: 20, default: "pending", null: false
    t.datetime "sent_at"
    t.datetime "cancelled_at"
    t.text "error_message"
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

  create_table "signature_usages", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "document_type_id"
    t.bigint "job_id"
    t.datetime "signed_at", null: false
    t.string "certificate_type"
    t.string "document_name"
    t.string "purpose"
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "site_presence_sessions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "worker_profile_id", null: false
    t.bigint "job_id", null: false
    t.bigint "sm_task_id"
    t.bigint "cost_centre_id"
    t.string "session_status", limit: 20, default: "active", null: false
    t.datetime "checkin_at"
    t.decimal "latitude_checkin", precision: 10, scale: 7
    t.decimal "longitude_checkin", precision: 10, scale: 7
    t.integer "distance_from_site_checkin"
    t.bigint "checkin_photo_id"
    t.datetime "checkout_at"
    t.decimal "latitude_checkout", precision: 10, scale: 7
    t.decimal "longitude_checkout", precision: 10, scale: 7
    t.integer "distance_from_site_checkout"
    t.bigint "checkout_photo_id"
    t.boolean "face_verified_checkin", default: false
    t.boolean "face_verified_checkout", default: false
    t.decimal "face_confidence_checkin", precision: 5, scale: 2
    t.decimal "face_confidence_checkout", precision: 5, scale: 2
    t.boolean "gps_verified_checkin", default: false
    t.boolean "gps_verified_checkout", default: false
    t.boolean "site_visible_in_checkin_photo", default: false
    t.boolean "site_visible_in_checkout_photo", default: false
    t.decimal "total_hours", precision: 5, scale: 2
    t.decimal "break_minutes", precision: 5, default: "0"
    t.decimal "billable_hours", precision: 5, scale: 2
    t.string "approval_status", limit: 20, default: "pending"
    t.bigint "approved_by_id"
    t.datetime "approved_at"
    t.text "rejection_reason"
    t.jsonb "anomalies", default: []
    t.text "worker_notes"
    t.text "admin_notes"
    t.string "device_info", limit: 255
    t.string "app_version", limit: 20
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "saas_customer_id"
  end

  create_table "sm_activities", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.bigint "user_id"
    t.bigint "resource_id"
    t.bigint "sm_task_id"
    t.bigint "construction_id"
    t.string "activity_type", null: false
    t.string "trackable_type"
    t.bigint "trackable_id"
    t.text "metadata"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_comment_mentions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_comment_id", null: false
    t.bigint "user_id"
    t.bigint "resource_id"
    t.datetime "mentioned_at", null: false
    t.datetime "read_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_comments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_task_id", null: false
    t.bigint "author_id", null: false
    t.bigint "parent_id"
    t.bigint "resource_id"
    t.text "body", null: false
    t.datetime "deleted_at"
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
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "sm_recurring_task_definitions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "is_active", default: true
    t.string "status", default: "active"
    t.string "frequency", null: false
    t.integer "frequency_interval", default: 1
    t.integer "day_of_month"
    t.integer "day_of_week"
    t.date "start_date", null: false
    t.date "end_date"
    t.integer "occurrences_limit"
    t.integer "occurrences_count", default: 0
    t.integer "advance_days", default: 7
    t.date "last_generated_for_date"
    t.date "next_generation_date"
    t.string "assignment_type", default: "user"
    t.bigint "assigned_user_id"
    t.string "assigned_role"
    t.integer "default_duration_days", default: 1
    t.string "trade"
    t.string "stage"
    t.bigint "checklist_id"
    t.bigint "job_id"
    t.jsonb "skip_config", default: {}
    t.boolean "notify_on_create", default: true
    t.boolean "notify_on_due", default: false
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
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
    t.bigint "tenant_id", null: false
    t.string "sync_key"
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

  create_table "sm_schedule_master_document_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_schedule_master_id", null: false
    t.bigint "document_type_id", null: false
    t.integer "lag_days", default: 0
    t.string "assigned_role"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "sm_schedule_master_related_pos", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_schedule_master_id", null: false
    t.bigint "related_sm_schedule_master_id", null: false
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_schedule_master_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "is_default", default: false
    t.boolean "is_active", default: true
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "copied_from_id"
    t.bigint "tenant_id"
    t.string "sync_key"
  end

  create_table "sm_schedule_masters", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.integer "task_number", null: false
    t.string "name", null: false
    t.text "description"
    t.decimal "sequence_order", precision: 10, scale: 2, null: false
    t.integer "duration_days", default: 1, null: false
    t.jsonb "predecessor_ids", default: []
    t.integer "trade"
    t.integer "stage"
    t.jsonb "linked_task_ids", default: []
    t.boolean "pass_fail_enabled", default: false
    t.bigint "checklist_id"
    t.integer "order_time_days"
    t.integer "call_time_days"
    t.boolean "require_photo", default: false
    t.boolean "confirm", default: false
    t.boolean "po_required", default: false
    t.boolean "critical_po", default: false
    t.boolean "create_po_on_job_start", default: false
    t.boolean "has_subtasks", default: false
    t.integer "subtask_count"
    t.string "subtask_names", default: [], array: true
    t.string "tags", default: [], array: true
    t.string "color"
    t.boolean "is_active", default: true
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "cost_centre"
    t.boolean "supplier_confirm", default: false
    t.integer "header_gantt"
    t.jsonb "sm_template_ids", default: []
    t.boolean "hold"
    t.date "hold_date"
    t.boolean "completed", default: false
    t.date "completed_at"
    t.jsonb "predecessor_ids_backup"
    t.date "previous_manual_start_date"
    t.boolean "dependency_broken", default: false
    t.datetime "confirmed_at"
    t.datetime "supplier_confirmed_at"
    t.datetime "hold_at"
    t.bigint "po_supplier_id"
    t.jsonb "po_line_items", default: []
    t.boolean "spawn_order_task", default: false
    t.boolean "spawn_call_task", default: false
    t.bigint "spawn_scan_task_id"
    t.integer "spawn_scan_lag_days", default: 0
    t.boolean "allow_header", default: false, null: false
    t.integer "assigned_role"
    t.boolean "started", default: false
    t.boolean "start_workflow_enabled", default: false
    t.bigint "start_workflow_id"
    t.boolean "complete_workflow_enabled", default: false
    t.bigint "complete_workflow_id"
    t.boolean "is_claim_task", default: false, null: false
    t.decimal "claim_percentage", precision: 5, scale: 2
    t.string "claim_invoice_pattern"
    t.bigint "claim_invoice_template_id"
    t.bigint "claim_trading_name_id"
    t.boolean "is_variation", default: false
    t.integer "claim_sequence_number"
    t.boolean "requires_document_to_complete", default: false
    t.bigint "completion_document_type_id"
    t.bigint "sm_task_group_id"
    t.jsonb "completion_linked_task_ids", default: []
    t.string "supplier_confirmation_method"
    t.string "supplier_confirmed_contact_name"
    t.datetime "dependency_broken_at"
    t.bigint "dependency_broken_by_id"
    t.bigint "tenant_id"
    t.string "sync_key"
    t.string "task_code", limit: 50
    t.integer "tender_id"
    t.jsonb "plan_type_ids", default: []
    t.jsonb "document_ref_type_ids", default: []
  end

  create_table "sm_settings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.time "rollover_time", default: "2000-01-01 00:00:00", null: false
    t.string "rollover_timezone", limit: 50, default: "Australia/Brisbane", null: false
    t.boolean "rollover_enabled", default: true
    t.boolean "notify_on_hold", default: true
    t.boolean "notify_on_supplier_confirm", default: true
    t.boolean "notify_on_rollover", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "gantt_column_config", default: {}
    t.jsonb "schedule_master_tags", default: [], null: false
    t.jsonb "schedule_master_trades", default: []
    t.jsonb "schedule_master_stages", default: []
    t.jsonb "schedule_master_roles", default: []
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

  create_table "sm_stages", id: false, force: :cascade do |t|
    t.serial "id", null: false
    t.string "name", limit: 255, null: false
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
    t.datetime "updated_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
    t.integer "created_by"
    t.integer "updated_by"
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "sm_task_attachments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_task_id", null: false
    t.string "attachable_type", null: false
    t.bigint "attachable_id", null: false
    t.string "attachment_type", limit: 50
    t.text "notes"
    t.bigint "added_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "category", default: "info"
    t.bigint "action_item_id"
    t.string "display_name"
    t.boolean "is_source", default: false, null: false
    t.datetime "deleted_at"
    t.bigint "deleted_by_id"
    t.boolean "auto_attached", default: false, null: false
    t.bigint "source_email_attachment_id"
  end

  create_table "sm_task_document_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_task_id", null: false
    t.bigint "document_type_id", null: false
    t.integer "lag_days", default: 0
    t.string "assigned_role"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_task_groups", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "is_active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_task_notes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_task_id", null: false
    t.bigint "user_id", null: false
    t.text "content", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sm_task_photos", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_task_id"
    t.bigint "job_id"
    t.bigint "uploaded_by_id"
    t.bigint "resource_id"
    t.string "photo_url", null: false
    t.string "photo_type", limit: 20
    t.text "description"
    t.text "notes"
    t.datetime "taken_at"
    t.decimal "latitude", precision: 10, scale: 7
    t.decimal "longitude", precision: 10, scale: 7
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "is_checkin_photo", default: false
    t.boolean "is_checkout_photo", default: false
    t.boolean "face_verified", default: false
    t.jsonb "ai_analysis"
    t.string "lighting_conditions", limit: 30
    t.decimal "exif_latitude", precision: 10, scale: 7
    t.decimal "exif_longitude", precision: 10, scale: 7
    t.bigint "document_type_id"
    t.string "storage_path"
    t.string "storage_item_id"
    t.string "storage_provider", limit: 20
    t.string "migration_status", limit: 20
    t.text "migration_error"
    t.datetime "migration_started_at"
    t.datetime "migration_completed_at"
  end

  create_table "sm_tasks", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id"
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
    t.boolean "hold", default: false
    t.datetime "hold_at", precision: nil
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
    t.bigint "assigned_user_id"
    t.bigint "supplier_id"
    t.jsonb "linked_task_ids", default: []
    t.boolean "pass_fail_enabled", default: false
    t.bigint "checklist_id"
    t.integer "order_time_days"
    t.integer "call_time_days"
    t.boolean "order_reminder_sent", default: false
    t.boolean "call_reminder_sent", default: false
    t.boolean "require_photo", default: false
    t.boolean "require_confirm", default: false
    t.boolean "po_required", default: false
    t.boolean "critical_po", default: false
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sm_schedule_master_id"
    t.boolean "spawn_order_task", default: false
    t.boolean "spawn_call_task", default: false
    t.boolean "is_photo_task", default: false, null: false
    t.bigint "recurring_task_definition_id"
    t.integer "recurring_sequence"
    t.string "source_type", default: "manual"
    t.bigint "spawn_scan_task_id"
    t.integer "spawn_scan_lag_days", default: 0
    t.date "required_by"
    t.tsvector "searchable"
    t.date "hold_date"
    t.bigint "saas_customer_id"
    t.boolean "is_ticket", default: false
    t.string "ticket_priority"
    t.string "ticket_category"
    t.datetime "sla_response_due_at"
    t.datetime "sla_resolution_due_at"
    t.datetime "sla_first_response_at"
    t.boolean "customer_visible", default: true
    t.boolean "submitted_via_portal", default: false
    t.integer "trade"
    t.integer "stage"
    t.integer "assigned_role"
    t.jsonb "predecessor_ids", default: []
    t.integer "header_gantt"
    t.boolean "create_po_on_job_start", default: false
    t.boolean "has_subtasks", default: false
    t.integer "subtask_count"
    t.string "subtask_names", default: "{}"
    t.string "tags", default: "{}"
    t.string "color"
    t.boolean "is_active", default: true
    t.integer "linked_po_task_id"
    t.integer "cost_centre"
    t.boolean "completed", default: false
    t.date "previous_manual_start_date"
    t.datetime "confirmed_at"
    t.integer "po_supplier_id"
    t.jsonb "po_line_items", default: "[]"
    t.boolean "allow_header", default: false, null: false
    t.boolean "is_private", default: false
    t.boolean "started", default: false
    t.boolean "start_workflow_enabled", default: false
    t.bigint "start_workflow_id"
    t.boolean "complete_workflow_enabled", default: false
    t.bigint "complete_workflow_id"
    t.boolean "start_workflow_fired", default: false
    t.text "email_keywords"
    t.boolean "is_delegated_question", default: false, null: false
    t.bigint "job_claim_stage_id"
    t.boolean "is_claim_task", default: false, null: false
    t.decimal "claim_percentage"
    t.string "claim_invoice_pattern"
    t.integer "claim_invoice_template_id"
    t.integer "claim_trading_name_id"
    t.boolean "is_variation", default: false
    t.integer "claim_sequence_number"
    t.boolean "requires_document_to_complete", default: false
    t.bigint "completion_document_type_id"
    t.jsonb "completion_linked_task_ids", default: []
    t.integer "sm_task_group_id"
    t.string "supplier_confirmation_method"
    t.string "supplier_confirmed_contact_name"
    t.boolean "dependency_broken", default: false
    t.jsonb "predecessor_ids_backup", default: []
    t.datetime "dependency_broken_at"
    t.bigint "dependency_broken_by_id"
    t.bigint "tenant_id"
    t.jsonb "board_priority", default: {}
    t.bigint "case_id"
    t.string "response_zip_fingerprint"
    t.string "response_zip_path"
    t.datetime "response_zip_created_at"
    t.boolean "auto_attach_email_files", default: true, null: false
    t.string "sync_key"
    t.string "task_code", limit: 50
    t.integer "tender_id"
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

  create_table "sm_trades", id: false, force: :cascade do |t|
    t.serial "id", null: false
    t.string "name", limit: 255, null: false
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
    t.datetime "updated_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
    t.integer "created_by"
    t.integer "updated_by"
    t.bigint "tenant_id"
    t.string "sync_key"
  end

  create_table "sm_voice_notes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_task_id", null: false
    t.bigint "recorded_by_id"
    t.bigint "resource_id"
    t.string "audio_url", null: false
    t.integer "duration_seconds"
    t.datetime "recorded_at"
    t.text "transcription"
    t.float "transcription_confidence"
    t.datetime "transcribed_at"
    t.text "transcription_error"
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

  create_table "specification_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.bigint "job_type_id"
    t.jsonb "sections", default: []
    t.boolean "is_default", default: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
  end

  create_table "storage_billing_snapshots", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "provider", null: false
    t.string "period", null: false
    t.float "total_size_gb"
    t.integer "total_objects"
    t.float "estimated_cost"
    t.jsonb "details", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "storage_blobs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "content_hash"
    t.string "storage_path", null: false
    t.bigint "file_size"
    t.string "content_type"
    t.integer "reference_count", default: 0, null: false
    t.string "original_filename"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "verified_at"
    t.bigint "tenant_id", null: false
    t.boolean "needs_migration", default: false, null: false
    t.boolean "file_missing", default: false, null: false
  end

  create_table "stripe_configurations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.boolean "enabled", default: false, null: false
    t.string "webhook_secret_encrypted"
    t.decimal "surcharge_percentage", precision: 5, scale: 2, default: "0.0"
    t.decimal "minimum_payment", precision: 15, scale: 2, default: "0.0"
    t.jsonb "payment_methods_enabled", default: {"card"=>true, "bank_transfer"=>false}
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
  end

  create_table "stripe_payments", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "payment_link_id"
    t.bigint "invoice_id", null: false
    t.bigint "contact_id", null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.decimal "stripe_fee", precision: 15, scale: 2
    t.decimal "net_amount", precision: 15, scale: 2
    t.string "currency", default: "AUD", null: false
    t.string "status", null: false
    t.string "payment_method"
    t.string "card_brand"
    t.string "card_last4"
    t.string "stripe_payment_intent_id"
    t.string "stripe_charge_id"
    t.string "stripe_receipt_url"
    t.string "failure_reason"
    t.datetime "paid_at"
    t.datetime "refunded_at"
    t.decimal "refunded_amount", precision: 15, scale: 2
    t.jsonb "stripe_metadata", default: {}
    t.jsonb "metadata", default: {}
    t.string "ip_address"
    t.string "user_agent"
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

  create_table "suburbs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "postcode", null: false
    t.string "state", null: false
    t.string "council"
    t.integer "position"
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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
    t.bigint "tenant_id", null: false
    t.string "sync_key"
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

  create_table "sync_exclusion_rules", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id"
    t.string "rule_type", null: false
    t.string "value", null: false
    t.string "action", default: "skip", null: false
    t.string "description"
    t.boolean "is_default", default: false
    t.integer "priority", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
  end

  create_table "sync_file_states", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "desktop_client_id", null: false
    t.bigint "sync_subscription_id", null: false
    t.string "remote_path", null: false
    t.string "remote_item_id"
    t.string "file_name", null: false
    t.string "remote_etag"
    t.string "remote_content_hash"
    t.string "local_content_hash"
    t.bigint "file_size"
    t.datetime "remote_modified_at"
    t.datetime "local_modified_at"
    t.datetime "last_synced_at"
    t.string "sync_status", default: "pending_download", null: false
    t.boolean "is_placeholder", default: true
    t.boolean "is_pinned", default: false
    t.boolean "is_deleted", default: false
    t.integer "error_count", default: 0
    t.text "last_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "sync_subscriptions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "desktop_client_id", null: false
    t.string "syncable_type", null: false
    t.bigint "syncable_id", null: false
    t.boolean "include_subfolders", default: true
    t.boolean "enabled", default: true
    t.jsonb "file_type_overrides", default: {}
    t.string "delta_token"
    t.datetime "last_sync_at"
    t.integer "files_synced", default: 0
    t.bigint "bytes_synced", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "synced_email_mailboxes", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "synced_email_id", null: false
    t.string "mailbox_owner_email", null: false
    t.string "outlook_id"
    t.string "folder_name"
    t.boolean "is_read", default: false
    t.jsonb "labels", default: []
    t.bigint "microsoft_credential_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "imap_credential_id"
    t.bigint "uid"
  end

  create_table "synced_emails", id: false, force: :cascade do |t|
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
    t.bigint "ssot_owner_id"
    t.string "body_preview", limit: 500
    t.text "ai_summary"
    t.jsonb "extracted_contacts", default: {}
    t.jsonb "extracted_entities", default: {}
    t.jsonb "action_items", default: []
    t.bigint "microsoft_credential_id"
    t.string "mailbox_owner_email"
    t.string "storage_email_file_id"
    t.string "storage_email_path"
    t.bigint "contact_ids", default: [], array: true
    t.bigint "primary_contact_id"
    t.datetime "contacts_matched_at"
    t.string "source_type", default: "outlook"
    t.bigint "imap_credential_id"
    t.string "labels", default: [], array: true
    t.bigint "uid"
    t.string "direction"
    t.integer "dismissed_from_job_ids", default: [], array: true
    t.string "storage_path"
    t.string "storage_file_id"
    t.bigint "email_mailbox_id"
    t.bigint "tenant_id"
    t.boolean "content_unavailable", default: false, null: false
    t.string "content_unavailable_reason"
    t.boolean "needs_enrichment", default: false
    t.boolean "follow_up_required", default: false
    t.date "follow_up_date"
    t.string "follow_up_reason", limit: 255
    t.datetime "ai_processed_at"
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

  create_table "takeoff_layers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "job_id"
    t.string "name", null: false
    t.string "color", default: "#3B82F6", null: false
    t.integer "display_order", default: 0, null: false
    t.boolean "visible", default: true, null: false
    t.boolean "locked", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "document_inbox_id"
  end

  create_table "takeoff_measurements", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id"
    t.bigint "job_plan_id"
    t.bigint "pricebook_item_id"
    t.bigint "job_colour_selection_id"
    t.string "session_id", null: false
    t.string "measurement_type", null: false
    t.decimal "value", precision: 15, scale: 4, null: false
    t.string "unit", null: false
    t.string "category"
    t.string "subcategory"
    t.text "notes"
    t.jsonb "geometry_data", default: {}
    t.bigint "synced_to_po_id"
    t.datetime "synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "page_number"
    t.bigint "takeoff_layer_id"
    t.boolean "is_deduction", default: false, null: false
    t.bigint "parent_measurement_id"
    t.string "source", default: "unreal"
    t.string "display_label"
    t.string "color"
    t.bigint "document_inbox_id"
    t.bigint "takeoff_room_slot_id"
  end

  create_table "takeoff_room_instances", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "takeoff_template_id", null: false
    t.bigint "job_id"
    t.bigint "job_plan_id"
    t.bigint "document_inbox_id"
    t.string "name", null: false
    t.string "status", default: "in_progress", null: false
    t.integer "display_order", default: 0
    t.text "notes"
    t.bigint "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "takeoff_room_slots", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "takeoff_room_instance_id", null: false
    t.integer "step_index", null: false
    t.string "label", null: false
    t.string "measurement_type", null: false
    t.string "color"
    t.string "prompt"
    t.bigint "pricebook_item_id"
    t.bigint "measurement_id"
    t.decimal "quantity", precision: 15, scale: 4, default: "0.0"
    t.boolean "is_filled", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "takeoff_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "created_by_id"
    t.string "name", null: false
    t.string "description"
    t.string "category"
    t.boolean "is_system", default: false
    t.boolean "is_active", default: true
    t.jsonb "configuration", default: {}, null: false
    t.integer "usage_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "sync_key"
  end

  create_table "task_action_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_task_id", null: false
    t.string "text", null: false
    t.boolean "checked", default: false
    t.integer "position", default: 0
    t.bigint "checked_by_id"
    t.datetime "checked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "item_type", default: "action", null: false
    t.text "response"
    t.bigint "responded_by_id"
    t.datetime "responded_at"
    t.bigint "delegated_task_id"
    t.boolean "include_in_response", default: false
    t.bigint "parent_item_id"
  end

  create_table "task_activity_logs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_task_id", null: false
    t.bigint "user_id"
    t.string "activity_type", null: false
    t.string "field_name"
    t.text "old_value"
    t.text "new_value"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "task_contacts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "sm_task_id", null: false
    t.bigint "contact_id"
    t.bigint "user_id"
    t.string "role", limit: 50, null: false
    t.boolean "is_sender", default: false
    t.text "notes"
    t.bigint "added_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "task_followers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "sm_task_id", null: false
    t.datetime "followed_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "task_viewers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "sm_task_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "teeem_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", default: "Untitled Document", null: false
    t.jsonb "data", default: {}, null: false
    t.bigint "user_id", null: false
    t.bigint "job_id"
    t.boolean "is_template", default: false, null: false
    t.text "description"
    t.string "storage_path"
    t.string "storage_provider"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "storage_blob_id"
  end

  create_table "teeem_pdfs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", default: "Untitled PDF", null: false
    t.jsonb "data", default: {}, null: false
    t.bigint "user_id", null: false
    t.bigint "job_id"
    t.boolean "is_template", default: false, null: false
    t.text "description"
    t.integer "page_count", default: 1, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "storage_blob_id"
  end

  create_table "teeem_presentations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", default: "Untitled Presentation", null: false
    t.jsonb "data", default: {}, null: false
    t.bigint "user_id", null: false
    t.bigint "job_id"
    t.boolean "is_template", default: false, null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "storage_blob_id"
  end

  create_table "teeem_spreadsheets", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", default: "Untitled Spreadsheet", null: false
    t.jsonb "data", default: {}, null: false
    t.bigint "user_id", null: false
    t.boolean "is_template", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "job_id"
    t.text "description"
    t.bigint "storage_blob_id"
  end

  create_table "template_pack_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "template_pack_id", null: false
    t.string "item_type", null: false
    t.jsonb "data", default: {}, null: false
    t.integer "position"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "template_packs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "source_tenant_id", null: false
    t.bigint "created_by_id"
    t.string "name", null: false
    t.text "description"
    t.integer "status", default: 0
    t.integer "visibility", default: 0
    t.string "version"
    t.integer "downloads_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "tenant_settings", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "company_group_id"
    t.string "company_name"
    t.string "abn"
    t.string "acn"
    t.string "qbcc_license"
    t.string "timezone", default: "Australia/Brisbane"
    t.string "locale", default: "en-AU"
    t.string "currency", default: "AUD"
    t.string "logo_url"
    t.string "primary_color"
    t.string "secondary_color"
    t.string "accent_color"
    t.string "favicon_url"
    t.string "address"
    t.string "phone"
    t.string "email"
    t.string "website"
    t.string "billing_email"
    t.string "stripe_customer_id"
    t.bigint "default_job_type_id"
    t.bigint "default_job_status_id"
    t.bigint "default_job_stage_id"
    t.bigint "saas_customer_contact_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "gst_number"
    t.string "logo_mobile"
    t.string "logo_dark"
    t.string "bank_name"
    t.string "bank_bsb"
    t.string "bank_account_number"
    t.string "bank_account_name"
    t.string "twilio_account_sid"
    t.string "twilio_auth_token"
    t.string "twilio_phone_number"
    t.boolean "twilio_enabled"
    t.jsonb "working_days", default: "{\"friday\": true, \"monday\": true, \"sunday\": false, \"tuesday\": true, \"saturday\": false, \"thursday\": true, \"wednesday\": true}"
    t.jsonb "team_email_domains", default: []
    t.bigint "tenant_id"
    t.string "internal_email_domains"
    t.string "monitored_mailbox_pay"
    t.string "monitored_mailbox_newtask"
    t.string "monitored_mailbox_newjob"
    t.string "monitored_mailbox_newcase"
    t.string "brand_color_primary"
    t.string "brand_color_primary_foreground"
    t.string "brand_color_secondary"
    t.string "brand_color_muted"
    t.string "brand_color_accent"
    t.string "api_environment", default: "production"
    t.integer "link_expiry_days", default: 7, null: false
    t.date "gl_lock_date"
    t.jsonb "corporate_entity_types"
    t.jsonb "job_cascade_sort"
    t.string "postcode"
    t.string "default_email_signature_style", default: "modern-dark"
    t.text "custom_email_signature_html"
    t.string "custom_email_signature_name", default: "Company Custom"
    t.boolean "force_email_signature", default: false
    t.string "forced_signature_style"
    t.string "monitored_mailbox_docsort", comment: "SSoT: Email address for DocSort inbox (AI document classification)"
    t.datetime "last_config_sync_at"
    t.string "last_config_sync_by"
    t.jsonb "config_sync_table_timestamps", default: {}
    t.string "monitored_mailbox_esignature"
    t.boolean "esignature_require_email_verification", default: true, null: false
    t.jsonb "ticket_sla_response_hours", default: {"low"=>24, "high"=>4, "medium"=>8, "urgent"=>1}, comment: "SLA response time by priority (hours)"
    t.jsonb "ticket_sla_resolution_hours", default: {"low"=>168, "high"=>24, "medium"=>72, "urgent"=>4}, comment: "SLA resolution time by priority (hours)"
    t.jsonb "ticket_priorities", default: ["urgent", "high", "medium", "low"], comment: "Available ticket priority levels"
    t.jsonb "ticket_categories", default: ["bug", "feature_request", "question", "onboarding", "billing", "other"], comment: "Available ticket categories"
    t.jsonb "contact_roles", default: ["Employee", "sales", "land_agent", "Director", "Company_Secretary", "Public_Officer", "CEO", "GM", "Owner"], comment: "Valid contact roles for job assignments"
    t.jsonb "contact_entity_types", default: ["person", "company", "trust", "sole_trader", "price_only"], comment: "Valid contact entity types"
    t.jsonb "contact_employment_statuses", default: ["active", "contractor", "inactive"], comment: "Valid contact employment statuses"
    t.jsonb "email_template_categories", default: {"other"=>"Other", "quote"=>"Quote/Proposal", "formal"=>"Formal", "invoice"=>"Invoice", "meeting"=>"Meeting", "follow_up"=>"Follow-up", "quick_reply"=>"Quick Reply"}, comment: "Email template categories (key => display label)"
    t.jsonb "relationship_type_metadata", comment: "Custom relationship types (overrides ContactRelationship defaults)"
    t.jsonb "email_star_colors", default: {"red"=>{"hex"=>"#EF4444", "label"=>"Red"}, "blue"=>{"hex"=>"#3B82F6", "label"=>"Blue"}, "green"=>{"hex"=>"#22C55E", "label"=>"Green"}, "orange"=>{"hex"=>"#F97316", "label"=>"Orange"}, "purple"=>{"hex"=>"#A855F7", "label"=>"Purple"}, "yellow"=>{"hex"=>"#EAB308", "label"=>"Yellow"}}, comment: "Star color options for email states"
    t.jsonb "email_priority_levels", default: {"low"=>{"icon"=>"arrow-down", "label"=>"Low"}, "high"=>{"icon"=>"alert-circle", "label"=>"High"}, "normal"=>{"icon"=>"minus", "label"=>"Normal"}}, comment: "Email priority levels with display metadata"
    t.string "xero_tracking_category_name", default: "Job", comment: "Xero tracking category name used for job matching (e.g., 'Job', 'JOB ID')"
    t.string "po_template_variant", default: "classic", comment: "PO visual design variant (classic, modern, bold, compact, professional, construction, custom)"
    t.text "po_custom_template", comment: "Custom HTML template for PO (used when po_template_variant is 'custom')"
    t.string "deepgram_api_key"
    t.string "slack_bot_token"
    t.string "slack_signing_secret"
    t.boolean "assistant_enabled", default: false
  end

  create_table "tenant_sync_preferences", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.string "configurable_type", null: false
    t.bigint "configurable_id", null: false
    t.string "sync_mode"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "tenants", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "name", null: false
    t.string "slug", null: false
    t.string "tier", default: "shared", null: false
    t.string "environment", default: "production", null: false
    t.boolean "is_master_tenant", default: false, null: false
    t.boolean "active", default: true, null: false
    t.string "website"
    t.string "logo_url"
    t.string "primary_color"
    t.string "secondary_color"
    t.string "document_provider"
    t.bigint "document_provider_credential_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "billing_company_id"
    t.datetime "onboarding_started_at"
    t.datetime "onboarding_completed_at"
    t.bigint "onboarding_job_id"
    t.datetime "trial_starts_at"
    t.datetime "trial_ends_at"
    t.string "trial_status", default: "none"
    t.integer "trial_days", default: 30
    t.datetime "converted_at"
    t.bigint "invited_by_user_id"
  end

  create_table "tender_document_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tender_document_id", null: false
    t.string "tender_section_name", null: false
    t.string "tender_section_code"
    t.integer "section_sort_order"
    t.string "section_type", default: "priced"
    t.integer "line_number", null: false
    t.text "description", null: false
    t.decimal "quantity", precision: 15, scale: 3
    t.string "unit"
    t.decimal "unit_price", precision: 15, scale: 2
    t.decimal "total_amount", precision: 15, scale: 2
    t.string "gst_code", default: "GST"
    t.string "item_type", default: "priced"
    t.text "notes"
    t.bigint "source_purchase_order_id"
    t.string "source_po_number"
    t.bigint "source_line_item_id"
    t.string "cost_centre_name"
    t.string "trade_name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "tender_header_name"
    t.string "tender_header_code"
    t.integer "header_sort_order"
    t.text "default_note"
    t.boolean "excluded", default: false, null: false
    t.bigint "pricebook_item_id"
  end

  create_table "tender_document_templates", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.string "name", null: false
    t.text "cover_letter_html"
    t.text "terms_and_conditions_html"
    t.text "base_specification_html"
    t.text "acceptance_page_html"
    t.text "notes_html"
    t.integer "validity_days", default: 30
    t.boolean "is_default", default: true
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "default_document_types", default: []
  end

  create_table "tender_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.bigint "job_id", null: false
    t.bigint "created_by_id"
    t.string "document_number", null: false
    t.integer "version", default: 1, null: false
    t.string "status", default: "draft", null: false
    t.date "date_prepared", null: false
    t.date "valid_until"
    t.integer "validity_days", default: 30
    t.decimal "subtotal", precision: 15, scale: 2, default: "0.0"
    t.decimal "gst", precision: 15, scale: 2, default: "0.0"
    t.decimal "total", precision: 15, scale: 2, default: "0.0"
    t.string "job_name"
    t.string "job_address"
    t.string "job_code"
    t.string "client_name"
    t.string "client_address"
    t.string "client_email"
    t.string "client_phone"
    t.string "salesperson_name"
    t.text "cover_letter_html"
    t.text "terms_and_conditions_html"
    t.text "base_specification_html"
    t.text "acceptance_page_html"
    t.text "notes_html"
    t.bigint "pdf_generation_id"
    t.bigint "storage_blob_id"
    t.bigint "previous_version_id"
    t.datetime "locked_at"
    t.bigint "locked_by_id"
    t.datetime "sent_at"
    t.datetime "accepted_at"
    t.datetime "declined_at"
    t.text "revision_notes"
    t.jsonb "settings", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "council"
    t.string "estate"
    t.string "facade"
    t.string "design_name"
    t.string "specification"
    t.boolean "developer_approval"
    t.string "developer_contact"
    t.string "land_registration"
    t.string "building_contract_type"
    t.string "development_application"
    t.string "sales_centre"
    t.string "wind_classification"
    t.string "soil_classification"
    t.string "lot_address"
    t.string "plan_number"
  end

  create_table "tender_headers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.string "code", limit: 20, null: false
    t.string "name", limit: 100, null: false
    t.text "description"
    t.integer "sort_order"
    t.boolean "active", default: true
    t.jsonb "metadata", default: {}
    t.string "sync_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "header_type", limit: 20, default: "standard", null: false
    t.boolean "system_locked", default: false, null: false
  end

  create_table "tenders", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.string "code", limit: 20, null: false
    t.string "name", limit: 100, null: false
    t.text "description"
    t.string "section_type", limit: 30, default: "priced"
    t.integer "sort_order"
    t.boolean "show_line_items", default: true
    t.text "section_notes"
    t.boolean "active", default: true
    t.jsonb "metadata", default: {}
    t.string "sync_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "default_note"
    t.bigint "tender_header_id", null: false
    t.jsonb "attached_document_types", default: []
  end

  create_table "trial_invitations", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "email", null: false
    t.string "name", null: false
    t.string "company_name", null: false
    t.string "token", null: false
    t.string "status", default: "pending"
    t.bigint "invited_by_user_id"
    t.bigint "tenant_id"
    t.datetime "accepted_at"
    t.datetime "expires_at", null: false
    t.text "personal_message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "sent_from_user_id"
  end

  create_table "trinities", id: false, force: :cascade do |t|
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

  create_table "units_of_measure", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "code", limit: 20, null: false
    t.string "name", limit: 50, null: false
    t.string "description", limit: 100
    t.integer "sort_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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

  create_table "user_absences", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.date "start_date", null: false
    t.date "end_date", null: false
    t.string "absence_type", default: "leave"
    t.boolean "approved", default: false
    t.bigint "approved_by_id"
    t.datetime "approved_at"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_dictionary_words", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "word", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "document_type_id"
    t.string "file_name", null: false
    t.string "file_extension", limit: 10
    t.integer "file_size"
    t.string "content_type"
    t.string "category", limit: 20
    t.string "folder"
    t.string "storage_path"
    t.string "storage_item_id"
    t.string "storage_provider", limit: 20
    t.string "migration_status", limit: 20
    t.text "migration_error"
    t.datetime "migration_started_at"
    t.datetime "migration_completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "storage_blob_id"
  end

  create_table "user_folders", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "path", null: false
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

  create_table "user_navigation_configs", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "navigation_item_id", null: false
    t.boolean "is_collapsed", default: true
    t.datetime "created_at", default: -> { "now()" }, null: false
    t.datetime "updated_at", default: -> { "now()" }, null: false
  end

  create_table "user_permissions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "permission_id", null: false
    t.boolean "granted", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_roles", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "role_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "is_primary", default: false, null: false
  end

  create_table "user_warehouse_folder_preferences", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "scope", null: false
    t.jsonb "hidden_tabs", default: []
    t.string "default_tab"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "tab_order", default: []
  end

  create_table "users", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "email"
    t.string "password_digest"
    t.string "name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "last_chat_read_at"
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "last_login_at"
    t.string "mobile_phone"
    t.string "provider"
    t.string "uid"
    t.boolean "wphs_appointee", default: false, null: false
    t.boolean "preload_price_books", default: false, null: false
    t.bigint "user_group_id"
    t.datetime "last_seen_at"
    t.boolean "can_view_confidential_fields", default: false, null: false
    t.jsonb "email_nav_positions", default: {}
    t.string "preferred_theme", default: "light"
    t.bigint "contact_id"
    t.string "job_title"
    t.string "qbcc_licence_number"
    t.string "qbcc_licence_class"
    t.bigint "tenant_id"
    t.bigint "signature_blob_id"
    t.bigint "photo_blob_id"
    t.boolean "enable_ai_writing_assistant", default: false, null: false
    t.string "email_signature_style", default: "modern-dark"
    t.boolean "force_password_change", default: false, null: false
    t.string "username"
    t.jsonb "chat_read_timestamps", default: {}, null: false
    t.string "openclaw_api_key_digest"
    t.string "openclaw_api_key_last4"
    t.jsonb "openclaw_permissions", default: {"chat"=>false, "notes"=>false, "contacts"=>false, "job_updates"=>false}
    t.datetime "openclaw_api_key_created_at"
    t.jsonb "assistant_preferences", default: {}
    t.string "slack_user_id"
    t.integer "default_tenant_id"
  end

  create_table "vip_senders", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.string "email_address", null: false
    t.string "name"
    t.string "category"
    t.text "notes"
    t.boolean "notify_immediately", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "warehouse_documents", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "documentable_type"
    t.bigint "documentable_id"
    t.bigint "storage_blob_id"
    t.string "ui_name", null: false
    t.string "download_name"
    t.string "source_type", null: false
    t.string "original_filename"
    t.bigint "file_size"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
    t.jsonb "metadata", default: {}
    t.bigint "parent_document_id"
    t.string "linkable_type"
    t.bigint "linkable_id"
    t.uuid "version_group_id"
    t.integer "version_number", default: 1
    t.boolean "is_latest_version", default: true
    t.bigint "warehouse_folder_document_type_id"
    t.string "folder_path"
    t.bigint "warehouse_folder_id"
    t.integer "path_template_version", default: 0
    t.string "warehouse_type"
    t.integer "sort_order", default: 0
    t.date "expiry_date"
  end

  create_table "warehouse_folder_counts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "tenant_id", null: false
    t.string "folder_path_prefix", null: false
    t.integer "depth", null: false
    t.integer "document_count", default: 0
    t.datetime "stale_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "warehouse_folder_document_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "warehouse_folder_id", null: false
    t.bigint "document_type_id", null: false
    t.boolean "is_primary", default: false
    t.string "ui_name_template"
    t.string "download_name_template"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id", null: false
    t.string "sync_key"
    t.boolean "is_system", default: false, null: false
  end

  create_table "warehouse_folders", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "warehouse_type_id", null: false
    t.string "name", null: false
    t.string "folder_segment"
    t.boolean "is_system", default: false, null: false
    t.boolean "enabled", default: true, null: false
    t.integer "order_position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "parent_id"
    t.bigint "tenant_id"
    t.string "folder_path_suffix"
    t.string "tab_key"
    t.string "display_name"
    t.string "display_code", limit: 3
    t.text "description"
    t.string "tab_group", default: "documents"
    t.string "icon_name"
    t.string "display_mode", default: "both"
    t.boolean "hidden_by_default", default: false
    t.string "component_name"
    t.boolean "warehouse_enabled", default: true
    t.boolean "is_photo_category", default: false
    t.boolean "is_cad_category", default: false
    t.string "visibility_rule"
    t.string "xero_scope"
    t.string "entity_filters", default: [], array: true
    t.string "warehouse_type_override"
    t.string "ui_name_template"
    t.string "download_name_template"
    t.boolean "uses_custom_path", default: false
    t.boolean "is_mailbox", default: false, null: false
    t.string "tab_type", default: "document", null: false
    t.integer "template_version", default: 1, null: false
    t.string "sync_key"
  end

  create_table "warehouse_providers", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "provider_type", null: false
    t.string "status", default: "disconnected", null: false
    t.jsonb "connection_config", default: {}, null: false
    t.string "root_path", default: "/Shared Documents", null: false
    t.string "credential_type"
    t.bigint "credential_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "config_links", default: {}, null: false
    t.jsonb "document_routing", default: {}, null: false
    t.jsonb "virtual_warehouses", default: {}, null: false
    t.boolean "exclude_sm_tasks", default: false, null: false
    t.bigint "tenant_id", null: false
  end

  create_table "warehouse_types", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "code", null: false
    t.string "display_name", null: false
    t.text "description"
    t.string "icon_name"
    t.boolean "is_system", default: false, null: false
    t.boolean "enabled", default: true, null: false
    t.integer "order_position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "folder_path_template"
    t.bigint "tenant_id"
    t.string "source_model"
    t.jsonb "token_config", default: {}, null: false
    t.jsonb "records_config", default: {}, null: false
    t.string "sync_key"
    t.string "source_types", default: [], null: false, array: true
  end

  create_table "whs_action_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "actionable_type", null: false
    t.bigint "actionable_id", null: false
    t.bigint "assigned_to_user_id"
    t.bigint "created_by_id", null: false
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
    t.bigint "sm_task_id"
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
    t.bigint "tenant_id", null: false
    t.string "sync_key"
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
    t.bigint "tenant_id", null: false
    t.string "sync_key"
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
    t.bigint "sm_task_id"
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

  create_table "worker_profiles", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id"
    t.bigint "contact_id"
    t.string "worker_type", limit: 20, null: false
    t.string "name", limit: 100, null: false
    t.string "profile_photo_url"
    t.jsonb "face_encoding"
    t.boolean "face_verified", default: false
    t.datetime "face_verified_at"
    t.bigint "cost_centre_id"
    t.decimal "hourly_rate", precision: 10, scale: 2
    t.decimal "overtime_rate_1_5x", precision: 10, scale: 2
    t.decimal "overtime_rate_2x", precision: 10, scale: 2
    t.decimal "weekend_rate", precision: 10, scale: 2
    t.decimal "employment_cost_percent", precision: 5, scale: 2, default: "28.5"
    t.decimal "day_rate", precision: 10, scale: 2
    t.decimal "call_out_fee", precision: 10, scale: 2
    t.string "abn", limit: 20
    t.string "tax_file_number_provided", limit: 10
    t.boolean "active", default: true
    t.jsonb "metadata", default: {}
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
    t.bigint "company_id"
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

  create_table "xero_bank_transactions", id: false, force: :cascade do |t|
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
  end

  create_table "xero_chart_of_accounts", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "account_code", null: false
    t.string "account_name", null: false
    t.string "account_type"
    t.string "tax_type"
    t.text "description"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "tenant_id"
    t.string "sync_key"
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
    t.integer "lock_version", default: 0, null: false
    t.bigint "teeem_tenant_id"
  end

  create_table "xero_duplicate_groups", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "group_key", null: false
    t.string "match_type", null: false
    t.decimal "confidence_score", precision: 5, scale: 2
    t.string "status", default: "pending"
    t.integer "merge_target_id"
    t.datetime "reviewed_at"
    t.string "reviewed_by"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "xero_duplicate_items", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "duplicate_group_id", null: false
    t.bigint "contact_id", null: false
    t.boolean "is_merge_target", default: false
    t.jsonb "data_snapshot"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "xero_health_events", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "xero_credential_id"
    t.string "event_type", null: false
    t.string "from_status"
    t.string "to_status"
    t.string "trigger"
    t.text "message"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "xero_job_tracking_links", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "job_id", null: false
    t.string "tracking_option_id", null: false
    t.string "tracking_option_name"
    t.string "variant"
    t.boolean "is_primary", default: false
    t.bigint "tenant_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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

  create_table "xero_sync_sessions", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "tenant_id", null: false
    t.bigint "teeem_tenant_id"
    t.string "sync_type", default: "contacts", null: false
    t.string "status", default: "pending", null: false
    t.string "sync_mode", default: "full"
    t.datetime "modified_since"
    t.integer "total_records", default: 0
    t.integer "fetched_count", default: 0
    t.integer "processed_count", default: 0
    t.integer "created_count", default: 0
    t.integer "updated_count", default: 0
    t.integer "skipped_count", default: 0
    t.integer "error_count", default: 0
    t.integer "last_page_fetched", default: 0
    t.jsonb "checkpoint_data", default: {}
    t.datetime "started_at"
    t.datetime "completed_at"
    t.integer "duration_seconds"
    t.text "error_message"
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

  create_table "xero_tracking_options", id: false, force: :cascade do |t|
    t.bigserial "id", null: false
    t.string "xero_tracking_option_id", null: false
    t.string "xero_tracking_category_id"
    t.string "name", null: false
    t.string "status", default: "ACTIVE"
    t.bigint "tenant_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end
end

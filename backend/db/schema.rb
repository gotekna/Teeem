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

ActiveRecord::Schema[8.0].define(version: 2025_12_27_010007) do
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

  create_table "asset_depreciation_profiles", force: :cascade do |t|
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
    t.index ["asset_id"], name: "index_asset_depreciation_profiles_on_asset_id", unique: true
    t.index ["book_method"], name: "index_asset_depreciation_profiles_on_book_method"
    t.index ["tax_method"], name: "index_asset_depreciation_profiles_on_tax_method"
  end

  create_table "asset_depreciation_schedules", force: :cascade do |t|
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
    t.index ["asset_id", "financial_year"], name: "idx_asset_dep_schedules_asset_fy", unique: true
    t.index ["asset_id"], name: "index_asset_depreciation_schedules_on_asset_id"
    t.index ["finalized_by_id"], name: "index_asset_depreciation_schedules_on_finalized_by_id"
    t.index ["financial_year", "status"], name: "idx_asset_dep_schedules_fy_status"
  end

  create_table "asset_disposals", force: :cascade do |t|
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
    t.index ["asset_id"], name: "index_asset_disposals_on_asset_id", unique: true
    t.index ["disposal_date"], name: "index_asset_disposals_on_disposal_date"
    t.index ["disposal_type"], name: "index_asset_disposals_on_disposal_type"
    t.index ["replacement_asset_id"], name: "index_asset_disposals_on_replacement_asset_id"
    t.index ["user_id"], name: "index_asset_disposals_on_user_id"
  end

  create_table "asset_expenses", force: :cascade do |t|
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
    t.index ["asset_id", "expense_date"], name: "idx_asset_expenses_asset_date"
    t.index ["asset_id"], name: "index_asset_expenses_on_asset_id"
    t.index ["expense_type"], name: "index_asset_expenses_on_expense_type"
    t.index ["financial_transaction_id"], name: "index_asset_expenses_on_financial_transaction_id"
    t.index ["user_id"], name: "index_asset_expenses_on_user_id"
    t.index ["xero_invoice_id"], name: "index_asset_expenses_on_xero_invoice_id"
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

  create_table "asset_odometer_readings", force: :cascade do |t|
    t.bigint "asset_id", null: false
    t.bigint "user_id"
    t.date "reading_date", null: false
    t.integer "odometer_km"
    t.integer "hours"
    t.string "reading_type", default: "manual"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["asset_id", "reading_date"], name: "idx_asset_odometer_asset_date"
    t.index ["asset_id"], name: "index_asset_odometer_readings_on_asset_id"
    t.index ["reading_type"], name: "index_asset_odometer_readings_on_reading_type"
    t.index ["user_id"], name: "index_asset_odometer_readings_on_user_id"
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
    t.index ["abbreviation"], name: "index_assets_on_abbreviation"
    t.index ["asset_number"], name: "index_assets_on_asset_number", unique: true
    t.index ["assigned_user_id"], name: "index_assets_on_assigned_user_id"
    t.index ["company_id"], name: "index_assets_on_company_id"
    t.index ["registration_number"], name: "index_assets_on_registration_number"
  end

  create_table "ato_effective_life_categories", force: :cascade do |t|
    t.string "code", null: false
    t.string "name", null: false
    t.string "parent_code"
    t.text "description"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_ato_effective_life_categories_on_code", unique: true
    t.index ["parent_code"], name: "index_ato_effective_life_categories_on_parent_code"
  end

  create_table "ato_effective_life_rates", force: :cascade do |t|
    t.bigint "ato_effective_life_category_id", null: false
    t.string "description", null: false
    t.decimal "effective_life_years", precision: 5, scale: 2, null: false
    t.decimal "straight_line_rate", precision: 8, scale: 4
    t.decimal "diminishing_value_rate", precision: 8, scale: 4
    t.date "effective_from", null: false
    t.date "effective_until"
    t.boolean "is_division_43", default: false
    t.string "division_43_category"
    t.decimal "division_43_rate", precision: 5, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["ato_effective_life_category_id", "effective_from"], name: "idx_ato_rates_category_date"
    t.index ["ato_effective_life_category_id"], name: "idx_on_ato_effective_life_category_id_f49e398fe7"
    t.index ["description"], name: "index_ato_effective_life_rates_on_description"
    t.index ["is_division_43"], name: "index_ato_effective_life_rates_on_is_division_43"
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
    t.string "period"
    t.date "period_end_date"
    t.bigint "document_type_id"
    t.string "display_name"
    t.index ["company_code"], name: "index_balance_sheet_reports_on_company_code"
    t.index ["company_id", "period_end_date"], name: "idx_bs_reports_company_period", unique: true, where: "(period_end_date IS NOT NULL)"
    t.index ["company_id"], name: "index_balance_sheet_reports_on_company_id"
    t.index ["document_type_id"], name: "index_balance_sheet_reports_on_document_type_id"
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
    t.bigint "company_id"
    t.bigint "document_type_id"
    t.string "display_name"
    t.index ["bank_account_id", "financial_year", "month"], name: "idx_bank_reports_unique", unique: true
    t.index ["bank_code"], name: "index_bank_statement_reports_on_bank_code"
    t.index ["company_code"], name: "index_bank_statement_reports_on_company_code"
    t.index ["company_id"], name: "index_bank_statement_reports_on_company_id"
    t.index ["document_type_id"], name: "index_bank_statement_reports_on_document_type_id"
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
    t.integer "match_confidence"
    t.string "match_source", limit: 30
    t.index ["approved_by_id"], name: "index_bill_inboxes_on_approved_by_id"
    t.index ["corporate_company_id", "status"], name: "index_bill_inboxes_on_corporate_company_id_and_status"
    t.index ["corporate_company_id"], name: "index_bill_inboxes_on_corporate_company_id"
    t.index ["email_message_id"], name: "index_bill_inboxes_on_email_message_id", unique: true, where: "(email_message_id IS NOT NULL)"
    t.index ["external_invoice_id"], name: "index_bill_inboxes_on_external_invoice_id"
    t.index ["match_source"], name: "index_bill_inboxes_on_match_source"
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
    t.boolean "tpar_required", default: false
    t.string "tpar_industry_code", limit: 10
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
    t.date "gl_lock_date"
    t.text "team_email_domains", default: [], array: true
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
    t.string "consolidated_account_code"
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
    t.date "xero_start_date"
    t.index ["company_id"], name: "index_corporate_company_xero_connections_on_company_id", unique: true
    t.index ["xero_credential_id"], name: "index_corporate_company_xero_connections_on_xero_credential_id"
    t.index ["xero_tenant_id"], name: "index_corporate_company_xero_connections_on_xero_tenant_id"
  end

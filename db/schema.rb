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

ActiveRecord::Schema[8.0].define(version: 2025_11_20_221852) do
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
    t.index ["active"], name: "index_agent_definitions_on_active"
    t.index ["agent_id"], name: "index_agent_definitions_on_agent_id", unique: true
    t.index ["agent_type"], name: "index_agent_definitions_on_agent_type"
  end

  create_table "asset_insurance", force: :cascade do |t|
    t.bigint "asset_id", null: false
    t.string "insurance_company", null: false
    t.string "policy_number", null: false
    t.string "insurance_type"
    t.date "start_date", null: false
    t.date "expiry_date", null: false
    t.decimal "premium_amount", precision: 10, scale: 2
    t.string "premium_frequency"
    t.decimal "coverage_amount", precision: 12, scale: 2
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["asset_id"], name: "index_asset_insurance_on_asset_id"
    t.index ["expiry_date"], name: "index_asset_insurance_on_expiry_date"
    t.index ["policy_number"], name: "index_asset_insurance_on_policy_number"
  end

  create_table "asset_service_history", force: :cascade do |t|
    t.bigint "asset_id", null: false
    t.string "service_type", null: false
    t.date "service_date", null: false
    t.string "service_provider"
    t.text "description"
    t.decimal "cost", precision: 10, scale: 2
    t.integer "odometer_reading"
    t.date "next_service_date"
    t.integer "next_service_odometer"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["asset_id"], name: "index_asset_service_history_on_asset_id"
    t.index ["next_service_date"], name: "index_asset_service_history_on_next_service_date"
    t.index ["service_date"], name: "index_asset_service_history_on_service_date"
  end

  create_table "assets", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "description", null: false
    t.string "asset_type", null: false
    t.string "make"
    t.string "model"
    t.integer "year"
    t.string "vin"
    t.string "registration"
    t.date "purchase_date"
    t.decimal "purchase_price", precision: 12, scale: 2
    t.decimal "current_value", precision: 12, scale: 2
    t.decimal "depreciation_rate", precision: 5, scale: 2
    t.string "status", default: "active"
    t.date "disposal_date"
    t.decimal "disposal_value", precision: 12, scale: 2
    t.text "notes"
    t.string "photo_url"
    t.boolean "needs_attention", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["asset_type"], name: "index_assets_on_asset_type"
    t.index ["company_id"], name: "index_assets_on_company_id"
    t.index ["needs_attention"], name: "index_assets_on_needs_attention"
    t.index ["registration"], name: "index_assets_on_registration", unique: true, where: "(registration IS NOT NULL)"
    t.index ["status"], name: "index_assets_on_status"
  end

  create_table "bank_accounts", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "account_name", null: false
    t.string "bank_name", null: false
    t.string "bsb", null: false
    t.string "account_number", null: false
    t.string "account_type"
    t.boolean "is_primary", default: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "is_primary"], name: "index_bank_accounts_on_company_id_and_is_primary", unique: true, where: "(is_primary = true)"
    t.index ["company_id"], name: "index_bank_accounts_on_company_id"
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
    t.index ["test_id"], name: "index_bug_hunter_test_runs_on_test_id"
  end

  create_table "chat_messages", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "project_id"
    t.text "content", null: false
    t.string "channel", default: "general", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "recipient_user_id"
    t.bigint "construction_id"
    t.boolean "saved_to_job", default: false
    t.index ["channel", "created_at"], name: "index_chat_messages_on_channel_and_created_at"
    t.index ["construction_id", "channel", "created_at"], name: "index_chat_messages_on_construction_channel_created"
    t.index ["construction_id"], name: "index_chat_messages_on_construction_id"
    t.index ["created_at"], name: "index_chat_messages_on_created_at"
    t.index ["project_id", "created_at"], name: "index_chat_messages_on_project_id_and_created_at"
    t.index ["project_id"], name: "index_chat_messages_on_project_id"
    t.index ["user_id"], name: "index_chat_messages_on_user_id"
  end

  create_table "columns", force: :cascade do |t|
    t.bigint "table_id", null: false
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
    t.integer "lookup_table_id"
    t.string "lookup_display_column"
    t.boolean "is_multiple", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "has_cross_table_refs", default: false, null: false
    t.index ["has_cross_table_refs"], name: "index_columns_on_has_cross_table_refs"
    t.index ["lookup_table_id"], name: "index_columns_on_lookup_table_id"
    t.index ["table_id", "column_name"], name: "index_columns_on_table_id_and_column_name", unique: true
    t.index ["table_id"], name: "index_columns_on_table_id"
  end

  create_table "companies", force: :cascade do |t|
    t.string "name", null: false
    t.string "company_group"
    t.string "acn"
    t.string "abn"
    t.string "tfn"
    t.string "status", default: "active"
    t.date "date_incorporated"
    t.text "registered_office_address"
    t.text "principal_place_of_business"
    t.boolean "is_trustee", default: false
    t.string "trust_name"
    t.string "gst_registration_status"
    t.string "asic_username"
    t.string "asic_password"
    t.string "asic_recovery_question"
    t.string "asic_recovery_answer"
    t.date "asic_last_review_date"
    t.date "asic_next_review_date"
    t.text "notes"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["abn"], name: "index_companies_on_abn", unique: true, where: "(abn IS NOT NULL)"
    t.index ["acn"], name: "index_companies_on_acn", unique: true, where: "(acn IS NOT NULL)"
    t.index ["company_group"], name: "index_companies_on_company_group"
    t.index ["name"], name: "index_companies_on_name"
    t.index ["status"], name: "index_companies_on_status"
  end

  create_table "company_activities", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "user_id"
    t.string "activity_type", null: false
    t.text "description"
    t.jsonb "changes", default: {}
    t.string "related_type"
    t.bigint "related_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["activity_type"], name: "index_company_activities_on_activity_type"
    t.index ["company_id"], name: "index_company_activities_on_company_id"
    t.index ["created_at"], name: "index_company_activities_on_created_at"
    t.index ["related_type", "related_id"], name: "index_company_activities_on_related_type_and_related_id"
    t.index ["user_id"], name: "index_company_activities_on_user_id"
  end

  create_table "company_compliance_items", force: :cascade do |t|
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
    t.index ["company_id", "due_date", "completed"], name: "idx_on_company_id_due_date_completed_3b39c7e9ad"
    t.index ["company_id"], name: "index_company_compliance_items_on_company_id"
    t.index ["completed"], name: "index_company_compliance_items_on_completed"
    t.index ["due_date"], name: "index_company_compliance_items_on_due_date"
    t.index ["item_type"], name: "index_company_compliance_items_on_item_type"
  end

  create_table "company_directors", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "contact_id", null: false
    t.string "position"
    t.date "appointment_date"
    t.date "resignation_date"
    t.boolean "is_current", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "contact_id"], name: "index_company_directors_on_company_id_and_contact_id", unique: true, where: "(is_current = true)"
    t.index ["company_id"], name: "index_company_directors_on_company_id"
    t.index ["contact_id"], name: "index_company_directors_on_contact_id"
    t.index ["is_current"], name: "index_company_directors_on_is_current"
  end

  create_table "company_documents", force: :cascade do |t|
    t.bigint "company_id", null: false
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
    t.index ["company_id"], name: "index_company_documents_on_company_id"
    t.index ["document_date"], name: "index_company_documents_on_document_date"
    t.index ["document_type"], name: "index_company_documents_on_document_type"
  end

  create_table "company_settings", force: :cascade do |t|
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
    t.jsonb "working_days"
  end

  create_table "company_xero_accounts", force: :cascade do |t|
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
    t.index ["account_code"], name: "index_company_xero_accounts_on_account_code"
    t.index ["company_xero_connection_id"], name: "index_company_xero_accounts_on_company_xero_connection_id"
    t.index ["company_xero_connection_id"], name: "index_xero_accounts_on_connection_id"
    t.index ["is_active"], name: "index_company_xero_accounts_on_is_active"
    t.index ["xero_account_id"], name: "index_company_xero_accounts_on_xero_account_id"
  end

  create_table "company_xero_connections", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "tenant_id", null: false
    t.string "tenant_name"
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "token_expires_at"
    t.datetime "last_sync_at"
    t.boolean "connected", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_company_xero_connections_on_company_id", unique: true
    t.index ["connected"], name: "index_company_xero_connections_on_connected"
    t.index ["tenant_id"], name: "index_company_xero_connections_on_tenant_id"
  end

  create_table "construction_contacts", force: :cascade do |t|
    t.bigint "construction_id", null: false
    t.bigint "contact_id", null: false
    t.boolean "primary", default: false, null: false
    t.string "role"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["construction_id", "contact_id"], name: "index_construction_contacts_on_construction_id_and_contact_id", unique: true
    t.index ["construction_id", "primary"], name: "index_construction_contacts_on_construction_id_and_primary"
    t.index ["construction_id"], name: "index_construction_contacts_on_construction_id"
    t.index ["contact_id"], name: "index_construction_contacts_on_contact_id"
  end

  create_table "construction_documentation_tabs", force: :cascade do |t|
    t.bigint "construction_id", null: false
    t.string "name", null: false
    t.string "icon"
    t.string "color"
    t.text "description"
    t.integer "sequence_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "folder_path"
    t.index ["construction_id", "name"], name: "idx_on_construction_id_name_4a8823caab", unique: true
    t.index ["construction_id", "sequence_order"], name: "idx_on_construction_id_sequence_order_48145dc07a"
    t.index ["construction_id"], name: "index_construction_documentation_tabs_on_construction_id"
  end

  create_table "constructions", force: :cascade do |t|
    t.string "title"
    t.decimal "contract_value", precision: 15, scale: 2
    t.decimal "live_profit", precision: 15, scale: 2
    t.decimal "profit_percentage", precision: 10, scale: 2
    t.string "stage"
    t.string "status"
    t.string "ted_number"
    t.string "certifier_job_no"
    t.date "start_date"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "purchase_orders_count", default: 0, null: false
    t.string "site_supervisor_name", default: "Andrew Clement"
    t.string "site_supervisor_email"
    t.string "site_supervisor_phone", default: "0407 150 081"
    t.bigint "design_id"
    t.string "design_name"
    t.datetime "onedrive_folders_created_at"
    t.string "onedrive_folder_creation_status", default: "not_requested"
    t.decimal "latitude", precision: 10, scale: 6
    t.decimal "longitude", precision: 10, scale: 6
    t.string "location"
    t.index ["created_at"], name: "index_constructions_on_created_at"
    t.index ["design_id"], name: "index_constructions_on_design_id"
    t.index ["design_name"], name: "index_constructions_on_design_name"
    t.index ["onedrive_folder_creation_status"], name: "index_constructions_on_onedrive_folder_creation_status"
    t.index ["status"], name: "index_constructions_on_status"
  end

  create_table "contact_activities", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.string "activity_type"
    t.text "description"
    t.jsonb "metadata"
    t.string "performed_by_type", null: false
    t.bigint "performed_by_id", null: false
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

  create_table "contact_relationships", force: :cascade do |t|
    t.bigint "source_contact_id", null: false
    t.bigint "related_contact_id", null: false
    t.string "relationship_type", null: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["related_contact_id"], name: "index_contact_relationships_on_related_contact_id"
    t.index ["source_contact_id", "related_contact_id"], name: "index_contact_relationships_on_source_and_related", unique: true
    t.index ["source_contact_id"], name: "index_contact_relationships_on_source_contact_id"
  end

  create_table "contact_roles", force: :cascade do |t|
    t.string "name", null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "contact_types", default: [], comment: "Array of contact types: customer, supplier, sales, land_agent. Empty array = shared/universal role", array: true
    t.index ["contact_types"], name: "index_contact_roles_on_contact_types", using: :gin
    t.index ["name"], name: "index_contact_roles_on_name", unique: true
  end

  create_table "contact_types", force: :cascade do |t|
    t.string "name", null: false
    t.string "display_name", null: false
    t.string "tab_label"
    t.text "description"
    t.boolean "active", default: true, null: false
    t.integer "position", null: false
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.index ["name"], name: "index_contact_types_on_name", unique: true
    t.index ["position"], name: "index_contact_types_on_position"
  end

  create_table "contacts", force: :cascade do |t|
    t.integer "sys_type_id"
    t.boolean "deleted"
    t.integer "parent_id"
    t.string "parent"
    t.string "drive_id"
    t.string "folder_id"
    t.string "tax_number"
    t.string "xero_id"
    t.string "email"
    t.string "office_phone"
    t.string "mobile_phone"
    t.string "website"
    t.string "first_name"
    t.string "last_name"
    t.string "full_name"
    t.boolean "sync_with_xero"
    t.integer "contact_region_id"
    t.string "contact_region"
    t.boolean "branch"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "last_synced_at"
    t.text "xero_sync_error"
    t.string "contact_types", default: [], array: true
    t.string "primary_contact_type"
    t.integer "rating", default: 0
    t.decimal "response_rate", precision: 5, scale: 2, default: "0.0"
    t.integer "avg_response_time"
    t.text "notes"
    t.boolean "is_active", default: true
    t.string "supplier_code"
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
    t.string "company_number"
    t.string "fax_phone"
    t.string "default_sales_account"
    t.decimal "default_discount", precision: 5, scale: 2
    t.integer "sales_due_day"
    t.string "sales_due_type"
    t.decimal "accounts_receivable_outstanding", precision: 15, scale: 2
    t.decimal "accounts_receivable_overdue", precision: 15, scale: 2
    t.decimal "accounts_payable_outstanding", precision: 15, scale: 2
    t.decimal "accounts_payable_overdue", precision: 15, scale: 2
    t.boolean "portal_enabled", default: false
    t.datetime "portal_welcome_sent_at"
    t.decimal "trapid_rating", precision: 3, scale: 2
    t.integer "total_ratings_count", default: 0
    t.boolean "is_director", default: false
    t.string "director_tfn"
    t.date "director_date_of_birth"
    t.string "director_position"
    t.boolean "is_beneficial_owner", default: false
    t.decimal "shareholding_percentage", precision: 5, scale: 2
    t.index ["contact_types"], name: "index_contacts_on_contact_types", using: :gin
    t.index ["email"], name: "index_contacts_on_email"
    t.index ["is_active"], name: "index_contacts_on_is_active"
    t.index ["is_beneficial_owner"], name: "index_contacts_on_is_beneficial_owner"
    t.index ["is_director"], name: "index_contacts_on_is_director"
    t.index ["portal_enabled"], name: "index_contacts_on_portal_enabled"
    t.index ["primary_contact_type"], name: "index_contacts_on_primary_contact_type"
    t.index ["rating"], name: "index_contacts_on_rating"
    t.index ["supplier_code"], name: "index_contacts_on_supplier_code", unique: true, where: "(supplier_code IS NOT NULL)"
    t.index ["trapid_rating"], name: "index_contacts_on_trapid_rating"
    t.index ["xero_contact_number"], name: "index_contacts_on_xero_contact_number"
    t.index ["xero_contact_status"], name: "index_contacts_on_xero_contact_status"
    t.index ["xero_id", "last_synced_at"], name: "index_contacts_on_xero_id_and_last_synced_at"
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

  create_table "document_tasks", force: :cascade do |t|
    t.bigint "construction_id", null: false
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
    t.index ["construction_id"], name: "index_document_tasks_on_construction_id"
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

  create_table "emails", force: :cascade do |t|
    t.bigint "construction_id", null: false
    t.string "from_email"
    t.string "to_email"
    t.string "subject"
    t.text "body"
    t.datetime "received_at"
    t.text "raw_email"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["construction_id"], name: "index_emails_on_construction_id"
    t.index ["received_at"], name: "index_emails_on_received_at"
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
    t.bigint "construction_id"
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
    t.index ["construction_id", "status"], name: "index_estimates_on_construction_and_status"
    t.index ["construction_id"], name: "index_estimates_on_construction_id"
    t.index ["imported_at"], name: "index_estimates_on_imported_at"
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
    t.boolean "buildertrend_has"
    t.boolean "buildexact_has"
    t.boolean "jacks_has", default: false, null: false
    t.boolean "wunderbuilt_has", default: false, null: false
    t.boolean "databuild_has", default: false, null: false
    t.boolean "simpro_has", default: false, null: false
    t.boolean "smarterbuild_has", default: false, null: false
    t.boolean "clickhome_has", default: false, null: false
    t.boolean "trapid_has", default: false, null: false
    t.index ["chapter"], name: "index_feature_trackers_on_chapter"
    t.index ["sort_order"], name: "index_feature_trackers_on_sort_order"
  end

  create_table "financial_transactions", force: :cascade do |t|
    t.string "transaction_type", null: false
    t.decimal "amount", precision: 10, scale: 2, null: false
    t.date "transaction_date", null: false
    t.text "description"
    t.string "category"
    t.string "status", default: "draft", null: false
    t.bigint "construction_id"
    t.bigint "user_id", null: false
    t.bigint "company_id", null: false
    t.bigint "keepr_journal_id"
    t.string "external_system_id"
    t.string "external_system_type"
    t.datetime "synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category"], name: "index_financial_transactions_on_category"
    t.index ["company_id", "status"], name: "index_financial_transactions_on_company_id_and_status"
    t.index ["company_id", "transaction_date"], name: "idx_on_company_id_transaction_date_f27cab6995"
    t.index ["company_id"], name: "index_financial_transactions_on_company_id"
    t.index ["construction_id", "transaction_date"], name: "idx_on_construction_id_transaction_date_ea10ae6511"
    t.index ["construction_id"], name: "index_financial_transactions_on_construction_id"
    t.index ["external_system_type", "external_system_id"], name: "index_fin_trans_on_external_system"
    t.index ["keepr_journal_id"], name: "index_financial_transactions_on_keepr_journal_id"
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

  create_table "gold_standard_items", force: :cascade do |t|
    t.string "email"
    t.string "phone"
    t.boolean "is_active"
    t.decimal "discount"
    t.decimal "price"
    t.integer "quantity"
    t.string "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "whole_number"
    t.string "mobile"
    t.string "category_type"
    t.string "document_link"
    t.string "action_buttons"
    t.string "item_code"
    t.text "notes"
    t.date "start_date"
    t.string "location_coords"
    t.string "color_code"
    t.string "file_attachment"
    t.text "multi_tags"
    t.integer "assigned_user_id"
    t.decimal "total_cost", precision: 10, scale: 2
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
    t.integer "table_id"
    t.text "file_data"
    t.index ["session_key"], name: "index_import_sessions_on_session_key", unique: true
    t.index ["status"], name: "index_import_sessions_on_status"
    t.index ["table_id"], name: "index_import_sessions_on_table_id"
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

  create_table "keepr_accounts", id: :serial, force: :cascade do |t|
    t.integer "number", null: false
    t.string "ancestry"
    t.string "name", null: false
    t.integer "kind", null: false
    t.integer "keepr_group_id"
    t.string "accountable_type"
    t.integer "accountable_id"
    t.integer "keepr_tax_id"
    t.datetime "created_at", precision: nil
    t.datetime "updated_at", precision: nil
    t.index ["accountable_type", "accountable_id"], name: "index_keepr_accounts_on_accountable_type_and_accountable_id"
    t.index ["ancestry"], name: "index_keepr_accounts_on_ancestry"
    t.index ["keepr_group_id"], name: "index_keepr_accounts_on_keepr_group_id"
    t.index ["keepr_tax_id"], name: "index_keepr_accounts_on_keepr_tax_id"
    t.index ["number"], name: "index_keepr_accounts_on_number"
  end

  create_table "keepr_cost_centers", id: :serial, force: :cascade do |t|
    t.string "number", null: false
    t.string "name", null: false
    t.text "note"
  end

  create_table "keepr_groups", id: :serial, force: :cascade do |t|
    t.integer "target", null: false
    t.string "number"
    t.string "name", null: false
    t.boolean "is_result", default: false, null: false
    t.string "ancestry"
    t.index ["ancestry"], name: "index_keepr_groups_on_ancestry"
  end

  create_table "keepr_journals", id: :serial, force: :cascade do |t|
    t.string "number"
    t.date "date", null: false
    t.string "subject"
    t.string "accountable_type"
    t.integer "accountable_id"
    t.text "note"
    t.boolean "permanent", default: false, null: false
    t.datetime "created_at", precision: nil
    t.datetime "updated_at", precision: nil
    t.index ["accountable_type", "accountable_id"], name: "index_keepr_journals_on_accountable_type_and_accountable_id"
    t.index ["date"], name: "index_keepr_journals_on_date"
  end

  create_table "keepr_postings", id: :serial, force: :cascade do |t|
    t.integer "keepr_account_id", null: false
    t.integer "keepr_journal_id", null: false
    t.decimal "amount", precision: 8, scale: 2, null: false
    t.integer "keepr_cost_center_id"
    t.string "accountable_type"
    t.integer "accountable_id"
    t.index ["accountable_type", "accountable_id"], name: "index_keepr_postings_on_accountable_type_and_accountable_id"
    t.index ["keepr_account_id"], name: "index_keepr_postings_on_keepr_account_id"
    t.index ["keepr_cost_center_id"], name: "index_keepr_postings_on_keepr_cost_center_id"
    t.index ["keepr_journal_id"], name: "index_keepr_postings_on_keepr_journal_id"
  end

  create_table "keepr_taxes", id: :serial, force: :cascade do |t|
    t.string "name", null: false
    t.string "description"
    t.decimal "value", precision: 8, scale: 2, null: false
    t.integer "keepr_account_id", null: false
    t.index ["keepr_account_id"], name: "index_keepr_taxes_on_keepr_account_id"
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

  create_table "maintenance_requests", force: :cascade do |t|
    t.bigint "construction_id", null: false
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
    t.index ["construction_id", "status"], name: "index_maintenance_requests_on_construction_id_and_status"
    t.index ["construction_id"], name: "index_maintenance_requests_on_construction_id"
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
    t.index ["completed"], name: "index_meeting_agenda_items_on_completed"
    t.index ["created_task_id"], name: "index_meeting_agenda_items_on_created_task_id"
    t.index ["meeting_id", "sequence_order"], name: "index_meeting_agenda_items_on_meeting_id_and_sequence_order"
    t.index ["meeting_id"], name: "index_meeting_agenda_items_on_meeting_id"
    t.index ["presenter_id"], name: "index_meeting_agenda_items_on_presenter_id"
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
    t.bigint "construction_id", null: false
    t.bigint "created_by_id", null: false
    t.text "notes"
    t.string "video_url"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "meeting_type_id", null: false
    t.index ["construction_id", "start_time"], name: "index_meetings_on_construction_id_and_start_time"
    t.index ["construction_id"], name: "index_meetings_on_construction_id"
    t.index ["created_by_id"], name: "index_meetings_on_created_by_id"
    t.index ["meeting_type"], name: "index_meetings_on_meeting_type"
    t.index ["meeting_type_id"], name: "index_meetings_on_meeting_type_id"
    t.index ["start_time"], name: "index_meetings_on_start_time"
    t.index ["status"], name: "index_meetings_on_status"
  end

  create_table "one_drive_credentials", force: :cascade do |t|
    t.bigint "construction_id", null: false
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "token_expires_at"
    t.string "drive_id"
    t.string "root_folder_id"
    t.string "folder_path"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["construction_id"], name: "index_one_drive_credentials_on_construction_id", unique: true
    t.index ["drive_id"], name: "index_one_drive_credentials_on_drive_id"
    t.index ["token_expires_at"], name: "index_one_drive_credentials_on_token_expires_at"
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
    t.index ["connected_by_id"], name: "index_organization_one_drive_credentials_on_connected_by_id"
    t.index ["is_active"], name: "index_organization_one_drive_credentials_on_is_active", unique: true, where: "(is_active = true)"
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
  end

  create_table "outlook_credentials", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "expires_at"
    t.string "email"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_outlook_credentials_on_user_id"
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

  create_table "permissions", force: :cascade do |t|
    t.string "name"
    t.text "description"
    t.string "category"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "enabled"
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
    t.index ["created_at"], name: "index_price_histories_on_created_at"
    t.index ["pricebook_item_id", "supplier_id", "new_price", "created_at"], name: "index_price_histories_on_unique_combination", unique: true, comment: "Prevents duplicate price history entries from race conditions"
    t.index ["pricebook_item_id"], name: "index_price_histories_on_pricebook_item_id"
    t.index ["supplier_id"], name: "index_price_histories_on_supplier_id"
  end

  create_table "pricebook_items", force: :cascade do |t|
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
    t.index ["category", "is_active", "supplier_id"], name: "index_pricebook_items_on_category_active_supplier"
    t.index ["category"], name: "index_pricebook_items_on_category"
    t.index ["default_supplier_id"], name: "index_pricebook_items_on_default_supplier_id"
    t.index ["image_fetch_status"], name: "index_pricebook_items_on_image_fetch_status"
    t.index ["is_active"], name: "index_pricebook_items_on_is_active"
    t.index ["item_code"], name: "index_pricebook_items_on_item_code", unique: true
    t.index ["needs_pricing_review"], name: "index_pricebook_items_on_needs_pricing_review"
    t.index ["price_last_updated_at"], name: "index_pricebook_items_on_price_last_updated_at"
    t.index ["searchable_text"], name: "idx_pricebook_search", using: :gin
    t.index ["supplier_id"], name: "index_pricebook_items_on_supplier_id"
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
    t.string "response_type"
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
    t.bigint "construction_id", null: false
    t.datetime "generated_at"
    t.index ["construction_id"], name: "index_projects_on_construction_id"
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
    t.index ["pricebook_item_id"], name: "index_purchase_order_line_items_on_pricebook_item_id"
    t.index ["purchase_order_id", "line_number"], name: "index_po_line_items_on_po_and_line_num"
    t.index ["purchase_order_id"], name: "index_purchase_order_line_items_on_purchase_order_id"
  end

  create_table "purchase_orders", force: :cascade do |t|
    t.string "purchase_order_number", null: false
    t.bigint "construction_id", null: false
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
    t.index ["arrived_at"], name: "index_purchase_orders_on_arrived_at"
    t.index ["completed_at"], name: "index_purchase_orders_on_completed_at"
    t.index ["construction_id", "status"], name: "index_purchase_orders_on_construction_and_status"
    t.index ["construction_id"], name: "index_purchase_orders_on_construction_id"
    t.index ["creates_schedule_tasks"], name: "index_purchase_orders_on_creates_schedule_tasks"
    t.index ["estimate_id"], name: "index_purchase_orders_on_estimate_id"
    t.index ["payment_status"], name: "index_purchase_orders_on_payment_status"
    t.index ["purchase_order_number"], name: "index_purchase_orders_on_purchase_order_number", unique: true
    t.index ["quote_response_id"], name: "index_purchase_orders_on_quote_response_id"
    t.index ["required_date"], name: "index_purchase_orders_on_required_date"
    t.index ["required_on_site_date"], name: "index_purchase_orders_on_required_on_site_date"
    t.index ["status"], name: "index_purchase_orders_on_status"
    t.index ["supplier_id"], name: "index_purchase_orders_on_supplier_id"
    t.index ["visible_to_supplier"], name: "index_purchase_orders_on_visible_to_supplier"
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
    t.bigint "construction_id", null: false
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
    t.index ["construction_id", "status"], name: "index_quote_requests_on_construction_id_and_status"
    t.index ["construction_id"], name: "index_quote_requests_on_construction_id"
    t.index ["created_at"], name: "index_quote_requests_on_created_at"
    t.index ["created_by_id"], name: "index_quote_requests_on_created_by_id"
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
    t.bigint "construction_id", null: false
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
    t.index ["construction_id", "date"], name: "index_rain_logs_on_construction_id_and_date", unique: true
    t.index ["construction_id"], name: "index_rain_logs_on_construction_id"
    t.index ["created_by_user_id"], name: "index_rain_logs_on_created_by_user_id"
    t.index ["date"], name: "index_rain_logs_on_date"
    t.index ["source"], name: "index_rain_logs_on_source"
  end

  create_table "role_permissions", force: :cascade do |t|
    t.string "role"
    t.integer "permission_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "roles", force: :cascade do |t|
    t.string "name", null: false
    t.string "display_name", null: false
    t.text "description"
    t.boolean "active", default: true, null: false
    t.integer "position", null: false
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
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
    t.string "response_type"
    t.text "response_note"
    t.string "response_photo_url"
    t.index ["is_completed"], name: "index_schedule_task_checklist_items_on_is_completed"
    t.index ["schedule_task_id", "sequence_order"], name: "idx_on_schedule_task_id_sequence_order_bbbbb75501"
    t.index ["schedule_task_id"], name: "index_schedule_task_checklist_items_on_schedule_task_id"
  end

  create_table "schedule_tasks", force: :cascade do |t|
    t.bigint "construction_id", null: false
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
    t.index ["construction_id", "matched_to_po"], name: "index_schedule_tasks_on_construction_id_and_matched_to_po"
    t.index ["construction_id"], name: "index_schedule_tasks_on_construction_id"
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
    t.string "assigned_user_id"
    t.integer "documentation_category_ids", default: [], array: true
    t.text "linked_task_ids", default: "[]"
    t.integer "linked_template_id"
    t.integer "supervisor_checklist_template_ids", default: [], array: true
    t.jsonb "auto_complete_task_ids", default: [], null: false
    t.jsonb "subtask_template_ids", default: [], null: false
    t.boolean "manual_task", default: false, null: false
    t.boolean "allow_multiple_instances", default: false, null: false
    t.boolean "order_required", default: false, null: false
    t.boolean "call_up_required", default: false, null: false
    t.boolean "plan_required", default: false, null: false
    t.integer "duration", default: 0, null: false
    t.integer "start_date", default: 0, null: false
    t.boolean "manually_positioned", default: false, null: false
    t.boolean "confirm", default: false, null: false
    t.boolean "supplier_confirm", default: false, null: false
    t.boolean "start", default: false, null: false
    t.boolean "complete", default: false, null: false
    t.boolean "dependencies_broken", default: false, null: false
    t.jsonb "broken_predecessor_ids", default: [], null: false
    t.index ["documentation_category_ids"], name: "index_schedule_template_rows_on_documentation_category_ids", using: :gin
    t.index ["schedule_template_id", "sequence_order"], name: "idx_on_schedule_template_id_sequence_order_1bea5d762b"
    t.index ["schedule_template_id"], name: "index_schedule_template_rows_on_schedule_template_id"
    t.index ["sequence_order"], name: "index_schedule_template_rows_on_sequence_order"
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

  create_table "supervisor_checklist_templates", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.string "category"
    t.integer "sequence_order", default: 0
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "response_type"
    t.index ["category"], name: "index_supervisor_checklist_templates_on_category"
    t.index ["name"], name: "index_supervisor_checklist_templates_on_name", unique: true
    t.index ["sequence_order"], name: "index_supervisor_checklist_templates_on_sequence_order"
  end

  create_table "supplier_contacts", force: :cascade do |t|
    t.bigint "supplier_id", null: false
    t.bigint "contact_id", null: false
    t.boolean "is_primary", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contact_id"], name: "index_supplier_contacts_on_contact_id"
    t.index ["supplier_id", "contact_id"], name: "index_supplier_contacts_on_supplier_id_and_contact_id", unique: true
    t.index ["supplier_id"], name: "index_supplier_contacts_on_supplier_id"
  end

  create_table "supplier_ratings", force: :cascade do |t|
    t.bigint "contact_id", null: false
    t.bigint "rated_by_user_id", null: false
    t.bigint "construction_id"
    t.bigint "purchase_order_id"
    t.integer "quality_rating"
    t.integer "timeliness_rating"
    t.integer "communication_rating"
    t.integer "professionalism_rating"
    t.integer "value_rating"
    t.decimal "overall_rating", precision: 3, scale: 2
    t.text "positive_feedback"
    t.text "areas_for_improvement"
    t.text "internal_notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["construction_id"], name: "index_supplier_ratings_on_construction_id"
    t.index ["contact_id", "created_at"], name: "index_supplier_ratings_on_contact_id_and_created_at"
    t.index ["contact_id"], name: "index_supplier_ratings_on_contact_id"
    t.index ["purchase_order_id"], name: "index_supplier_ratings_on_purchase_order_id"
    t.index ["rated_by_user_id"], name: "index_supplier_ratings_on_rated_by_user_id"
  end

  create_table "suppliers", force: :cascade do |t|
    t.string "name", null: false
    t.string "contact_person"
    t.string "email"
    t.string "phone"
    t.text "address"
    t.integer "rating", default: 0
    t.decimal "response_rate", precision: 5, scale: 2, default: "0.0"
    t.integer "avg_response_time"
    t.text "notes"
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "contact_id"
    t.decimal "confidence_score", precision: 5, scale: 4
    t.string "match_type"
    t.boolean "is_verified", default: false
    t.string "original_name"
    t.string "contact_name"
    t.string "contact_number"
    t.string "supplier_code"
    t.text "trade_categories"
    t.text "is_default_for_trades"
    t.decimal "markup_percentage", precision: 5, scale: 2, default: "0.0"
    t.integer "purchase_orders_count", default: 0, null: false
    t.index ["contact_id"], name: "index_suppliers_on_contact_id"
    t.index ["is_active"], name: "index_suppliers_on_is_active"
    t.index ["is_verified"], name: "index_suppliers_on_is_verified"
    t.index ["match_type"], name: "index_suppliers_on_match_type"
    t.index ["name"], name: "index_suppliers_on_name", unique: true
    t.index ["supplier_code"], name: "index_suppliers_on_supplier_code", unique: true
  end

  create_table "table_protections", force: :cascade do |t|
    t.string "table_name", null: false
    t.boolean "is_protected", default: true, null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["table_name"], name: "index_table_protections_on_table_name", unique: true
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
    t.boolean "is_live", default: false, null: false
    t.string "slug"
    t.index ["database_table_name"], name: "index_tables_on_database_table_name", unique: true
    t.index ["slug"], name: "index_tables_on_slug", unique: true
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
    t.index ["chapter_number", "section_number", "category"], name: "idx_trinity_unique_section", unique: true, where: "(section_number IS NOT NULL)"
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
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "variable_rule"
    t.boolean "is_active", default: true
    t.index ["variable_name"], name: "index_unreal_variables_on_variable_name", unique: true
  end

  create_table "user_import_1761885699_f0f78b8e7fc2f1fc_78992af1", force: :cascade do |t|
    t.date "sys_type_id"
    t.string "deleted"
    t.string "parent_id"
    t.string "parent"
    t.string "parenttype"
    t.string "drive_id"
    t.date "folder_id"
    t.string "code"
    t.string "description"
    t.string "unit"
    t.decimal "range_id", precision: 15, scale: 2
    t.string "range"
    t.decimal "rangetype", precision: 15, scale: 2
    t.date "colour_spec_id"
    t.string "colour_spec"
    t.date "colour_spectype"
    t.decimal "tedmodel_id", precision: 15, scale: 2
    t.string "tedmodel"
    t.date "tedmodeltype"
    t.decimal "price", precision: 15, scale: 2
    t.string "default_supplier"
    t.string "brand_linked"
    t.string "budget_zone"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_import_1761885699_f0f78b8e7fc2f1fc_e3560d09", force: :cascade do |t|
    t.date "sys_type_id"
    t.string "deleted"
    t.string "parent_id"
    t.string "parent"
    t.string "parenttype"
    t.string "drive_id"
    t.date "folder_id"
    t.string "code"
    t.string "description"
    t.string "unit"
    t.decimal "range_id", precision: 15, scale: 2
    t.string "range"
    t.decimal "rangetype", precision: 15, scale: 2
    t.date "colour_spec_id"
    t.string "colour_spec"
    t.date "colour_spectype"
    t.decimal "tedmodel_id", precision: 15, scale: 2
    t.string "tedmodel"
    t.date "tedmodeltype"
    t.decimal "price", precision: 15, scale: 2
    t.string "default_supplier"
    t.string "brand_linked"
    t.string "budget_zone"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_import_1762054183_c576571c2be177ce_c59dc239", force: :cascade do |t|
    t.date "sys_type_id"
    t.string "deleted"
    t.string "parent_id"
    t.string "parent"
    t.string "parenttype"
    t.string "drive_id"
    t.date "folder_id"
    t.string "code"
    t.string "description"
    t.string "unit"
    t.decimal "range_id", precision: 15, scale: 2
    t.string "range"
    t.decimal "rangetype", precision: 15, scale: 2
    t.date "colour_spec_id"
    t.string "colour_spec"
    t.date "colour_spectype"
    t.decimal "tedmodel_id", precision: 15, scale: 2
    t.string "tedmodel"
    t.date "tedmodeltype"
    t.decimal "price", precision: 15, scale: 2
    t.string "default_supplier"
    t.string "brand_linked"
    t.string "budget_zone"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_import_1762157582_8e8e2d2b69a47e74_4b7d5585", force: :cascade do |t|
    t.string "item_code"
    t.string "item_name"
    t.string "category"
    t.string "unit_of_measure"
    t.decimal "current_price", precision: 15, scale: 2
    t.string "supplier_name"
    t.string "brand"
    t.string "notes"
    t.date "last_updated"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_import_1762215941_806ddfcf23a9a9f4_b7b8c8ac", force: :cascade do |t|
    t.decimal "price", precision: 15, scale: 2
    t.date "effective_date"
    t.string "display_field"
    t.string "pricebook_id"
    t.string "pricebook"
    t.string "pricebooktype"
    t.boolean "default_supplier"
    t.string "supplier_trade_id"
    t.string "supplier_trade"
    t.string "product_id"
    t.string "contact_region"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_permissions", force: :cascade do |t|
    t.integer "user_id"
    t.integer "permission_id"
    t.boolean "granted"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_untitled_table_3b80ee42", force: :cascade do |t|
    t.string "address"
    t.decimal "contract_price", precision: 15, scale: 2
    t.string "test_phone2"
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
    t.string "assigned_role"
    t.datetime "last_login_at"
    t.string "mobile_phone"
    t.string "provider"
    t.string "uid"
    t.text "oauth_token"
    t.datetime "oauth_expires_at"
    t.boolean "wphs_appointee", default: false, null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["role"], name: "index_users_on_role"
    t.index ["wphs_appointee"], name: "index_users_on_wphs_appointee"
  end

  create_table "versions", force: :cascade do |t|
    t.integer "current_version", default: 101, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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
    t.index ["actionable_type", "actionable_id"], name: "index_whs_action_items_on_actionable"
    t.index ["assigned_to_user_id"], name: "index_whs_action_items_on_assigned_to_user_id"
    t.index ["created_by_id"], name: "index_whs_action_items_on_created_by_id"
    t.index ["due_date"], name: "index_whs_action_items_on_due_date"
    t.index ["priority"], name: "index_whs_action_items_on_priority"
    t.index ["project_task_id"], name: "index_whs_action_items_on_project_task_id"
    t.index ["status"], name: "index_whs_action_items_on_status"
  end

  create_table "whs_incidents", force: :cascade do |t|
    t.bigint "construction_id"
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
    t.index ["construction_id", "status"], name: "index_whs_incidents_on_construction_id_and_status"
    t.index ["construction_id"], name: "index_whs_incidents_on_construction_id"
    t.index ["incident_category"], name: "index_whs_incidents_on_incident_category"
    t.index ["incident_date"], name: "index_whs_incidents_on_incident_date"
    t.index ["incident_number"], name: "index_whs_incidents_on_incident_number", unique: true
    t.index ["investigated_by_user_id"], name: "index_whs_incidents_on_investigated_by_user_id"
    t.index ["reported_by_user_id"], name: "index_whs_incidents_on_reported_by_user_id"
    t.index ["severity_level"], name: "index_whs_incidents_on_severity_level"
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
    t.bigint "construction_id"
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
    t.index ["construction_id"], name: "index_whs_inductions_on_construction_id"
    t.index ["expiry_date"], name: "index_whs_inductions_on_expiry_date"
    t.index ["status"], name: "index_whs_inductions_on_status"
    t.index ["user_id"], name: "index_whs_inductions_on_user_id"
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
    t.bigint "construction_id"
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
    t.index ["construction_id", "status"], name: "index_whs_inspections_on_construction_id_and_status"
    t.index ["construction_id"], name: "index_whs_inspections_on_construction_id"
    t.index ["created_by_id"], name: "index_whs_inspections_on_created_by_id"
    t.index ["critical_issues_found"], name: "index_whs_inspections_on_critical_issues_found"
    t.index ["inspection_number"], name: "index_whs_inspections_on_inspection_number", unique: true
    t.index ["inspection_type"], name: "index_whs_inspections_on_inspection_type"
    t.index ["inspector_user_id"], name: "index_whs_inspections_on_inspector_user_id"
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
    t.bigint "construction_id"
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
    t.index ["approved_by_id"], name: "index_whs_swms_on_approved_by_id"
    t.index ["company_wide"], name: "index_whs_swms_on_company_wide"
    t.index ["construction_id", "status"], name: "index_whs_swms_on_construction_id_and_status"
    t.index ["construction_id"], name: "index_whs_swms_on_construction_id"
    t.index ["created_by_id"], name: "index_whs_swms_on_created_by_id"
    t.index ["high_risk_type"], name: "index_whs_swms_on_high_risk_type"
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

  create_table "workflow_definitions", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.string "workflow_type", null: false
    t.jsonb "config", default: {}, null: false
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active"], name: "index_workflow_definitions_on_active"
    t.index ["workflow_type"], name: "index_workflow_definitions_on_workflow_type"
  end

  create_table "workflow_instances", force: :cascade do |t|
    t.bigint "workflow_definition_id", null: false
    t.string "subject_type", null: false
    t.bigint "subject_id", null: false
    t.string "status", default: "pending", null: false
    t.string "current_step"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["status"], name: "index_workflow_instances_on_status"
    t.index ["subject_type", "subject_id"], name: "index_workflow_instances_on_subject"
    t.index ["subject_type", "subject_id"], name: "index_workflow_instances_on_subject_type_and_subject_id"
    t.index ["workflow_definition_id"], name: "index_workflow_instances_on_workflow_definition_id"
  end

  create_table "workflow_steps", force: :cascade do |t|
    t.bigint "workflow_instance_id", null: false
    t.string "step_name", null: false
    t.string "status", default: "pending", null: false
    t.string "assigned_to_type"
    t.bigint "assigned_to_id"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.jsonb "data", default: {}
    t.text "comment"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["assigned_to_type", "assigned_to_id"], name: "index_workflow_steps_on_assigned_to"
    t.index ["assigned_to_type", "assigned_to_id"], name: "index_workflow_steps_on_assigned_to_type_and_assigned_to_id"
    t.index ["status"], name: "index_workflow_steps_on_status"
    t.index ["workflow_instance_id"], name: "index_workflow_steps_on_workflow_instance_id"
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

  create_table "xero_credentials", force: :cascade do |t|
    t.string "access_token", null: false
    t.string "refresh_token", null: false
    t.datetime "expires_at", null: false
    t.string "tenant_id", null: false
    t.string "tenant_name"
    t.string "tenant_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tenant_id"], name: "index_xero_credentials_on_tenant_id"
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
  add_foreign_key "account_mappings", "keepr_accounts"
  add_foreign_key "accounting_integrations", "contacts"
  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "asset_insurance", "assets"
  add_foreign_key "asset_service_history", "assets"
  add_foreign_key "assets", "companies"
  add_foreign_key "bank_accounts", "companies"
  add_foreign_key "chat_messages", "constructions"
  add_foreign_key "chat_messages", "projects"
  add_foreign_key "chat_messages", "users"
  add_foreign_key "columns", "tables"
  add_foreign_key "company_activities", "companies"
  add_foreign_key "company_activities", "users"
  add_foreign_key "company_compliance_items", "companies"
  add_foreign_key "company_directors", "companies"
  add_foreign_key "company_directors", "contacts"
  add_foreign_key "company_documents", "companies"
  add_foreign_key "company_xero_accounts", "company_xero_connections"
  add_foreign_key "company_xero_connections", "companies"
  add_foreign_key "construction_contacts", "constructions"
  add_foreign_key "construction_contacts", "contacts"
  add_foreign_key "construction_documentation_tabs", "constructions"
  add_foreign_key "constructions", "designs"
  add_foreign_key "contact_activities", "contacts"
  add_foreign_key "contact_addresses", "contacts"
  add_foreign_key "contact_group_memberships", "contact_groups"
  add_foreign_key "contact_group_memberships", "contacts"
  add_foreign_key "contact_persons", "contacts"
  add_foreign_key "contact_relationships", "contacts", column: "related_contact_id"
  add_foreign_key "contact_relationships", "contacts", column: "source_contact_id"
  add_foreign_key "document_tasks", "constructions"
  add_foreign_key "emails", "constructions"
  add_foreign_key "estimate_line_items", "estimates"
  add_foreign_key "estimate_reviews", "estimates"
  add_foreign_key "estimates", "constructions"
  add_foreign_key "financial_transactions", "companies"
  add_foreign_key "financial_transactions", "constructions"
  add_foreign_key "financial_transactions", "keepr_journals"
  add_foreign_key "financial_transactions", "users"
  add_foreign_key "folder_template_items", "folder_template_items", column: "parent_id"
  add_foreign_key "folder_template_items", "folder_templates"
  add_foreign_key "folder_templates", "users", column: "created_by_id"
  add_foreign_key "grok_plans", "users"
  add_foreign_key "kudos_events", "purchase_orders"
  add_foreign_key "kudos_events", "quote_responses"
  add_foreign_key "kudos_events", "subcontractor_accounts"
  add_foreign_key "maintenance_requests", "constructions"
  add_foreign_key "maintenance_requests", "contacts", column: "supplier_contact_id"
  add_foreign_key "maintenance_requests", "purchase_orders"
  add_foreign_key "maintenance_requests", "users", column: "reported_by_user_id"
  add_foreign_key "meeting_agenda_items", "meetings"
  add_foreign_key "meeting_agenda_items", "project_tasks", column: "created_task_id"
  add_foreign_key "meeting_agenda_items", "users", column: "presenter_id"
  add_foreign_key "meeting_participants", "contacts"
  add_foreign_key "meeting_participants", "meetings"
  add_foreign_key "meeting_participants", "users"
  add_foreign_key "meetings", "constructions"
  add_foreign_key "meetings", "meeting_types"
  add_foreign_key "meetings", "users", column: "created_by_id"
  add_foreign_key "one_drive_credentials", "constructions"
  add_foreign_key "organization_one_drive_credentials", "users", column: "connected_by_id"
  add_foreign_key "outlook_credentials", "users"
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
  add_foreign_key "portal_access_logs", "portal_users"
  add_foreign_key "portal_users", "contacts"
  add_foreign_key "price_histories", "contacts", column: "supplier_id", name: "fk_rails_price_histories_contact"
  add_foreign_key "price_histories", "pricebook_items"
  add_foreign_key "pricebook_items", "contacts", column: "default_supplier_id", name: "fk_rails_pricebook_items_default_supplier"
  add_foreign_key "pricebook_items", "contacts", column: "supplier_id", name: "fk_rails_pricebook_items_contact"
  add_foreign_key "project_task_checklist_items", "project_tasks"
  add_foreign_key "project_tasks", "project_tasks", column: "parent_task_id"
  add_foreign_key "project_tasks", "projects"
  add_foreign_key "project_tasks", "purchase_orders"
  add_foreign_key "project_tasks", "schedule_template_rows"
  add_foreign_key "project_tasks", "task_templates"
  add_foreign_key "project_tasks", "users", column: "assigned_to_id"
  add_foreign_key "project_tasks", "users", column: "supervisor_checked_by_id"
  add_foreign_key "projects", "constructions"
  add_foreign_key "projects", "users", column: "project_manager_id"
  add_foreign_key "purchase_order_documents", "document_tasks"
  add_foreign_key "purchase_order_documents", "purchase_orders"
  add_foreign_key "purchase_order_line_items", "pricebook_items"
  add_foreign_key "purchase_order_line_items", "purchase_orders"
  add_foreign_key "purchase_orders", "constructions"
  add_foreign_key "purchase_orders", "contacts", column: "supplier_id", name: "fk_rails_purchase_orders_contact"
  add_foreign_key "purchase_orders", "estimates"
  add_foreign_key "purchase_orders", "quote_responses"
  add_foreign_key "quote_request_contacts", "contacts"
  add_foreign_key "quote_request_contacts", "quote_requests"
  add_foreign_key "quote_requests", "constructions"
  add_foreign_key "quote_requests", "quote_responses", column: "selected_quote_response_id"
  add_foreign_key "quote_requests", "users", column: "created_by_id"
  add_foreign_key "quote_responses", "contacts"
  add_foreign_key "quote_responses", "portal_users", column: "responded_by_portal_user_id"
  add_foreign_key "quote_responses", "quote_requests"
  add_foreign_key "rain_logs", "constructions"
  add_foreign_key "rain_logs", "users", column: "created_by_user_id"
  add_foreign_key "schedule_task_checklist_items", "schedule_tasks"
  add_foreign_key "schedule_tasks", "constructions"
  add_foreign_key "schedule_tasks", "purchase_orders"
  add_foreign_key "schedule_template_row_audits", "schedule_template_rows"
  add_foreign_key "schedule_template_row_audits", "users"
  add_foreign_key "schedule_template_rows", "schedule_templates"
  add_foreign_key "schedule_template_rows", "suppliers"
  add_foreign_key "schedule_templates", "users", column: "created_by_id"
  add_foreign_key "sms_messages", "contacts"
  add_foreign_key "sms_messages", "users"
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "subcontractor_accounts", "contacts", column: "invited_by_contact_id"
  add_foreign_key "subcontractor_accounts", "portal_users"
  add_foreign_key "subcontractor_invoices", "accounting_integrations"
  add_foreign_key "subcontractor_invoices", "contacts"
  add_foreign_key "subcontractor_invoices", "purchase_orders"
  add_foreign_key "supplier_contacts", "contacts"
  add_foreign_key "supplier_contacts", "suppliers"
  add_foreign_key "supplier_ratings", "constructions"
  add_foreign_key "supplier_ratings", "contacts"
  add_foreign_key "supplier_ratings", "purchase_orders"
  add_foreign_key "supplier_ratings", "users", column: "rated_by_user_id"
  add_foreign_key "task_dependencies", "project_tasks", column: "predecessor_task_id"
  add_foreign_key "task_dependencies", "project_tasks", column: "successor_task_id"
  add_foreign_key "task_updates", "project_tasks"
  add_foreign_key "task_updates", "users"
  add_foreign_key "whs_action_items", "project_tasks"
  add_foreign_key "whs_action_items", "users", column: "assigned_to_user_id"
  add_foreign_key "whs_action_items", "users", column: "created_by_id"
  add_foreign_key "whs_incidents", "constructions"
  add_foreign_key "whs_incidents", "users", column: "investigated_by_user_id"
  add_foreign_key "whs_incidents", "users", column: "reported_by_user_id"
  add_foreign_key "whs_inductions", "constructions"
  add_foreign_key "whs_inductions", "users"
  add_foreign_key "whs_inductions", "users", column: "conducted_by_user_id"
  add_foreign_key "whs_inspection_items", "whs_inspections"
  add_foreign_key "whs_inspections", "constructions"
  add_foreign_key "whs_inspections", "meetings"
  add_foreign_key "whs_inspections", "users", column: "created_by_id"
  add_foreign_key "whs_inspections", "users", column: "inspector_user_id"
  add_foreign_key "whs_swms", "constructions"
  add_foreign_key "whs_swms", "users", column: "approved_by_id"
  add_foreign_key "whs_swms", "users", column: "created_by_id"
  add_foreign_key "whs_swms", "whs_swms", column: "superseded_by_id"
  add_foreign_key "whs_swms_acknowledgments", "users"
  add_foreign_key "whs_swms_acknowledgments", "whs_swms"
  add_foreign_key "whs_swms_controls", "whs_swms_hazards"
  add_foreign_key "whs_swms_hazards", "whs_swms"
  add_foreign_key "workflow_instances", "workflow_definitions"
  add_foreign_key "workflow_steps", "workflow_instances"
end

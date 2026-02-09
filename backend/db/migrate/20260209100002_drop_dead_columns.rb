# frozen_string_literal: true

# Drop dead columns identified by dead column detector v2.
#
# HIGH CONFIDENCE (table has no model, columns have stale data):
#   - job_documents.cad_metadata (55 rows stale)
#   - plan_identifications.ocr_structured_fields (32 rows stale)
#
# MEDIUM CONFIDENCE with stale data (table has model, column not in code):
#   - external_invoices: payment_portal_enabled, payment_reminder_count,
#     source_of_truth, last_payment_reminder_at (6,371 rows — replaced columns)
#   - ai_service_configs.extra_config (5 rows)
#
# MEDIUM CONFIDENCE empty (scaffolded but never used):
#   - 42 columns across 24 tables (all NULL in every row)
#
# See: notebooks/DEAD_COLUMNS_REPORT_2026-02-09.md
class DropDeadColumns < ActiveRecord::Migration[8.0]
  def up
    # ── HIGH CONFIDENCE (stale data on model-less tables) ──

    remove_column :job_documents, :cad_metadata
    remove_column :plan_identifications, :ocr_structured_fields

    # ── MEDIUM CONFIDENCE with stale data ──

    remove_column :external_invoices, :payment_portal_enabled
    remove_column :external_invoices, :payment_reminder_count
    remove_column :external_invoices, :source_of_truth
    remove_column :external_invoices, :last_payment_reminder_at
    remove_column :ai_service_configs, :extra_config

    # ── MEDIUM CONFIDENCE empty (scaffolded, never populated) ──

    remove_column :ato_effective_life_rates, :division_43_category
    remove_column :bill_payment_batches, :bank_response
    remove_column :bill_payment_batches, :self_balancing_reference
    remove_column :bill_payments, :remittance_email
    remove_column :bill_payments, :remittance_sent_at
    remove_column :bill_payments, :send_remittance
    remove_column :columns, :override_validation_message
    remove_column :company_approval_rules, :escalation_hours
    remove_column :e_signature_certificates, :certificate_storage_file_id
    remove_column :e_signature_signers, :browser_fingerprint
    remove_column :email_aliases, :polaris_alias_id
    remove_column :email_subscriptions, :stripe_payment_method_id
    remove_column :email_sync_statuses, :oldest_email_synced
    remove_column :email_sync_statuses, :sync_cursor
    remove_column :geofence_events, :notification_sent
    remove_column :gl_equipment_usages, :end_meter
    remove_column :gl_equipment_usages, :start_meter
    remove_column :gl_invoice_lines, :external_line_id
    remove_column :gl_invoices, :payment_token_expires_at
    remove_column :gl_invoices, :sync_metadata
    remove_column :gl_report_runs, :export_file_id
    remove_column :gl_tpar_payees, :abn_withheld
    remove_column :insurance_policies, :cover_type
    remove_column :insurance_policies, :insured_party
    remove_column :insurance_policies, :monthly_premium
    remove_column :people_documents, :document_number
    remove_column :people_documents, :issuing_authority
    remove_column :people_documents, :issuing_country
    remove_column :people_documents, :legacy_corporate_document_id
    remove_column :polaris_credentials, :reseller_id
    remove_column :sm_task_photos, :exif_timestamp
    remove_column :sm_task_photos, :face_match_confidence
    remove_column :sm_task_photos, :face_verification_result
    remove_column :sm_task_photos, :site_visibility_score
    remove_column :sm_task_photos, :site_visible
    remove_column :sm_task_photos, :weather_detected
    remove_column :stripe_configurations, :stripe_account_id
    remove_column :stripe_configurations, :webhook_endpoint_id
    remove_column :synced_emails, :user_classification_at
    remove_column :synced_emails, :user_classification_by_id
    remove_column :tenant_settings, :billing_address

    # Remove index on legacy_corporate_document_id before column is gone
    # (handled automatically by remove_column in Rails 8)
  end

  def down
    # ── HIGH CONFIDENCE ──
    add_column :job_documents, :cad_metadata, :jsonb, default: {}
    add_column :plan_identifications, :ocr_structured_fields, :jsonb, default: {}

    # ── MEDIUM with stale data ──
    add_column :external_invoices, :payment_portal_enabled, :boolean, default: true
    add_column :external_invoices, :payment_reminder_count, :integer, default: 0
    add_column :external_invoices, :source_of_truth, :string, default: "xero"
    add_column :external_invoices, :last_payment_reminder_at, :datetime
    add_column :ai_service_configs, :extra_config, :jsonb, default: {}

    # ── MEDIUM empty ──
    add_column :ato_effective_life_rates, :division_43_category, :string
    add_column :bill_payment_batches, :bank_response, :text
    add_column :bill_payment_batches, :self_balancing_reference, :string
    add_column :bill_payments, :remittance_email, :string
    add_column :bill_payments, :remittance_sent_at, :datetime
    add_column :bill_payments, :send_remittance, :boolean, default: true
    add_column :columns, :override_validation_message, :text
    add_column :company_approval_rules, :escalation_hours, :integer
    add_column :e_signature_certificates, :certificate_storage_file_id, :string
    add_column :e_signature_signers, :browser_fingerprint, :string
    add_column :email_aliases, :polaris_alias_id, :string
    add_column :email_subscriptions, :stripe_payment_method_id, :string
    add_column :email_sync_statuses, :oldest_email_synced, :datetime
    add_column :email_sync_statuses, :sync_cursor, :string
    add_column :geofence_events, :notification_sent, :boolean, default: false
    add_column :gl_equipment_usages, :end_meter, :decimal
    add_column :gl_equipment_usages, :start_meter, :decimal
    add_column :gl_invoice_lines, :external_line_id, :string
    add_column :gl_invoices, :payment_token_expires_at, :datetime
    add_column :gl_invoices, :sync_metadata, :jsonb, default: {}
    add_column :gl_report_runs, :export_file_id, :string
    add_column :gl_tpar_payees, :abn_withheld, :boolean, default: false
    add_column :insurance_policies, :cover_type, :string
    add_column :insurance_policies, :insured_party, :string
    add_column :insurance_policies, :monthly_premium, :decimal
    add_column :people_documents, :document_number, :string
    add_column :people_documents, :issuing_authority, :string
    add_column :people_documents, :issuing_country, :string
    add_column :people_documents, :legacy_corporate_document_id, :bigint
    add_column :polaris_credentials, :reseller_id, :string
    add_column :sm_task_photos, :exif_timestamp, :datetime
    add_column :sm_task_photos, :face_match_confidence, :decimal, precision: 5, scale: 2
    add_column :sm_task_photos, :face_verification_result, :jsonb
    add_column :sm_task_photos, :site_visibility_score, :decimal, precision: 5, scale: 2
    add_column :sm_task_photos, :site_visible, :boolean
    add_column :sm_task_photos, :weather_detected, :string, limit: 30
    add_column :stripe_configurations, :stripe_account_id, :string
    add_column :stripe_configurations, :webhook_endpoint_id, :string
    add_column :synced_emails, :user_classification_at, :datetime
    add_column :synced_emails, :user_classification_by_id, :bigint
    add_column :tenant_settings, :billing_address, :text

    # Restore indexes
    add_index :people_documents, :legacy_corporate_document_id, name: "index_people_documents_on_legacy_corporate_document_id"
    add_index :stripe_configurations, :stripe_account_id, unique: true,
              where: "(stripe_account_id IS NOT NULL)",
              name: "index_stripe_configurations_on_stripe_account_id"
  end
end

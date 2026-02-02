# frozen_string_literal: true

# Rename corporate_company_id → company_id across all tables
# The naming was redundant: Corporate IS a company, so "corporate_company_id" = "company company id"
# SSoT: Use company_id to reference the corporates table (model: Corporate)
class RenameCorporateCompanyIdToCompanyId < ActiveRecord::Migration[8.0]
  TABLES_TO_RENAME = %w[
    bill_inboxes
    bill_payment_batches
    company_approval_rules
    gl_accounts
    gl_ai_categorization_attempts
    gl_ai_categorization_learnings
    gl_ai_po_match_attempts
    gl_ai_po_match_learnings
    gl_anomalies
    gl_anomaly_reviews
    gl_anomaly_rules
    gl_approval_requests
    gl_approval_workflows
    gl_audit_logs
    gl_audit_snapshots
    gl_bank_reconciliations
    gl_bank_rule_learnings
    gl_bas_lodgements
    gl_billable_expenses
    gl_billable_rates
    gl_billable_time_entries
    gl_billing_milestones
    gl_budget_scenarios
    gl_budgets
    gl_categorization_predictions
    gl_change_orders
    gl_currencies
    gl_custom_reports
    gl_customer_payment_stats
    gl_customer_statements
    gl_departments
    gl_deposits
    gl_direct_debit_mandates
    gl_document_requests
    gl_duplicate_groups
    gl_equipment
    gl_exchange_rates
    gl_inventory_items
    gl_invoices
    gl_journal_entries
    gl_kpi_definitions
    gl_lien_waivers
    gl_opening_balances
    gl_payment_batches
    gl_payment_predictions
    gl_payments
    gl_period_locks
    gl_period_snapshots
    gl_periods
    gl_portal_tokens
    gl_progress_claims
    gl_provider_credentials
    gl_quotes
    gl_reconciliation_rules
    gl_report_dashboards
    gl_retainage_releases
    gl_scheduled_invoices
    gl_scheduled_reports
    gl_split_transactions
    gl_stock_counts
    gl_sync_logs
    gl_tax_rates
    gl_time_billing_batches
    gl_tpar_reports
    gl_tracking_classes
    gl_transaction_categories
    gl_wip_reports
    organizations
    xero_alerts
  ].freeze

  def change
    TABLES_TO_RENAME.each do |table_name|
      next unless table_exists?(table_name)
      next unless column_exists?(table_name, :corporate_id)

      # Rename the column
      rename_column table_name, :corporate_id, :company_id

      # Rename indexes that reference the old column name
      indexes_to_rename = indexes(table_name).select { |i| i.name.include?('corporate_company_id') }
      indexes_to_rename.each do |idx|
        new_name = idx.name.gsub('corporate_company_id', 'company_id')
        rename_index table_name, idx.name, new_name if index_exists?(table_name, :company_id, name: idx.name)
      end
    end
  end
end

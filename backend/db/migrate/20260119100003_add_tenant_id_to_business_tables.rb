# frozen_string_literal: true

# Phase 4: Add tenant_id to Business Tables
#
# This migration adds tenant_id to all 32 business tables that currently
# use company_group_id for multi-tenancy. The tenant_id is populated
# by looking up the tenant via corporate_groups.
#
# The company_group_id column is KEPT for now (parallel operation) and
# will be removed in a later cleanup migration after verification.
#
# Tables:
# - assets, cases, contact_corporate_group_memberships, contact_types
# - contacts, corporate_companies, corporate_entity_tabs, document_templates
# - document_types, email_warehouses, entity_tabs, estimates
# - job_stages, job_status_stages, job_statuses, job_tabs
# - job_type_statuses, job_types, jobs, meeting_types
# - meetings, price_histories, pricebook_categories, pricebooks
# - public_holidays, purchase_orders, reconciliation_reports
# - sm_schedule_master_templates, sm_schedule_masters, sm_tasks
# - sm_trades, xero_chart_of_accounts
#
class AddTenantIdToBusinessTables < ActiveRecord::Migration[8.0]
  # All tables with company_group_id that need tenant_id
  TABLES_WITH_COMPANY_GROUP_ID = %w[
    assets
    cases
    contact_corporate_group_memberships
    contact_types
    contacts
    corporate_companies
    corporate_entity_tabs
    document_templates
    document_types
    email_warehouses
    entity_tabs
    estimates
    job_stages
    job_status_stages
    job_statuses
    job_tabs
    job_type_statuses
    job_types
    jobs
    meeting_types
    meetings
    price_histories
    pricebook_categories
    pricebooks
    public_holidays
    purchase_orders
    reconciliation_reports
    sm_schedule_master_templates
    sm_schedule_masters
    sm_tasks
    sm_trades
    xero_chart_of_accounts
  ].freeze

  def up
    # Add tenant_id to all tables
    TABLES_WITH_COMPANY_GROUP_ID.each do |table|
      next if column_exists?(table.to_sym, :tenant_id)

      add_column table.to_sym, :tenant_id, :bigint
      add_index table.to_sym, :tenant_id

      say "Added tenant_id to #{table}"
    end

    # Populate tenant_id from company_group_id via corporate_groups
    TABLES_WITH_COMPANY_GROUP_ID.each do |table|
      execute <<-SQL
        UPDATE #{table}
        SET tenant_id = cg.tenant_id
        FROM corporate_groups cg
        WHERE #{table}.company_group_id = cg.id
          AND #{table}.tenant_id IS NULL
          AND #{table}.company_group_id IS NOT NULL;
      SQL

      # For records without company_group_id, default to Tekna (Tenant 2)
      execute <<-SQL
        UPDATE #{table}
        SET tenant_id = 2
        WHERE tenant_id IS NULL;
      SQL

      count = execute("SELECT COUNT(*) FROM #{table}").first['count']
      say "Populated tenant_id for #{count} rows in #{table}"
    end

    # Add foreign keys (but don't make NOT NULL yet - allows rollback)
    TABLES_WITH_COMPANY_GROUP_ID.each do |table|
      add_foreign_key table.to_sym, :tenants unless foreign_key_exists?(table.to_sym, :tenants)
    end
  end

  def down
    TABLES_WITH_COMPANY_GROUP_ID.each do |table|
      remove_foreign_key table.to_sym, :tenants if foreign_key_exists?(table.to_sym, :tenants)
      remove_column table.to_sym, :tenant_id if column_exists?(table.to_sym, :tenant_id)
    end
  end
end

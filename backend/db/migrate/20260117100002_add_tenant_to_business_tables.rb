# frozen_string_literal: true

# Multi-tenancy Phase 1: Add company_group_id to business data tables
# This enables tenant isolation for core business data like jobs, orders, etc.
#
# Note: Some tables (contacts, corporate_companies) already have company_group_id
class AddTenantToBusinessTables < ActiveRecord::Migration[8.0]
  def change
    # Business data - Jobs (core)
    add_reference :jobs, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Business data - Schedule Masters (job schedules)
    add_reference :sm_schedule_masters, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Business data - SM Tasks
    add_reference :sm_tasks, :company_group, foreign_key: { to_table: :corporate_groups }, index: true if table_exists?(:sm_tasks)

    # Business data - Trades
    add_reference :sm_trades, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Business data - Pricebook
    add_reference :pricebooks, :company_group, foreign_key: { to_table: :corporate_groups }, index: true
    add_reference :pricebook_categories, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Business data - Purchase Orders
    add_reference :purchase_orders, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Business data - Estimates
    add_reference :estimates, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Business data - Assets
    add_reference :assets, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Business data - Timesheets
    add_reference :timesheets, :company_group, foreign_key: { to_table: :corporate_groups }, index: true if table_exists?(:timesheets)
    add_reference :timesheet_entries, :company_group, foreign_key: { to_table: :corporate_groups }, index: true if table_exists?(:timesheet_entries)

    # Business data - Email Warehouse
    add_reference :email_warehouses, :company_group, foreign_key: { to_table: :corporate_groups }, index: true

    # Business data - Meetings
    add_reference :meetings, :company_group, foreign_key: { to_table: :corporate_groups }, index: true if table_exists?(:meetings)

    # Business data - Invoices (if not already tenant-scoped)
    unless column_exists?(:invoices, :company_group_id)
      add_reference :invoices, :company_group, foreign_key: { to_table: :corporate_groups }, index: true if table_exists?(:invoices)
    end

    # Business data - Bills (if exists)
    unless column_exists?(:bills, :company_group_id)
      add_reference :bills, :company_group, foreign_key: { to_table: :corporate_groups }, index: true if table_exists?(:bills)
    end

    # Add tenant-scoped unique index for job codes
    add_index :jobs, [:company_group_id, :job_code], unique: true, name: 'idx_jobs_tenant_code', where: 'company_group_id IS NOT NULL'
  end
end

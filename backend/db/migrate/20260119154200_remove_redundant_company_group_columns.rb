# frozen_string_literal: true

# Migration: Remove Redundant company_group_id Columns
#
# Context:
# - tenant_id is now the SSoT for multi-tenancy (acts_as_tenant :tenant)
# - company_group_id was the OLD multi-tenancy column
# - Tables now have BOTH columns, which is redundant
#
# This migration removes company_group_id from tables where it's
# ONLY used for multi-tenancy (now replaced by tenant_id).
#
# Tables that KEEP company_group_id (used for business grouping):
# - corporate_companies (belongs_to :corporate_group)
# - contact_corporate_group_memberships (links contacts to groups)
# - corporate_entity_tabs (config per corporate group)
#
# Tables that REMOVE company_group_id (redundant with tenant_id):
# - All other business tables (jobs, contacts, assets, etc.)
#
class RemoveRedundantCompanyGroupColumns < ActiveRecord::Migration[8.0]
  def up
    # Tables to remove company_group_id from (redundant with tenant_id)
    tables_to_clean = %w[
      assets
      cases
      contact_types
      contacts
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
      tenant_settings
      users
      xero_chart_of_accounts
    ]

    tables_to_clean.each do |table|
      if column_exists?(table, :company_group_id)
        # Remove foreign key if exists
        if foreign_key_exists?(table, column: :company_group_id)
          remove_foreign_key table, column: :company_group_id
        end

        # Remove index if exists
        if index_exists?(table, :company_group_id)
          remove_index table, :company_group_id
        end

        # Remove the column
        remove_column table, :company_group_id
        puts "  Removed company_group_id from #{table}"
      end
    end

    # Also clean up users.corporate_group_id (legacy column)
    if column_exists?(:users, :corporate_group_id)
      if foreign_key_exists?(:users, column: :corporate_group_id)
        remove_foreign_key :users, column: :corporate_group_id
      end
      if index_exists?(:users, :corporate_group_id)
        remove_index :users, :corporate_group_id
      end
      remove_column :users, :corporate_group_id
      puts "  Removed corporate_group_id from users"
    end
  end

  def down
    # This migration is not easily reversible - the data is lost
    # To reverse, you'd need to re-add the columns and repopulate from tenant_id
    raise ActiveRecord::IrreversibleMigration, "Cannot reverse removal of company_group_id columns"
  end
end

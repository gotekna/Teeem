# frozen_string_literal: true

# Phase 1 of CorporateCompany → Corporate rename
# This migration renames all corporate_company* tables to corporate*
#
# Self-referential FK columns (parent_company_id, consolidation_parent_id, lender_company_id,
# borrower_company_id) stay as-is since they reference the same table.
#
# Foreign key columns named company_id stay as-is for backwards compatibility.
class RenameCorporateCompaniesToCorporates < ActiveRecord::Migration[8.0]
  def change
    # 1. Rename main table
    rename_table :corporate_companies, :corporates

    # 2. Rename related tables (alphabetical order)
    rename_table :corporate_activities, :corporate_activities
    rename_table :corporate_compliance_items, :corporate_compliance_items
    rename_table :corporate_directors, :corporate_directors
    rename_table :corporate_loans, :corporate_loans
    rename_table :corporate_minutes, :corporate_minutes
    rename_table :corporate_monthly_pls, :corporate_monthly_pls
    rename_table :corporate_shareholdings, :corporate_shareholdings
    rename_table :corporate_xero_accounts, :corporate_xero_accounts
    rename_table :corporate_xero_connections, :corporate_xero_connections

    # 3. Rename foreign key column in monthly_pls (uses corporate_company_id, not company_id)
    rename_column :corporate_monthly_pls, :corporate_id, :corporate_id

    # 4. Rename foreign key column in xero_accounts (uses company_xero_connection_id)
    rename_column :corporate_xero_accounts, :company_xero_connection_id, :corporate_xero_connection_id

    # Note: The following FK columns keep their names for backwards compatibility:
    # - company_id (in activities, compliance_items, directors, minutes, shareholdings, xero_connections)
    # - lender_company_id, borrower_company_id (in loans)
    # - parent_company_id, consolidation_parent_id (in corporates - self-referential)
    # These reference the same `corporates` table, column names don't need to change.
  end
end

class RenameCompanyTablesToCorporateCompany < ActiveRecord::Migration[8.0]
  def change
    # Rename main corporate companies table
    rename_table :companies, :corporate_companies

    # Rename all related corporate company tables
    rename_table :company_activities, :corporate_activities
    rename_table :company_compliance_items, :corporate_compliance_items
    rename_table :company_directors, :corporate_directors
    rename_table :company_documents, :corporate_documents
    rename_table :company_groups, :corporate_groups
    rename_table :company_loans, :corporate_loans
    rename_table :company_minutes, :corporate_minutes
    rename_table :company_settings, :corporate_settings
    rename_table :company_shareholdings, :corporate_shareholdings
    rename_table :company_xero_accounts, :corporate_xero_accounts
    rename_table :company_xero_connections, :corporate_xero_connections

    # Rename relationship table (shortened for clarity)
    rename_table :contact_company_group_memberships, :contact_corporate_group_memberships

    # Note: intercompany_balances is left as-is (name is already clear)
    # Note: Foreign key column names (company_id, company_group_id) remain unchanged
    # They just now point to the renamed tables
  end
end

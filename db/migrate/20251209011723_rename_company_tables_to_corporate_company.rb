class RenameCompanyTablesToCorporateCompany < ActiveRecord::Migration[8.0]
  def change
    # Rename main corporate companies table
    rename_table :companies, :corporate_companies

    # Rename all related corporate company tables
    rename_table :company_activities, :corporate_company_activities
    rename_table :company_compliance_items, :corporate_company_compliance_items
    rename_table :company_directors, :corporate_company_directors
    rename_table :company_documents, :corporate_company_documents
    rename_table :company_groups, :corporate_groups
    rename_table :company_loans, :corporate_company_loans
    rename_table :company_minutes, :corporate_company_minutes
    rename_table :company_settings, :corporate_company_settings
    rename_table :company_shareholdings, :corporate_company_shareholdings
    rename_table :company_xero_accounts, :corporate_company_xero_accounts
    rename_table :company_xero_connections, :corporate_company_xero_connections

    # Rename relationship table (shortened for clarity)
    rename_table :contact_company_group_memberships, :contact_corporate_group_memberships

    # Note: intercompany_balances is left as-is (name is already clear)
    # Note: Foreign key column names (company_id, company_group_id) remain unchanged
    # They just now point to the renamed tables
  end
end

class AddXeroBalanceFieldsToContacts < ActiveRecord::Migration[8.0]
  def change
    # Add Xero balance fields that were missing from contacts table
    # These are read-only from Xero API and represent current outstanding/overdue amounts
    # See: SyncConfiguration::DEFAULT_FIELD_MAPPINGS (lines 53-57)
    # See: XeroContactSyncService#update_teeem_from_xero (lines 532-542)

    # Foundation metadata already exists for these columns (they were defined but never added to DB)
    # This migration fixes the SSoT violation by adding the actual database columns

    add_column :contacts, :accounts_receivable_outstanding, :decimal, precision: 15, scale: 2, default: 0.0
    add_column :contacts, :accounts_receivable_overdue, :decimal, precision: 15, scale: 2, default: 0.0
    add_column :contacts, :accounts_payable_outstanding, :decimal, precision: 15, scale: 2, default: 0.0
    add_column :contacts, :accounts_payable_overdue, :decimal, precision: 15, scale: 2, default: 0.0

    # Also add two other missing Xero fields from field mappings
    add_column :contacts, :company_number, :string  # CompanyNumber from Xero (ACN in Australia)
    add_column :contacts, :fax_phone, :string  # FAX phone number from Xero
  end
end

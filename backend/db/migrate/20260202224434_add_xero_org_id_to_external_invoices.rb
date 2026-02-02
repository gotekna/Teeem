# FRC (Feb 2026): ExternalInvoice.tenant_id is TEEEM Tenant FK (integer).
# This caused bugs where code passed Xero UUID to scopes expecting TEEEM integer.
# xero_org_id stores the Xero organization UUID for correct API calls and scoping.
class AddXeroOrgIdToExternalInvoices < ActiveRecord::Migration[8.0]
  def change
    add_column :external_invoices, :xero_org_id, :string
    add_index :external_invoices, :xero_org_id
  end
end

# frozen_string_literal: true

# Adds FK from ExternalInvoice to WarehouseContact
# This links invoices to the SSoT for Xero contact data
class AddWarehouseContactToExternalInvoices < ActiveRecord::Migration[8.0]
  def change
    # Allow null initially - will be populated by sync job based on external_contact_id
    add_reference :external_invoices, :warehouse_contact, null: true, foreign_key: true
  end
end

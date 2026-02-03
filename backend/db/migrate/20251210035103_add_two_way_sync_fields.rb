# frozen_string_literal: true

class AddTwoWaySyncFields < ActiveRecord::Migration[8.0]
  def change
    # ExternalInvoice: Track two-way sync status
    add_column :external_invoices, :source_of_truth, :string, default: 'xero' # xero, teeem, manual
    add_column :external_invoices, :sync_to_xero, :boolean, default: false, null: false
    add_column :external_invoices, :synced_to_xero_at, :datetime
    add_column :external_invoices, :xero_updated_at, :datetime
    add_column :external_invoices, :local_updated_at, :datetime
    add_column :external_invoices, :sync_conflict, :boolean, default: false, null: false

    # CorporateCompanyDocument: Track Xero attachment sync
    add_column :corporate_documents, :synced_to_xero_at, :datetime
    add_column :corporate_documents, :xero_attachment_id, :string
    add_column :corporate_documents, :sync_to_xero, :boolean, default: false, null: false

    add_index :external_invoices, :sync_conflict, where: 'sync_conflict = true', name: 'idx_external_invoices_conflicts'
    add_index :external_invoices, [ :sync_to_xero, :synced_to_xero_at ], name: 'idx_external_invoices_pending_sync'
    add_index :corporate_documents, [ :sync_to_xero, :synced_to_xero_at ], name: 'idx_corp_docs_pending_xero_sync'
  end
end

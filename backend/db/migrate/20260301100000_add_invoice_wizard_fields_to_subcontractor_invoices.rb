class AddInvoiceWizardFieldsToSubcontractorInvoices < ActiveRecord::Migration[8.0]
  def change
    add_column :subcontractor_invoices, :completion_percentage, :integer, default: 100
    add_column :subcontractor_invoices, :remaining_work_description, :text
    add_column :subcontractor_invoices, :error_message, :string
    add_reference :subcontractor_invoices, :invoice_file_blob, foreign_key: { to_table: :storage_blobs }, null: true
    add_reference :subcontractor_invoices, :sm_task, foreign_key: true, null: true
  end
end

# Add polymorphic association to company_documents
# This allows documents to be linked to PurchaseOrders, ExternalInvoices, Jobs, etc.
class AddDocumentableToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    # Make it nullable since existing documents won't have this set
    add_column :company_documents, :documentable_type, :string
    add_column :company_documents, :documentable_id, :bigint

    add_index :company_documents, [ :documentable_type, :documentable_id ],
              name: 'idx_company_docs_documentable'
  end
end

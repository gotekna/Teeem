class AddPdfEligibilityToCorporateCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    # SSoT: Track PDF eligibility directly on documents to avoid complex joins
    # is_pdf_eligible: true = invoice has contact AND is not draft
    # orphaned_at: when the document became orphaned (contact removed or invoice became draft)
    # orphan_reason: why the document was orphaned (contact_removed, became_draft)
    add_column :corporate_company_documents, :is_pdf_eligible, :boolean, default: true, null: false
    add_column :corporate_company_documents, :orphaned_at, :datetime
    add_column :corporate_company_documents, :orphan_reason, :string

    # Index for fast eligibility queries
    add_index :corporate_company_documents, :is_pdf_eligible, where: "source = 'xero'"
    add_index :corporate_company_documents, :orphaned_at, where: "orphaned_at IS NOT NULL"
  end
end

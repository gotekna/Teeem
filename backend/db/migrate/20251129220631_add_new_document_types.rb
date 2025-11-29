class AddNewDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # REGISTRY Tab - New 10th tab for share registry documents
    create_document_type('Share Registry', 'REGISTRY', 'corporate', true)
    create_document_type('Share Transfer', 'REGISTRY', 'corporate', true)
    create_document_type('Share Certificate', 'REGISTRY', 'corporate', true)

    # ASSETS Tab - Purchase contracts and asset documents (draft/signed variants)
    create_document_type('Purchase Contract - Draft', 'ASSETS', 'corporate', false)
    create_document_type('Purchase Contract - Signed', 'ASSETS', 'corporate', true)
    create_document_type('Asset Insurance - Draft', 'ASSETS', 'corporate', false)
    create_document_type('Asset Insurance - Signed', 'ASSETS', 'corporate', true)
    create_document_type('Service Agreement - Draft', 'ASSETS', 'corporate', false)
    create_document_type('Service Agreement - Signed', 'ASSETS', 'corporate', true)

    # LOANS Tab - Draft/signed variants for existing types
    create_document_type('Loan Agreement - Draft', 'LOANS', 'corporate', false)
    create_document_type('Loan Agreement - Signed', 'LOANS', 'corporate', true)
    create_document_type('Security Deed - Draft', 'LOANS', 'corporate', false)
    create_document_type('Security Deed - Signed', 'LOANS', 'corporate', true)

    # MINUTES Tab - Draft/signed variants
    create_document_type('Minutes - Draft', 'MINUTES', 'corporate', false)
    create_document_type('Minutes - Signed', 'MINUTES', 'corporate', true)

    # DIVIDENDS Tab - Draft/signed variants
    create_document_type('Distribution - Draft', 'DIVIDENDS', 'corporate', false)
    create_document_type('Distribution - Signed', 'DIVIDENDS', 'corporate', true)
  end

  def down
    # Remove all newly created document types
    names = [
      'Share Registry', 'Share Transfer', 'Share Certificate',
      'Purchase Contract - Draft', 'Purchase Contract - Signed',
      'Asset Insurance - Draft', 'Asset Insurance - Signed',
      'Service Agreement - Draft', 'Service Agreement - Signed',
      'Loan Agreement - Draft', 'Loan Agreement - Signed',
      'Security Deed - Draft', 'Security Deed - Signed',
      'Minutes - Draft', 'Minutes - Signed',
      'Distribution - Draft', 'Distribution - Signed'
    ]

    DocumentType.where(name: names).delete_all
  end

  private

  def create_document_type(name, folder, category, requires_filing)
    DocumentType.create!(
      name: name,
      folder: folder,
      category: category,
      requires_filing: requires_filing,
      active: true
    )
  end
end

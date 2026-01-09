class ConsolidateDocumentTypesAndMigrateDocuments < ActiveRecord::Migration[8.0]
  def up
    # 1. LOANS: Merge "Loan Agreement" docs into "Loan Agreement - Signed", then deactivate base
    loan_base = DocumentType.find_by(name: 'Loan Agreement')
    loan_signed = DocumentType.find_by(name: 'Loan Agreement - Signed')
    if loan_base && loan_signed
      count = CompanyDocument.where(document_type_id: loan_base.id).update_all(document_type_id: loan_signed.id)
      puts "Migrated #{count} documents from 'Loan Agreement' to 'Loan Agreement - Signed'"
      loan_base.update!(active: false)
      puts "Deactivated 'Loan Agreement'"
    end

    # 2. SECURITY DEED: Merge "Security Deed" docs into "Security Deed - Signed", then deactivate base
    security_base = DocumentType.find_by(name: 'Security Deed')
    security_signed = DocumentType.find_by(name: 'Security Deed - Signed')
    if security_base && security_signed
      count = CompanyDocument.where(document_type_id: security_base.id).update_all(document_type_id: security_signed.id)
      puts "Migrated #{count} documents from 'Security Deed' to 'Security Deed - Signed'"
      security_base.update!(active: false)
      puts "Deactivated 'Security Deed'"
    end

    # 3. MINUTES: Merge "Directors' Minutes" docs into "Minutes - Signed", then deactivate base
    minutes_base = DocumentType.find_by(name: "Directors' Minutes")
    minutes_signed = DocumentType.find_by(name: 'Minutes - Signed')
    if minutes_base && minutes_signed
      count = CompanyDocument.where(document_type_id: minutes_base.id).update_all(document_type_id: minutes_signed.id)
      puts "Migrated #{count} documents from 'Directors' Minutes' to 'Minutes - Signed'"
      minutes_base.update!(active: false)
      puts "Deactivated 'Directors' Minutes'"
    end

    # 4. DISTRIBUTION: Keep just "Distribution Declaration", merge Draft/Signed into it, then deactivate them
    dist_base = DocumentType.find_by(name: 'Distribution Declaration')
    dist_draft = DocumentType.find_by(name: 'Distribution - Draft')
    dist_signed = DocumentType.find_by(name: 'Distribution - Signed')

    if dist_base
      if dist_draft
        count = CompanyDocument.where(document_type_id: dist_draft.id).update_all(document_type_id: dist_base.id)
        puts "Migrated #{count} documents from 'Distribution - Draft' to 'Distribution Declaration'"
        dist_draft.update!(active: false)
        puts "Deactivated 'Distribution - Draft'"
      end

      if dist_signed
        count = CompanyDocument.where(document_type_id: dist_signed.id).update_all(document_type_id: dist_base.id)
        puts "Migrated #{count} documents from 'Distribution - Signed' to 'Distribution Declaration'"
        dist_signed.update!(active: false)
        puts "Deactivated 'Distribution - Signed'"
      end
    end
  end

  def down
    # Re-activate the deactivated document types (documents stay with new types)
    DocumentType.where(name: [ 'Loan Agreement', 'Security Deed', "Directors' Minutes",
                              'Distribution - Draft', 'Distribution - Signed' ]).update_all(active: true)
  end
end

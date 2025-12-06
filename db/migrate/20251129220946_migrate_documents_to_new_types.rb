class MigrateDocumentsToNewTypes < ActiveRecord::Migration[8.0]
  def up
    # Get document type IDs (lookups for efficiency)
    doc_types = {}
    [
      'ASIC Documents', 'Constitution', 'Gift Deed Return', 'Bank Statement',
      'Loan Agreement - Signed', 'Security Deed - Signed', 'Directors\' Minutes',
      'Share Registry', 'Share Certificate', 'ASIC Company Key', 'Draft Financials', 'Final Financials',
      'CTR - Company Tax Return', 'TTR - Trust Tax Return', 'ASIC Form 484 - Director Changes',
      'Asset', 'General', 'Trust Deed', 'Share Transfer'
    ].each do |name|
      dt = DocumentType.find_by(name: name)
      doc_types[name] = dt.id if dt
    end

    # 1. ASIC (41 docs) → ASIC Documents
    migrate_simple('asic', doc_types['ASIC Documents'])

    # 2. CONSTITUTION (9 docs) → Constitution
    migrate_simple('constitution', doc_types['Constitution'])

    # 3. CONTRACT (1 doc) → Gift Deed Return
    migrate_simple('contract', doc_types['Gift Deed Return'])

    # 4. FINANCIAL_STATEMENT (31 docs) → Bank Statement
    migrate_simple('financial_statement', doc_types['Bank Statement'])

    # 5. LOAN_AGREEMENT (28 docs) → Loan Agreement - Signed
    migrate_simple('loan_agreement', doc_types['Loan Agreement - Signed'])

    # 6. MINUTES (9 docs) → Directors' Minutes
    migrate_simple('minutes', doc_types['Directors\' Minutes'])

    # 7. OTHER (98 docs) → SPLIT BY CONTENT
    migrate_other_category(doc_types)

    # 8. SECURITY_DEED (1 doc) → Security Deed - Signed
    migrate_simple('security_deed', doc_types['Security Deed - Signed'])

    # 9. SETUP (17 docs) → ASIC Documents
    migrate_simple('setup', doc_types['ASIC Documents'])

    # 10. SHARE_REGISTRY (34 docs) → Share Registry
    migrate_simple('share_registry', doc_types['Share Registry'])

    # 11. TAX (1 doc) → CTR - Company Tax Return
    migrate_simple('tax', doc_types['CTR - Company Tax Return'])

    # 12. TAX_RETURN (19 docs) → CTR or TTR by Company Type
    migrate_tax_returns(doc_types)

    # 13. TRUST_DEED (7 docs) → Trust Deed
    migrate_simple('trust_deed', doc_types['Trust Deed'])

    # 14. CERTIFICATE (19 docs) → Share Certificate (local DB only)
    if doc_types['Share Certificate']
      migrate_simple('certificate', doc_types['Share Certificate'])
    end

    # 15. FINANCIAL (55 docs) → Final Financials (local DB only)
    if doc_types['Final Financials']
      migrate_simple('financial', doc_types['Final Financials'])
    end

    puts "\n=== MIGRATION COMPLETE ==="
    puts "Total documents migrated: #{CompanyDocument.count}"
    puts "Documents with no type: #{CompanyDocument.where(document_type_id: nil).count}"
  end

  def down
    # Revert all documents to old types
    CompanyDocument.update_all(document_type_id: nil)
    puts "Reverted all document type migrations"
  end

  private

  def migrate_simple(old_type, new_type_id)
    return unless new_type_id

    count = CompanyDocument.where(document_type: old_type).update_all(document_type_id: new_type_id)
    puts "Migrated #{count} documents: #{old_type} → #{DocumentType.find(new_type_id).name}"
  end

  def migrate_other_category(doc_types)
    other_docs = CompanyDocument.where(document_type: 'other')

    # Sub-Category A: Register Documents (34 docs)
    register_patterns = [ 'register of members', 'register of loans', 'member register', 'loan register' ]
    count = update_by_title_patterns(other_docs, register_patterns, doc_types['Share Registry'])
    puts "Migrated #{count} 'other' documents: Register → Share Registry"

    # Sub-Category B: Corporate Keys (8 docs)
    key_patterns = [ 'corporate key', 'asic key', 'company key' ]
    count = update_by_title_patterns(other_docs, key_patterns, doc_types['ASIC Company Key'])
    puts "Migrated #{count} 'other' documents: Keys → ASIC Company Key"

    # Sub-Category C: Financials/Tax in #N/A folder
    financials_patterns = [ 'financials' ]
    count = update_by_title_patterns(other_docs, financials_patterns, doc_types['Draft Financials'])
    puts "Migrated #{count} 'other' documents: Financials → Draft Financials"

    tax_return_patterns = [ 'tax return' ]
    count = update_by_title_patterns(other_docs, tax_return_patterns, doc_types['CTR - Company Tax Return'])
    puts "Migrated #{count} 'other' documents: Tax Return → CTR"

    # Sub-Category D: Director Changes (8 docs)
    director_patterns = [ 'resignation of director', 'consent.*director', 'appoint.*director', 'director.*consent', 'director.*appoint' ]
    count = update_by_title_patterns(other_docs, director_patterns, doc_types['ASIC Form 484 - Director Changes'])
    puts "Migrated #{count} 'other' documents: Director Changes → ASIC Form 484"

    # Sub-Category E: Share Transfers (3 docs)
    transfer_patterns = [ 'share transfer' ]
    count = update_by_title_patterns(other_docs, transfer_patterns, doc_types['Share Transfer'])
    puts "Migrated #{count} 'other' documents: Share Transfer → Share Transfer"

    # Sub-Category F: Asset Related (4 docs)
    asset_patterns = [ 'sale of', 'deed of gift', 'bullion', 'asset' ]
    count = update_by_title_patterns(other_docs, asset_patterns, doc_types['Asset'])
    puts "Migrated #{count} 'other' documents: Assets → Asset"

    # Sub-Category G: Everything Else → General
    count = other_docs.where(document_type_id: nil).update_all(document_type_id: doc_types['General'])
    puts "Migrated #{count} 'other' documents: Remaining → General"
  end

  def migrate_tax_returns(doc_types)
    tax_returns = CompanyDocument.where(document_type: 'tax_return').includes(:company)

    # Trust/Super companies → TTR
    trust_keywords = [ 'ATF', 'Trust', 'Super Fund', 'SMSF' ]
    trust_count = 0
    company_count = 0

    tax_returns.each do |doc|
      company_name = doc.company&.name || ''

      if trust_keywords.any? { |keyword| company_name.include?(keyword) }
        doc.update(document_type_id: doc_types['TTR - Trust Tax Return'])
        trust_count += 1
      else
        doc.update(document_type_id: doc_types['CTR - Company Tax Return'])
        company_count += 1
      end
    end

    puts "Migrated #{trust_count} tax_return documents: Trust/Super → TTR"
    puts "Migrated #{company_count} tax_return documents: Pty Ltd → CTR"
  end

  def update_by_title_patterns(docs, patterns, new_type_id)
    return 0 unless new_type_id

    count = 0
    docs.where(document_type_id: nil).each do |doc|
      title = (doc.title || '').downcase

      if patterns.any? { |pattern| title.match?(Regexp.new(pattern, Regexp::IGNORECASE)) }
        doc.update(document_type_id: new_type_id)
        count += 1
      end
    end

    count
  end
end

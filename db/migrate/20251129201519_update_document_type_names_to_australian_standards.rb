class UpdateDocumentTypeNamesToAustralianStandards < ActiveRecord::Migration[8.0]
  def up
    # Update ATO/Tax document names to use standard abbreviations
    rename_document_type('End of Year ATO Return', 'CTR - Company Tax Return')
    rename_document_type('ATO Tax Return', 'CTR - Company Tax Return') # Merge duplicate
    rename_document_type('Business Activity Statement', 'BAS - Business Activity Statement')
    rename_document_type('Tax Consolidation Schedule', 'Tax Consolidation Schedule') # Keep as is

    # Update ASIC document names
    rename_document_type('End of Year ASIC Return', 'ASIC Annual Review')
    rename_document_type('ASIC Solvency Declaration', 'ASIC Form 485 - Solvency Declaration')

    # Update corporate document names to be more professional
    rename_document_type('Company Minutes', 'Directors\' Minutes')
    rename_document_type('Distribution Resolution', 'Directors\' Resolution - Distribution')
    rename_document_type('Dividend Payment', 'Dividend Payment Record')

    # Update structure documents
    rename_document_type('Director and Officer Changes', 'ASIC Form 484 - Director Changes')
    rename_document_type('Registered Office Address', 'ASIC Form 484 - Registered Office')

    # Keep these as they are already good:
    # - Constitution
    # - Trust Deed
    # - Loan Agreement
    # - Security Deed
    # - Bank Statement
    # - Asset
    # - Structure
    # - Company Setup
    # - Corporate Key
    # - ASIC Company Key
    # - ASIC Documents
    # - ATO Documents
    # - Register of Members
    # - Gift Deed Return
    # - PPSR Registration
    # - Distribution
  end

  def down
    # Reverse the changes
    rename_document_type('CTR - Company Tax Return', 'End of Year ATO Return')
    rename_document_type('BAS - Business Activity Statement', 'Business Activity Statement')
    rename_document_type('ASIC Annual Review', 'End of Year ASIC Return')
    rename_document_type('ASIC Form 485 - Solvency Declaration', 'ASIC Solvency Declaration')
    rename_document_type('Directors\' Minutes', 'Company Minutes')
    rename_document_type('Directors\' Resolution - Distribution', 'Distribution Resolution')
    rename_document_type('Dividend Payment Record', 'Dividend Payment')
    rename_document_type('ASIC Form 484 - Director Changes', 'Director and Officer Changes')
    rename_document_type('ASIC Form 484 - Registered Office', 'Registered Office Address')
  end

  private

  def rename_document_type(old_name, new_name)
    # Skip if old name doesn't exist
    return unless DocumentType.exists?(name: old_name)

    # Check if new name already exists
    existing = DocumentType.find_by(name: new_name)
    old_type = DocumentType.find_by(name: old_name)

    # Escape single quotes for SQL
    escaped_new_name = new_name.gsub("'", "''")
    escaped_old_name = old_name.gsub("'", "''")

    if existing && old_type && existing.id != old_type.id
      # Merge: Update all documents pointing to old type to point to existing type
      execute <<-SQL
        UPDATE company_documents
        SET document_type = '#{escaped_new_name}'
        WHERE document_type = '#{escaped_old_name}'
      SQL

      # Delete the old document type
      old_type.destroy
    else
      # Simple rename
      execute <<-SQL
        UPDATE document_types
        SET name = '#{escaped_new_name}'
        WHERE name = '#{escaped_old_name}'
      SQL

      # Also update any company_documents that use the old name
      execute <<-SQL
        UPDATE company_documents
        SET document_type = '#{escaped_new_name}'
        WHERE document_type = '#{escaped_old_name}'
      SQL
    end
  end
end

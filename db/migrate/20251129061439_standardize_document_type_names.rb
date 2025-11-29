class StandardizeDocumentTypeNames < ActiveRecord::Migration[8.0]
  def up
    # Standardize all document type names to be fully descriptive

    # Tax documents
    update_name('EOY ATO', 'End of Year ATO Return')
    update_name('BAS', 'Business Activity Statement')
    update_name('ATO Docs', 'ATO Documents')
    update_name('Tax Consolidation', 'Tax Consolidation Schedule')
    # 'ATO Tax Return' is already good

    # Compliance documents
    update_name('EOY ASIC', 'End of Year ASIC Return')
    update_name('ASIC Docs', 'ASIC Documents')
    update_name('ASIC Key', 'ASIC Company Key')
    update_name('Solvency ASIC', 'ASIC Solvency Declaration')
    update_name('Officers', 'Director and Officer Changes')
    update_name('Registered Office', 'Registered Office Address')
    # 'Corporate Key' is already good

    # Corporate documents
    update_name('Bank Statements', 'Bank Statement')
    update_name('Members', 'Register of Members')
    update_name('Minutes', 'Company Minutes')
    update_name('Distribution Minutes', 'Distribution Resolution')
    update_name('Dividends', 'Dividend Payment')
    update_name('Return of Gift Deed', 'Gift Deed Return')
    update_name('PPSR', 'PPSR Registration')
    # Others are already descriptive: Asset, Company Setup, Constitution,
    # Distribution, Loan Agreement, Security Deed, Structure, Trust Deed
  end

  def down
    # Reverse changes
    update_name('End of Year ATO Return', 'EOY ATO')
    update_name('Business Activity Statement', 'BAS')
    update_name('ATO Documents', 'ATO Docs')
    update_name('Tax Consolidation Schedule', 'Tax Consolidation')

    update_name('End of Year ASIC Return', 'EOY ASIC')
    update_name('ASIC Documents', 'ASIC Docs')
    update_name('ASIC Company Key', 'ASIC Key')
    update_name('ASIC Solvency Declaration', 'Solvency ASIC')
    update_name('Director and Officer Changes', 'Officers')
    update_name('Registered Office Address', 'Registered Office')

    update_name('Bank Statement', 'Bank Statements')
    update_name('Register of Members', 'Members')
    update_name('Company Minutes', 'Minutes')
    update_name('Distribution Resolution', 'Distribution Minutes')
    update_name('Dividend Payment', 'Dividends')
    update_name('Gift Deed Return', 'Return of Gift Deed')
    update_name('PPSR Registration', 'PPSR')
  end

  private

  def update_name(old_name, new_name)
    execute <<-SQL
      UPDATE document_types
      SET name = '#{new_name}'
      WHERE name = '#{old_name}'
    SQL
  end
end

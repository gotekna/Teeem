class AddNameFormatToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :document_types, :name_format, :string

    reversible do |dir|
      dir.up do
        # Populate name_format for all document types based on PLAN_SHAREPOINT_FOLDERS.md
        name_formats = {
          # ADVICE Tab
          'AA - Accountant Advice' => '{CompanyCode} AA {Description} {Date}',
          'CA - Client Advice' => '{CompanyCode} CA {Description} {Date}',
          'LA - Legal Advice' => '{CompanyCode} LA {Description} {Date}',

          # ASIC Tab
          'ASIC Annual Review' => '{CompanyCode} ASIC Annual Review FY{YY}',
          'ASIC Documents' => '{CompanyCode} ASIC {Description} {Date}',
          'ASIC Form 484 - Director Changes' => '{CompanyCode} Form 484 Directors {Date}',
          'ASIC Form 484 - Registered Office' => '{CompanyCode} Form 484 Reg Office {Date}',
          'Company Setup' => '{CompanyCode} Setup {Document} {Date}',
          'Corporate Key' => '{CompanyCode} Corporate Key {Date}',

          # ASSETS Tab
          'Asset' => '{CompanyCode} {AssetCode} {Description} {Date}',
          'Disposal' => '{CompanyCode} {AssetCode} Disposal {Date}',
          'Expenses' => '{CompanyCode} {AssetCode} Expenses {Date}',
          'Purchases' => '{CompanyCode} {AssetCode} Purchases {Date}',
          'Valuation' => '{CompanyCode} {AssetCode} Valuation {Date}',
          'Purchase Contract - Draft' => '{CompanyCode} {AssetCode} Purchase Contract DRAFT {Date}',
          'Purchase Contract - Signed' => '{CompanyCode} {AssetCode} Purchase Contract SIGNED {Date}',
          'Service Agreement - Draft' => '{CompanyCode} {AssetCode} Service Agreement DRAFT {Date}',
          'Service Agreement - Signed' => '{CompanyCode} {AssetCode} Service Agreement SIGNED {Date}',

          # ATO Tab
          'ATO Documents' => '{CompanyCode} ATO {Description} {Date}',
          'BAS - Business Activity Statement' => '{CompanyCode} BAS {Period} {Year}',
          'CTR - Company Tax Return' => '{CompanyCode} CTR FY{YY}',
          'Tax Consolidation Schedule' => '{CompanyCode} Tax Consolidation Schedule FY{YY}',
          'TTR - Trust Tax Return' => '{CompanyCode} TTR FY{YY}',

          # BANK Tab
          'Bank Statement' => '{CompanyCode} {Bank} {Account} {Month} {Year}',

          # COMPANY Tab
          'Constitution' => '{CompanyCode} Constitution {Date}',

          # DIVIDENDS Tab
          'Distribution - Draft' => '{CompanyCode} Distribution DRAFT FY{YY}',
          'Distribution - Signed' => '{CompanyCode} Distribution SIGNED FY{YY}',
          'Distribution Declaration' => '{CompanyCode} Distribution Declaration {Beneficiary} FY{YY}',
          'Dividend Declaration' => '{CompanyCode} Dividend Declaration {Beneficiary} FY{YY}',
          'Dividend Payment Record' => '{CompanyCode} Dividend Payment Record {Beneficiary} FY{YY}',
          'Gift Deed' => '{CompanyCode} Gift Deed {Beneficiary} {Date}',
          'Gift Deed - Signed' => '{CompanyCode} Gift Deed - Signed {Beneficiary} {Date}',
          'Gift Deed Return' => '{CompanyCode} Gift Deed Return {Beneficiary} {Date}',

          # FINANCIALS Tab
          'Draft Financials' => '{CompanyCode} Draft Financials FY{YY}',
          'Final Financials' => '{CompanyCode} Final Financials FY{YY}',
          'Final Financials - Signed' => '{CompanyCode} Final Financials - Signed FY{YY}',

          # GENERAL Tab
          'General' => '{CompanyCode} {Description} {Date}',
          'Structure' => '{CompanyCode} Structure {Description} {Date}',

          # INSURANCE Tab
          'Asset Insurance - Draft' => '{CompanyCode} {AssetCode} Insurance DRAFT {Date}',
          'Asset Insurance - Signed' => '{CompanyCode} {AssetCode} Insurance SIGNED {Date}',

          # LOANS Tab
          'Loan Agreement' => '{CompanyCode} {LoanID} Loan from {LenderCode} {AssetCode} {Date}',
          'Loan Agreement - Draft' => '{CompanyCode} {LoanID} Loan from {LenderCode} {AssetCode} DRAFT {Date}',
          'Loan Agreement - Signed' => '{CompanyCode} {LoanID} Loan from {LenderCode} {AssetCode} SIGNED {Date}',
          'Loan Agreement - Lender Copy' => '{CompanyCode} {LoanID} Loan to {BorrowerCode} {AssetCode} {Date}',
          'PPSR Registration' => '{CompanyCode} {LoanID} PPSR {AssetCode} {Date}',
          'Security Deed' => '{CompanyCode} {LoanID} Security Deed {AssetCode} {Date}',
          'Security Deed - Draft' => '{CompanyCode} {LoanID} Security Deed {AssetCode} DRAFT {Date}',
          'Security Deed - Signed' => '{CompanyCode} {LoanID} Security Deed {AssetCode} SIGNED {Date}',

          # MINUTES Tab
          "Directors' Minutes" => '{CompanyCode} Minutes {Date}',
          'Minutes - Draft' => '{CompanyCode} Minutes DRAFT {Date}',
          'Minutes - Signed' => '{CompanyCode} Minutes SIGNED {Date}',

          # REGISTRY Tab
          'Register of Members' => '{CompanyCode} Register of Members {Date}',
          'Share Certificate' => '{CompanyCode} Share Certificate {ShareholderCode} {Date}',
          'Share Registry' => '{CompanyCode} Share Registry {Date}',
          'Share Transfer' => '{CompanyCode} Share Transfer {Date}',

          # TRUST Tab
          'Trust' => '{CompanyCode} Trust {Description} {Date}'
        }

        name_formats.each do |name, format|
          # Escape single quotes for SQL
          escaped_name = name.gsub("'", "''")
          escaped_format = format.gsub("'", "''")
          execute <<-SQL
            UPDATE document_types
            SET name_format = '#{escaped_format}'
            WHERE name = '#{escaped_name}'
          SQL
        end
      end
    end
  end
end

class AddPrimaryTabToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :document_types, :primary_tab, :string
    add_index :document_types, :primary_tab

    reversible do |dir|
      dir.up do
        # Set primary tab for each document type
        # For documents in multiple tabs, primary tab is the main category

        # ATO documents - Primary: ATO
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'ATO'
          WHERE name IN (
            'End of Year ATO Return',
            'Business Activity Statement',
            'ATO Documents',
            'ATO Tax Return',
            'Tax Consolidation Schedule'
          )
        SQL

        # BANK documents - Primary: BANK
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'BANK'
          WHERE name = 'Bank Statement'
        SQL

        # LOANS documents - Primary: LOANS
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'LOANS'
          WHERE name IN (
            'Loan Agreement',
            'Security Deed',
            'Gift Deed Return',
            'PPSR Registration'
          )
        SQL

        # ASSETS documents - Primary: ASSETS
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'ASSETS'
          WHERE name = 'Asset'
        SQL

        # DIVIDENDS documents - Primary: DIVIDENDS
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'DIVIDENDS'
          WHERE name = 'Dividend Payment'
        SQL

        # Distribution - Primary: TRUST (also in DIVIDENDS)
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'TRUST'
          WHERE name = 'Distribution'
        SQL

        # Distribution Resolution - Primary: MINUTES (also in DIVIDENDS, TRUST)
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'MINUTES'
          WHERE name = 'Distribution Resolution'
        SQL

        # ASIC documents - Primary: ASIC
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'ASIC'
          WHERE name IN (
            'End of Year ASIC Return',
            'ASIC Documents',
            'ASIC Company Key',
            'ASIC Solvency Declaration'
          )
        SQL

        # MINUTES documents - Primary: MINUTES
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'MINUTES'
          WHERE name = 'Company Minutes'
        SQL

        # TRUST documents - Primary: TRUST
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'TRUST'
          WHERE name = 'Trust Deed'
        SQL

        # GENERAL documents - Primary: GENERAL
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'GENERAL'
          WHERE name IN (
            'Company Setup',
            'Constitution',
            'Corporate Key',
            'Register of Members'
          )
        SQL

        # STRUCTURE documents - Primary: STRUCTURE
        execute <<-SQL
          UPDATE document_types SET primary_tab = 'STRUCTURE'
          WHERE name IN (
            'Structure',
            'Director and Officer Changes',
            'Registered Office Address'
          )
        SQL
      end
    end
  end
end

class AddTabsAndSourceToDocuments < ActiveRecord::Migration[8.0]
  def change
    # Add tabs to document_types (JSON array of tab names)
    add_column :document_types, :tabs, :jsonb, default: []

    # Add source to company_documents (manual, xero, sharepoint)
    add_column :company_documents, :source, :string, default: 'manual'
    add_index :company_documents, :source

    # Populate tabs for existing document types
    reversible do |dir|
      dir.up do
        # ATO Tab
        execute <<-SQL
          UPDATE document_types SET tabs = '["ATO"]'::jsonb
          WHERE name IN (
            'End of Year ATO Return',
            'Business Activity Statement',
            'ATO Documents',
            'ATO Tax Return',
            'Tax Consolidation Schedule'
          )
        SQL

        # BANK Tab
        execute <<-SQL
          UPDATE document_types SET tabs = '["BANK"]'::jsonb
          WHERE name = 'Bank Statement'
        SQL

        # LOANS Tab
        execute <<-SQL
          UPDATE document_types SET tabs = '["LOANS"]'::jsonb
          WHERE name IN (
            'Loan Agreement',
            'Security Deed',
            'Gift Deed Return',
            'PPSR Registration'
          )
        SQL

        # ASSETS Tab
        execute <<-SQL
          UPDATE document_types SET tabs = '["ASSETS"]'::jsonb
          WHERE name = 'Asset'
        SQL

        # DIVIDENDS Tab (Distribution Resolution appears in multiple tabs)
        execute <<-SQL
          UPDATE document_types SET tabs = '["DIVIDENDS"]'::jsonb
          WHERE name IN (
            'Dividend Payment'
          )
        SQL

        # Distribution appears in DIVIDENDS and TRUST
        execute <<-SQL
          UPDATE document_types SET tabs = '["DIVIDENDS", "TRUST"]'::jsonb
          WHERE name = 'Distribution'
        SQL

        # Distribution Resolution appears in DIVIDENDS, MINUTES, and TRUST
        execute <<-SQL
          UPDATE document_types SET tabs = '["DIVIDENDS", "MINUTES", "TRUST"]'::jsonb
          WHERE name = 'Distribution Resolution'
        SQL

        # ASIC Tab
        execute <<-SQL
          UPDATE document_types SET tabs = '["ASIC"]'::jsonb
          WHERE name IN (
            'End of Year ASIC Return',
            'ASIC Documents',
            'ASIC Company Key',
            'ASIC Solvency Declaration'
          )
        SQL

        # MINUTES Tab
        execute <<-SQL
          UPDATE document_types SET tabs = '["MINUTES"]'::jsonb
          WHERE name = 'Company Minutes'
        SQL

        # TRUST Tab
        execute <<-SQL
          UPDATE document_types SET tabs = '["TRUST"]'::jsonb
          WHERE name = 'Trust Deed'
        SQL

        # GENERAL Tab
        execute <<-SQL
          UPDATE document_types SET tabs = '["GENERAL"]'::jsonb
          WHERE name IN (
            'Company Setup',
            'Constitution',
            'Corporate Key',
            'Register of Members'
          )
        SQL

        # STRUCTURE Tab
        execute <<-SQL
          UPDATE document_types SET tabs = '["STRUCTURE"]'::jsonb
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

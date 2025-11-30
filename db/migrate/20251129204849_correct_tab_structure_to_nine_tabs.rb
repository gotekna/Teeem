class CorrectTabStructureToNineTabs < ActiveRecord::Migration[8.0]
  def up
    # Correct to 9 tabs: ASIC, ASSETS, ATO, BANK, DIVIDENDS, GENERAL, LOANS, MINUTES, FINANCIALS
    # Previous migration incorrectly merged LOANS → BANK
    # Need to revert LOANS back and add FINANCIALS as new tab

    # 1. Revert LOANS: BANK → LOANS (only for loan-related documents)
    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'LOANS',
          folder = 'LOANS'
      WHERE name IN ('Loan Agreement', 'Security Deed')
    SQL

    # 2. Update tabs array - change BANK back to LOANS for loan documents
    execute <<-SQL
      UPDATE document_types
      SET tabs = (
        SELECT jsonb_agg(
          CASE
            WHEN elem::text = '"BANK"' THEN '"LOANS"'::jsonb
            ELSE elem
          END
        )
        FROM jsonb_array_elements(tabs) elem
      )
      WHERE name IN ('Loan Agreement', 'Security Deed')
    SQL

    # 3. Add FINANCIALS tab support
    # Bank Statement documents should appear in both BANK and FINANCIALS tabs
    execute <<-SQL
      UPDATE document_types
      SET tabs = tabs || '["FINANCIALS"]'::jsonb
      WHERE name = 'Bank Statement'
        AND NOT tabs @> '["FINANCIALS"]'::jsonb
    SQL

    # 4. Update company_documents source field - revert LOANS
    execute <<-SQL
      UPDATE company_documents
      SET source = 'LOANS'
      WHERE source = 'BANK'
        AND document_type IN ('Loan Agreement', 'Security Deed')
    SQL
  end

  def down
    # Reverse: merge LOANS back to BANK
    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'BANK',
          folder = 'BANK'
      WHERE primary_tab = 'LOANS'
    SQL

    execute <<-SQL
      UPDATE document_types
      SET tabs = (
        SELECT jsonb_agg(
          CASE
            WHEN elem::text = '"LOANS"' THEN '"BANK"'::jsonb
            ELSE elem
          END
        )
        FROM jsonb_array_elements(tabs) elem
      )
      WHERE name IN ('Loan Agreement', 'Security Deed')
    SQL

    # Remove FINANCIALS from Bank Statement
    execute <<-SQL
      UPDATE document_types
      SET tabs = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(tabs) elem
        WHERE elem::text != '"FINANCIALS"'
      )
      WHERE name = 'Bank Statement'
    SQL
  end
end

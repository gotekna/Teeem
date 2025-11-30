class ConsolidateTabsToSevenStructure < ActiveRecord::Migration[8.0]
  def up
    # Consolidate to 7 tabs: ASIC, ASSETS, ATO, BANK, DIVIDENDS, GENERAL, MINUTES

    # 1. Update primary_tab: TRUST → GENERAL, STRUCTURE → GENERAL, FINANCES → BANK, LOANS → BANK
    execute <<-SQL
      UPDATE document_types
      SET primary_tab = CASE
        WHEN primary_tab = 'TRUST' THEN 'GENERAL'
        WHEN primary_tab = 'STRUCTURE' THEN 'GENERAL'
        WHEN primary_tab = 'FINANCES' THEN 'BANK'
        WHEN primary_tab = 'LOANS' THEN 'BANK'
        ELSE primary_tab
      END
    SQL

    # 2. Update folder: TRUST → GENERAL, STRUCTURE → GENERAL, FINANCES → BANK, LOANS → BANK
    execute <<-SQL
      UPDATE document_types
      SET folder = CASE
        WHEN folder = 'TRUST' THEN 'GENERAL'
        WHEN folder = 'STRUCTURE' THEN 'GENERAL'
        WHEN folder = 'FINANCES' THEN 'BANK'
        WHEN folder = 'LOANS' THEN 'BANK'
        ELSE folder
      END
    SQL

    # 3. Update tabs array - replace values in JSONB array
    # This uses PostgreSQL's jsonb_path_query_array to transform the array
    execute <<-SQL
      UPDATE document_types
      SET tabs = (
        SELECT jsonb_agg(
          CASE
            WHEN elem::text = '"TRUST"' THEN '"GENERAL"'::jsonb
            WHEN elem::text = '"STRUCTURE"' THEN '"GENERAL"'::jsonb
            WHEN elem::text = '"FINANCES"' THEN '"BANK"'::jsonb
            WHEN elem::text = '"LOANS"' THEN '"BANK"'::jsonb
            ELSE elem
          END
        )
        FROM jsonb_array_elements(tabs) elem
      )
      WHERE tabs IS NOT NULL
    SQL

    # 4. Remove duplicates from tabs array after consolidation
    execute <<-SQL
      UPDATE document_types
      SET tabs = (
        SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
        FROM jsonb_array_elements(tabs) elem
      )
      WHERE tabs IS NOT NULL
    SQL

    # 5. Update company_documents source field
    execute <<-SQL
      UPDATE company_documents
      SET source = CASE
        WHEN source = 'TRUST' THEN 'GENERAL'
        WHEN source = 'STRUCTURE' THEN 'GENERAL'
        WHEN source = 'FINANCES' THEN 'BANK'
        WHEN source = 'LOANS' THEN 'BANK'
        ELSE source
      END
      WHERE source IN ('TRUST', 'STRUCTURE', 'FINANCES', 'LOANS')
    SQL
  end

  def down
    # Reverse the consolidation
    # Note: This is not a perfect reverse as we lose information about which
    # documents were originally TRUST vs STRUCTURE (both became GENERAL)

    execute <<-SQL
      UPDATE document_types
      SET primary_tab = CASE
        WHEN primary_tab = 'GENERAL' AND name LIKE '%Trust%' THEN 'TRUST'
        WHEN primary_tab = 'GENERAL' AND name LIKE '%Structure%' THEN 'STRUCTURE'
        WHEN primary_tab = 'BANK' THEN 'FINANCES'
        ELSE primary_tab
      END
    SQL

    execute <<-SQL
      UPDATE document_types
      SET folder = CASE
        WHEN folder = 'GENERAL' AND name LIKE '%Trust%' THEN 'TRUST'
        WHEN folder = 'GENERAL' AND name LIKE '%Structure%' THEN 'STRUCTURE'
        WHEN folder = 'BANK' THEN 'FINANCES'
        ELSE folder
      END
    SQL
  end
end

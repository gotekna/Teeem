class AddFinancialsDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # Add Draft Financials document type
    execute <<-SQL
      INSERT INTO document_types (name, category, folder, description, requires_filing, retention_years, active, primary_tab, tabs, created_at, updated_at)
      VALUES (
        'Draft Financials',
        'financial',
        'FINANCIALS',
        'Draft financial statements from accountant',
        false,
        7,
        true,
        'FINANCIALS',
        '["FINANCIALS", "ATO"]'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (name) DO NOTHING
    SQL

    # Add Final Financials document type
    execute <<-SQL
      INSERT INTO document_types (name, category, folder, description, requires_filing, retention_years, active, primary_tab, tabs, created_at, updated_at)
      VALUES (
        'Final Financials',
        'financial',
        'FINANCIALS',
        'Final financial statements ready to lodge with ATO',
        true,
        7,
        true,
        'FINANCIALS',
        '["FINANCIALS", "ATO"]'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (name) DO NOTHING
    SQL

    # Update Bank Statement to have FINANCIALS as primary tab
    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'FINANCIALS'
      WHERE name = 'Bank Statement'
    SQL
  end

  def down
    execute "DELETE FROM document_types WHERE name IN ('Draft Financials', 'Final Financials')"

    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'BANK'
      WHERE name = 'Bank Statement'
    SQL
  end
end

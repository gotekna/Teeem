class AddTrustAndGeneralDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # Add Trust document type - appears in multiple tabs
    execute <<-SQL
      INSERT INTO document_types (name, category, folder, description, requires_filing, retention_years, active, primary_tab, tabs, created_at, updated_at)
      VALUES (
        'Trust',
        'corporate',
        'TRUST',
        'General trust document',
        false,
        7,
        true,
        'TRUST',
        '["TRUST", "MINUTES", "DIVIDENDS", "STRUCTURE", "GENERAL"]'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (name) DO NOTHING
    SQL

    # Add General document type - appears in all tabs as catch-all
    execute <<-SQL
      INSERT INTO document_types (name, category, folder, description, requires_filing, retention_years, active, primary_tab, tabs, created_at, updated_at)
      VALUES (
        'General',
        'corporate',
        'GENERAL',
        'General corporate document',
        false,
        7,
        true,
        'GENERAL',
        '["ATO", "ASIC", "TRUST", "MINUTES", "DIVIDENDS", "STRUCTURE", "GENERAL", "FINANCES", "ASSETS"]'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (name) DO NOTHING
    SQL

    # Add Structure document type - appears in multiple tabs
    execute <<-SQL
      INSERT INTO document_types (name, category, folder, description, requires_filing, retention_years, active, primary_tab, tabs, created_at, updated_at)
      VALUES (
        'Structure',
        'corporate',
        'STRUCTURE',
        'General corporate structure document',
        false,
        7,
        true,
        'STRUCTURE',
        '["STRUCTURE", "ASIC", "TRUST", "GENERAL"]'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (name) DO NOTHING
    SQL
  end

  def down
    execute "DELETE FROM document_types WHERE name IN ('Trust', 'General', 'Structure')"
  end
end

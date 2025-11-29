class AddTrustAndGeneralDocumentTypes < ActiveRecord::Migration[8.0]
  def up
    # Add Trust document type for general trust documents
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
        '["TRUST"]'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (name) DO NOTHING
    SQL

    # Add General document type for general corporate documents
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
        '["GENERAL"]'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (name) DO NOTHING
    SQL
  end

  def down
    execute "DELETE FROM document_types WHERE name IN ('Trust', 'General')"
  end
end

class AddTrustTaxReturnDocumentType < ActiveRecord::Migration[8.0]
  def up
    # Add TTR - Trust Tax Return document type
    execute <<-SQL
      INSERT INTO document_types (name, category, folder, description, requires_filing, retention_years, active, primary_tab, tabs, created_at, updated_at)
      VALUES (
        'TTR - Trust Tax Return',
        'tax',
        'ATO',
        'Trust Tax Return lodged with the ATO',
        true,
        7,
        true,
        'ATO',
        '["ATO", "TRUST"]'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (name) DO NOTHING
    SQL
  end

  def down
    execute "DELETE FROM document_types WHERE name = 'TTR - Trust Tax Return'"
  end
end

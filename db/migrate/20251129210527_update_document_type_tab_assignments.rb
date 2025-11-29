class UpdateDocumentTypeTabAssignments < ActiveRecord::Migration[8.0]
  def up
    # Gift Deed Return → DIVIDENDS
    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'DIVIDENDS',
          folder = 'DIVIDENDS',
          tabs = '["DIVIDENDS"]'::jsonb
      WHERE name = 'Gift Deed Return'
    SQL

    # PPSR Registration → LOANS
    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'LOANS',
          folder = 'LOANS',
          tabs = '["LOANS"]'::jsonb
      WHERE name = 'PPSR Registration'
    SQL

    # Distribution → DIVIDENDS only (remove from GENERAL)
    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'DIVIDENDS',
          folder = 'DIVIDENDS',
          tabs = '["DIVIDENDS"]'::jsonb
      WHERE name = 'Distribution'
    SQL

    # ASIC Form 484 documents → ASIC
    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'ASIC',
          folder = 'ASIC',
          tabs = '["ASIC"]'::jsonb
      WHERE name IN ('ASIC Form 484 - Director Changes', 'ASIC Form 484 - Registered Office')
    SQL
  end

  def down
    # Revert changes
    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'BANK',
          folder = 'BANK',
          tabs = '["BANK"]'::jsonb
      WHERE name IN ('Gift Deed Return', 'PPSR Registration')
    SQL

    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'GENERAL',
          folder = 'GENERAL',
          tabs = '["DIVIDENDS", "GENERAL"]'::jsonb
      WHERE name = 'Distribution'
    SQL

    execute <<-SQL
      UPDATE document_types
      SET primary_tab = 'GENERAL',
          folder = 'GENERAL',
          tabs = '["GENERAL"]'::jsonb
      WHERE name IN ('ASIC Form 484 - Director Changes', 'ASIC Form 484 - Registered Office')
    SQL
  end
end

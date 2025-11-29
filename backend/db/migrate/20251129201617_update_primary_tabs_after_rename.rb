class UpdatePrimaryTabsAfterRename < ActiveRecord::Migration[8.0]
  def up
    # Update primary tabs to match the new document type names
    # ATO documents
    execute "UPDATE document_types SET primary_tab = 'ATO' WHERE name = 'CTR - Company Tax Return'"
    execute "UPDATE document_types SET primary_tab = 'ATO' WHERE name = 'BAS - Business Activity Statement'"

    # ASIC documents
    execute "UPDATE document_types SET primary_tab = 'ASIC' WHERE name = 'ASIC Annual Review'"
    execute "UPDATE document_types SET primary_tab = 'ASIC' WHERE name = 'ASIC Form 485 - Solvency Declaration'"
    execute "UPDATE document_types SET primary_tab = 'STRUCTURE' WHERE name = 'ASIC Form 484 - Director Changes'"
    execute "UPDATE document_types SET primary_tab = 'STRUCTURE' WHERE name = 'ASIC Form 484 - Registered Office'"

    # Corporate documents
    execute "UPDATE document_types SET primary_tab = 'MINUTES' WHERE name = 'Directors'' Minutes'"
    execute "UPDATE document_types SET primary_tab = 'MINUTES' WHERE name = 'Directors'' Resolution - Distribution'"
    execute "UPDATE document_types SET primary_tab = 'DIVIDENDS' WHERE name = 'Dividend Payment Record'"
  end

  def down
    # No need to reverse - this is just fixing data
  end
end

class AddCorporateEntityTypesToSettings < ActiveRecord::Migration[7.2]
  def change
    add_column :corporate_settings, :corporate_entity_types, :jsonb, default: [
      "Company",
      "Trust", 
      "Superfund",
      "Charity",
      "Corporate Trustee",
      "Sole Trader"
    ], null: false
  end
end

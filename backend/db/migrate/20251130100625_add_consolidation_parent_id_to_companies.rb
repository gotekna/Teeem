class AddConsolidationParentIdToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :consolidation_parent_id, :bigint
    add_index :companies, :consolidation_parent_id
    add_foreign_key :companies, :companies, column: :consolidation_parent_id, on_delete: :nullify
  end
end

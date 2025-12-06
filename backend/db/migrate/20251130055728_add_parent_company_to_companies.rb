class AddParentCompanyToCompanies < ActiveRecord::Migration[8.0]
  def change
    # Self-referential parent company relationship for corporate hierarchy
    add_reference :companies, :parent_company, foreign_key: { to_table: :companies }, null: true

    # Track hierarchy level (0 = top-level, 1 = subsidiary, 2 = sub-subsidiary, etc.)
    add_column :companies, :hierarchy_level, :integer, default: 0

    # Add index for efficient hierarchy queries
    add_index :companies, [ :company_group_id, :parent_company_id ], name: 'index_companies_on_group_and_parent'
  end
end

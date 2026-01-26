class FixPricebookCategoriesUniqueIndex < ActiveRecord::Migration[8.0]
  def change
    # Fix SSoT violation: unique index on name should be tenant-scoped
    # Old index prevented same category name in different tenants
    remove_index :pricebook_categories, :name, unique: true
    add_index :pricebook_categories, [:company_group_id, :name], unique: true,
              name: "index_pricebook_categories_on_tenant_and_name"
  end
end

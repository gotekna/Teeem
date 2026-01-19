class FixPricebooksAndSmScheduleMastersUniqueIndexes < ActiveRecord::Migration[8.0]
  def change
    # Fix SSoT violation: unique index on item_code should be tenant-scoped
    remove_index :pricebooks, :item_code, unique: true
    add_index :pricebooks, [:company_group_id, :item_code], unique: true,
              name: "index_pricebooks_on_tenant_and_item_code"
  end
end

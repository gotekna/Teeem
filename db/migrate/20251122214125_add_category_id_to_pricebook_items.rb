class AddCategoryIdToPricebookItems < ActiveRecord::Migration[8.0]
  def change
    add_column :pricebook_items, :category_id, :integer
    add_index :pricebook_items, :category_id
    add_foreign_key :pricebook_items, :pricebook_categories, column: :category_id, on_delete: :nullify
  end
end

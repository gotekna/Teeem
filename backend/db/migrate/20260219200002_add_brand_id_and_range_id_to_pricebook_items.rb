class AddBrandIdAndRangeIdToPricebookItems < ActiveRecord::Migration[8.0]
  def change
    add_column :pricebooks, :brand_id, :bigint
    add_column :pricebooks, :range_id, :bigint

    add_index :pricebooks, :brand_id
    add_index :pricebooks, :range_id

    add_foreign_key :pricebooks, :pricebook_brands, column: :brand_id, on_delete: :nullify
    add_foreign_key :pricebooks, :pricebook_ranges, column: :range_id, on_delete: :nullify
  end
end

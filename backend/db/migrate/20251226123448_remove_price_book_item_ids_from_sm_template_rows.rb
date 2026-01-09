class RemovePriceBookItemIdsFromSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    remove_column :sm_template_rows, :price_book_item_ids, :integer, array: true, default: []
  end
end

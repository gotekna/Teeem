class RenamePricebookItemsToPricebook < ActiveRecord::Migration[8.0]
  def change
    rename_table :pricebook_items, :pricebook
  end
end

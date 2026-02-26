class AddPricebookItemIdToTenderDocumentItems < ActiveRecord::Migration[8.0]
  def change
    add_column :tender_document_items, :pricebook_item_id, :bigint
    add_index :tender_document_items, :pricebook_item_id
  end
end

class AddOcrDataToBillInbox < ActiveRecord::Migration[8.0]
  def change
    add_column :bill_inboxes, :ocr_extraction_result, :jsonb
    add_column :bill_inboxes, :comparison_data, :jsonb
  end
end

class AddGstCodeToPurchaseOrderLineItems < ActiveRecord::Migration[8.0]
  def change
    add_column :purchase_order_line_items, :gst_code, :string, default: 'GST'
  end
end

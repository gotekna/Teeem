class AddColourSpecToPurchaseOrderLineItems < ActiveRecord::Migration[8.0]
  def change
    add_column :purchase_order_line_items, :colour, :string
    add_column :purchase_order_line_items, :colour_code, :string
    add_column :purchase_order_line_items, :spec_reference, :string
  end
end

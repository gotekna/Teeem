class CreatePurchaseOrderLineItems < ActiveRecord::Migration[8.0]
  def change
    create_table :purchase_order_line_items do |t|
      t.references :purchase_order, null: false, foreign_key: true
      t.references :pricebook_item, foreign_key: true
      t.text :description, null: false
      t.decimal :quantity, precision: 15, scale: 3, null: false, default: 1.0
      t.decimal :unit_price, precision: 15, scale: 2, null: false, default: 0.0
      t.decimal :tax_amount, precision: 15, scale: 2, default: 0.0
      t.decimal :total_amount, precision: 15, scale: 2, default: 0.0
      t.text :notes
      t.integer :line_number, null: false, default: 1

      t.timestamps
    end

    add_index :purchase_order_line_items, [ :purchase_order_id, :line_number ], name: 'index_po_line_items_on_po_and_line_num'
  end
end

class AddPoLineItemsToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_template_rows, :po_line_items, :jsonb, default: []
    # Structure: [{price_history_id: 123, qty: 1}, ...]
  end
end

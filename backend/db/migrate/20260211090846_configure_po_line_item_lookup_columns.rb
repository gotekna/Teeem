# frozen_string_literal: true

# Configure lookup columns on PurchaseOrderLineItem Foundation
# - purchase_order_id → shows po_task_name (sm_task.name via PurchaseOrder#po_task_name)
# - pricebook_item_id → shows name from PricebookItem
class ConfigurePoLineItemLookupColumns < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_by(slug: "purchase_order_line_items")
    return unless foundation

    po_foundation = Foundation.find_by(slug: "purchase-orders")
    pricebook_foundation = Foundation.find_by(slug: "pricebook-items")

    # Configure purchase_order_id lookup → shows task name
    if po_foundation
      # Ensure po_task_name column exists on purchase-orders Foundation
      # (virtual column - PurchaseOrder#po_task_name returns sm_task.name)
      Column.find_or_create_by!(foundation_id: po_foundation.id, column_name: "po_task_name") do |c|
        c.name = "Task Name"
        c.column_type = "single_line_text"
        c.position = 999
        c.searchable = false
        c.is_title = false
        c.required = false
      end

      col = Column.find_by(foundation_id: foundation.id, column_name: "purchase_order_id")
      if col
        col.update!(
          lookup_foundation_id: po_foundation.id,
          lookup_foundation_slug: po_foundation.slug,
          lookup_display_column: "po_task_name"
        )
        puts "  ✅ purchase_order_id → #{po_foundation.slug} (display: po_task_name)"
      end
    end

    # Configure pricebook_item_id lookup → shows item name
    if pricebook_foundation
      col = Column.find_by(foundation_id: foundation.id, column_name: "pricebook_item_id")
      if col
        col.update!(
          lookup_foundation_id: pricebook_foundation.id,
          lookup_foundation_slug: pricebook_foundation.slug,
          lookup_display_column: "item_code"
        )
        puts "  ✅ pricebook_item_id → #{pricebook_foundation.slug} (display: name)"
      end
    end
  end

  def down
    foundation = Foundation.find_by(slug: "purchase_order_line_items")
    return unless foundation

    %w[purchase_order_id pricebook_item_id].each do |col_name|
      col = Column.find_by(foundation_id: foundation.id, column_name: col_name)
      col&.update!(lookup_foundation_id: nil, lookup_foundation_slug: nil, lookup_display_column: nil)
    end
  end
end

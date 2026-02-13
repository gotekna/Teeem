# frozen_string_literal: true

# Migration: Create Foundation for PurchaseOrderLineItem
#
# 1. Creates Foundation record (not tenant-scoped) so TeeemTableView can display PO line items
# 2. Syncs columns from DB schema with appropriate types and visibility
# NOTE: PO Line Items tab is a frontend sub-tab within Purchase Orders (no WarehouseFolder needed)
#
class CreatePoLineItemsFoundationAndJobTab < ActiveRecord::Migration[7.2]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. Create Foundation for PurchaseOrderLineItem
    # ═══════════════════════════════════════════════════════════════════════════
    foundation = Foundation.find_or_create_by!(slug: "purchase_order_line_items") do |f|
      f.name = "Purchase Order Line Items"
      f.singular_name = "Purchase Order Line Item"
      f.plural_name = "Purchase Order Line Items"
      f.database_table_name = "purchase_order_line_items"
      f.table_type = "system"
      f.model_class = "PurchaseOrderLineItem"
      f.icon = "List"
      f.feature = "Purchase Orders"
      f.searchable = true
      f.is_live = true
      f.has_ui = true
      f.has_saved_views = true
      f.allow_reserved_name = true
    end

    # Ensure model_class is set even if Foundation already existed (find_or_create_by block only runs on create)
    foundation.update!(model_class: "PurchaseOrderLineItem") if foundation.model_class.blank?

    puts "  ✅ Created Foundation: #{foundation.name} (ID: #{foundation.id})"

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. Sync columns from database schema
    # ═══════════════════════════════════════════════════════════════════════════
    columns_config = [
      { column_name: "id",                position: 1,  column_type: "whole_number",      visible: false, searchable: false },
      { column_name: "purchase_order_id", position: 2,  column_type: "lookup",            visible: true,  searchable: false, name: "Purchase Order" },
      { column_name: "pricebook_item_id", position: 3,  column_type: "lookup",            visible: false, searchable: false, name: "Pricebook Item" },
      { column_name: "description",       position: 4,  column_type: "multiple_lines_text", visible: true, searchable: true,  name: "Description", is_title: true },
      { column_name: "quantity",          position: 5,  column_type: "number",            visible: true,  searchable: false, name: "Quantity" },
      { column_name: "unit_price",        position: 6,  column_type: "currency",          visible: true,  searchable: false, name: "Unit Price" },
      { column_name: "gst_code",          position: 7,  column_type: "single_line_text",  visible: true,  searchable: false, name: "GST Code" },
      { column_name: "tax_amount",        position: 8,  column_type: "currency",          visible: true,  searchable: false, name: "Tax" },
      { column_name: "total_amount",      position: 9,  column_type: "currency",          visible: true,  searchable: false, name: "Total" },
      { column_name: "colour",            position: 10, column_type: "single_line_text",  visible: true,  searchable: false, name: "Colour" },
      { column_name: "colour_code",       position: 11, column_type: "single_line_text",  visible: false, searchable: false, name: "Colour Code" },
      { column_name: "spec_reference",    position: 12, column_type: "single_line_text",  visible: true,  searchable: true,  name: "Spec Reference" },
      { column_name: "line_number",       position: 13, column_type: "whole_number",      visible: true,  searchable: false, name: "Line #" },
      { column_name: "notes",             position: 14, column_type: "multiple_lines_text", visible: false, searchable: true, name: "Notes" },
      { column_name: "created_at",        position: 15, column_type: "date_and_time",     visible: false, searchable: false, name: "Created At" },
      { column_name: "updated_at",        position: 16, column_type: "date_and_time",     visible: false, searchable: false, name: "Updated At" },
    ]

    columns_config.each do |config|
      Column.find_or_create_by!(foundation_id: foundation.id, column_name: config[:column_name]) do |col|
        col.name = config[:name] || config[:column_name].titleize
        col.column_type = config[:column_type]
        col.position = config[:position]
        col.searchable = config[:searchable]
        col.is_title = config[:is_title] || false
        col.required = false
      end
    end

    puts "  ✅ Synced #{columns_config.size} columns"
  end

  def down
    # Remove Foundation columns then Foundation
    foundation = Foundation.find_by(slug: "purchase_order_line_items")
    if foundation
      foundation.columns.destroy_all
      foundation.destroy
    end
  end
end

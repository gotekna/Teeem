# frozen_string_literal: true

# Migration: Create Foundation for PurchaseOrderLineItem + Job tab
#
# 1. Creates Foundation record (not tenant-scoped) so TeeemTableView can display PO line items
# 2. Syncs columns from DB schema with appropriate types and visibility
# 3. Creates WarehouseFolder records for ALL tenants (job tab: "Purchase Order Lines")
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

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. Create WarehouseFolder tab for ALL tenants (multi-tenant safe)
    # ═══════════════════════════════════════════════════════════════════════════
    job_type = execute("SELECT id FROM warehouse_types WHERE code = 'job' LIMIT 1").first
    unless job_type
      puts "  ⚠️  No 'job' warehouse_type found - skipping tab creation"
      return
    end
    job_type_id = job_type["id"]

    # Find the position of purchase-orders tab so we insert right after it
    tenants = execute("SELECT id, name FROM tenants ORDER BY id")

    if tenants.none?
      puts "  ⚠️  No tenants found - skipping tab creation"
      return
    end

    tenants.each do |tenant|
      tenant_id = tenant["id"]
      tenant_name = tenant["name"]

      # Get position of purchase-orders tab for this tenant
      po_tab = execute(<<-SQL.squish).first
        SELECT order_position FROM warehouse_folders
        WHERE warehouse_type_id = #{job_type_id}
          AND tab_key = 'purchase-orders'
          AND tenant_id = #{tenant_id}
        LIMIT 1
      SQL

      # Position right after purchase-orders (default to 8 if not found)
      new_position = po_tab ? po_tab["order_position"].to_i + 1 : 8

      # Idempotent: skip if already exists
      existing = execute(<<-SQL.squish).first
        SELECT id FROM warehouse_folders
        WHERE warehouse_type_id = #{job_type_id}
          AND tab_key = 'purchase-order-lines'
          AND tenant_id = #{tenant_id}
        LIMIT 1
      SQL
      next if existing

      execute(<<-SQL.squish)
        INSERT INTO warehouse_folders (
          warehouse_type_id, tenant_id, name, display_name, folder_segment,
          tab_key, tab_type, tab_group, icon_name,
          order_position, enabled, warehouse_enabled, is_system,
          parent_id, created_at, updated_at
        ) VALUES (
          #{job_type_id}, #{tenant_id}, 'Purchase Order Lines', 'Purchase Order Lines', NULL,
          'purchase-order-lines', 'system', 'data', 'List',
          #{new_position}, TRUE, FALSE, FALSE,
          NULL, NOW(), NOW()
        )
      SQL

      puts "  ✅ Created 'Purchase Order Lines' tab for tenant: #{tenant_name}"
    end
  end

  def down
    # Remove WarehouseFolder tabs
    execute(<<-SQL.squish)
      DELETE FROM warehouse_folders
      WHERE tab_key = 'purchase-order-lines'
        AND display_name = 'Purchase Order Lines'
    SQL

    # Remove Foundation columns then Foundation
    foundation = Foundation.find_by(slug: "purchase_order_line_items")
    if foundation
      foundation.columns.destroy_all
      foundation.destroy
    end
  end
end

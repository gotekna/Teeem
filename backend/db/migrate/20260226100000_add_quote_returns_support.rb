# frozen_string_literal: true

# Migration: Add Quote Returns Support
#
# Adds:
# 1. Confirmation tracking columns to custom_quote_suppliers and quote_trackers
#    (who confirmed the quote matches the request, and when)
# 2. quote_warehouse_document_id to purchase_orders (links accepted quote PDF to PO)
# 3. WarehouseFolder tab entry: Quote Returns under Estimating (per tenant)
#
class AddQuoteReturnsSupport < ActiveRecord::Migration[8.0]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. Confirmation tracking on custom_quote_suppliers
    # ═══════════════════════════════════════════════════════════════════════════
    add_column :custom_quote_suppliers, :confirmed_by_id, :bigint, null: true
    add_column :custom_quote_suppliers, :confirmed_at, :datetime, null: true
    add_column :custom_quote_suppliers, :confirmation_notes, :text, null: true
    add_foreign_key :custom_quote_suppliers, :users, column: :confirmed_by_id

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. Confirmation tracking on quote_trackers
    # ═══════════════════════════════════════════════════════════════════════════
    add_column :quote_trackers, :confirmed_by_id, :bigint, null: true
    add_column :quote_trackers, :confirmed_at, :datetime, null: true
    add_column :quote_trackers, :confirmation_notes, :text, null: true
    add_foreign_key :quote_trackers, :users, column: :confirmed_by_id

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. Link accepted quote PDF to PurchaseOrder
    # ═══════════════════════════════════════════════════════════════════════════
    add_reference :purchase_orders, :quote_warehouse_document,
      foreign_key: { to_table: :warehouse_documents }, null: true

    # ═══════════════════════════════════════════════════════════════════════════
    # 4. WarehouseFolder tab: Quote Returns under Estimating (per tenant)
    # ═══════════════════════════════════════════════════════════════════════════
    tenant_ids = execute("SELECT id FROM tenants").map { |r| r["id"] }

    tenant_ids.each do |tenant_id|
      # Find Estimating parent for this tenant
      estimating = execute(<<-SQL.squish)
        SELECT id FROM warehouse_folders
        WHERE tenant_id = #{tenant_id}
          AND tab_key = 'jobs'
          AND parent_id IS NULL
        LIMIT 1
      SQL

      next unless estimating.count.positive?
      estimating_id = estimating.first['id']

      # Check if already exists for this tenant
      existing = execute(<<-SQL.squish)
        SELECT id FROM warehouse_folders
        WHERE tenant_id = #{tenant_id}
          AND tab_key = 'quote-returns'
        LIMIT 1
      SQL

      next if existing.count.positive?

      # Look up warehouse_type_id for 'job' in this tenant
      wt_result = execute(<<-SQL.squish)
        SELECT id FROM warehouse_types
        WHERE tenant_id = #{tenant_id} AND code = 'job'
        LIMIT 1
      SQL
      next unless wt_result.count.positive?
      wt_id = wt_result.first['id']

      # Find the Custom Quotes tab position so we can insert after it
      cq_pos = execute(<<-SQL.squish)
        SELECT order_position FROM warehouse_folders
        WHERE tenant_id = #{tenant_id}
          AND tab_key = 'custom-quotes'
          AND parent_id = #{estimating_id}
        LIMIT 1
      SQL

      if cq_pos.count.positive?
        next_pos = cq_pos.first['order_position'].to_i + 1
        # Shift any tabs at or after this position
        execute(<<-SQL.squish)
          UPDATE warehouse_folders
          SET order_position = order_position + 1
          WHERE tenant_id = #{tenant_id}
            AND parent_id = #{estimating_id}
            AND order_position >= #{next_pos}
        SQL
      else
        # Fallback: append at end
        max_pos = execute(<<-SQL.squish)
          SELECT COALESCE(MAX(order_position), 0) as max_pos
          FROM warehouse_folders
          WHERE tenant_id = #{tenant_id}
            AND parent_id = #{estimating_id}
        SQL
        next_pos = max_pos.first['max_pos'].to_i + 1
      end

      execute(<<-SQL.squish)
        INSERT INTO warehouse_folders (
          tenant_id, warehouse_type_id, name, tab_key, display_name, parent_id, tab_group,
          order_position, enabled, is_system, icon_name, component_name,
          warehouse_enabled,
          created_at, updated_at
        )
        VALUES (
          #{tenant_id},
          #{wt_id},
          'Quote Returns',
          'quote-returns',
          'Quote Returns',
          #{estimating_id},
          'documents',
          #{next_pos},
          true,
          true,
          'clipboard-check',
          'JobQuoteReturnsTab',
          false,
          NOW(), NOW()
        )
      SQL

      puts "[AddQuoteReturnsSupport] Created Quote Returns tab for tenant #{tenant_id}"
    end
  end

  def down
    # Remove warehouse folder tabs
    execute("DELETE FROM warehouse_folders WHERE tab_key = 'quote-returns'")

    remove_reference :purchase_orders, :quote_warehouse_document, foreign_key: { to_table: :warehouse_documents }

    remove_column :quote_trackers, :confirmation_notes
    remove_column :quote_trackers, :confirmed_at
    remove_foreign_key :quote_trackers, :users, column: :confirmed_by_id
    remove_column :quote_trackers, :confirmed_by_id

    remove_column :custom_quote_suppliers, :confirmation_notes
    remove_column :custom_quote_suppliers, :confirmed_at
    remove_foreign_key :custom_quote_suppliers, :users, column: :confirmed_by_id
    remove_column :custom_quote_suppliers, :confirmed_by_id
  end
end

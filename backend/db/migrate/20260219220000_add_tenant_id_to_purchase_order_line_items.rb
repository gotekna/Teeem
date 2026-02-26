# frozen_string_literal: true

# FRC (Feb 2026): PurchaseOrderLineItem had no tenant_id column and no acts_as_tenant.
# This meant PurchaseOrderLineItem.delete_all inside ActsAsTenant.with_tenant() was
# UNSCOPED — it deleted ALL records from ALL tenants instead of just the current tenant.
# This caused total loss of Tekna's PO line items (imported via Unreal).
#
# Fix: Add tenant_id column, backfill from parent purchase_order, add acts_as_tenant.
class AddTenantIdToPurchaseOrderLineItems < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add nullable tenant_id column
    add_column :purchase_order_line_items, :tenant_id, :bigint

    # Step 2: Backfill from parent purchase_order
    execute <<~SQL
      UPDATE purchase_order_line_items
      SET tenant_id = purchase_orders.tenant_id
      FROM purchase_orders
      WHERE purchase_order_line_items.purchase_order_id = purchase_orders.id
        AND purchase_order_line_items.tenant_id IS NULL
    SQL

    # Step 3: Add index (acts_as_tenant uses this for scoping)
    add_index :purchase_order_line_items, :tenant_id

    # Step 4: Add FK constraint
    add_foreign_key :purchase_order_line_items, :tenants
  end

  def down
    remove_foreign_key :purchase_order_line_items, :tenants
    remove_index :purchase_order_line_items, :tenant_id
    remove_column :purchase_order_line_items, :tenant_id
  end
end

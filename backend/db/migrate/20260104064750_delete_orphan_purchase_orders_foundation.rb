# frozen_string_literal: true

# Delete orphan "Purchase Orders" foundation that points to non-existent table
#
# There are two "Purchase Orders" foundations:
# 1. REAL: slug "purchase-orders" → table "purchase_orders" (2224 records)
# 2. ORPHAN: slug "purchase_orders" → table "user_purchase_orders_eb02f084" (doesn't exist)
#
# This migration deletes the orphan foundation (#2) and its columns
class DeleteOrphanPurchaseOrdersFoundation < ActiveRecord::Migration[8.0]
  def up
    # Find the orphan foundation by its unique characteristics
    orphan = Foundation.find_by(
      slug: 'purchase_orders',
      database_table_name: 'user_purchase_orders_eb02f084'
    )

    if orphan
      column_count = orphan.columns.count

      # Delete columns first (due to foreign key)
      orphan.columns.destroy_all

      # Delete the foundation
      orphan.destroy!

      puts "  ✅ Deleted orphan foundation 'Purchase Orders' (slug: purchase_orders)"
      puts "     - Removed #{column_count} columns"
      puts "     - Table 'user_purchase_orders_eb02f084' never existed"
    else
      puts "  ⚠️  Orphan foundation not found (may have been deleted already)"
    end
  end

  def down
    # Recreating the orphan foundation doesn't make sense
    # It was pointing to a non-existent table
    puts "  ⚠️  Cannot restore orphan foundation - it pointed to non-existent table"
  end
end

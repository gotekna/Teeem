# frozen_string_literal: true

# FRC: Drop legacy `category` varchar column from pricebooks table.
#
# Root cause: The pricebooks table had BOTH:
#   - `category` (varchar) - legacy text column with category names
#   - `category_id` (integer FK) - proper lookup to pricebook_categories table
#
# All code has been updated to use `category_id` exclusively:
#   - Model scopes (by_category, by_risk_level, categories, missing_info_score)
#   - Controller (sort, filter, strong params, supplier filtering)
#   - Health controller & checks (missing_items, incomplete categories)
#   - Import services (PricebookImportService, PricebookItemsImporter)
#   - Export service (PriceHistoryExportService)
#   - Supplier pricing controller (copy, remove categories)
#   - Search trigger (already updated in 20260219200005)
#
# The varchar column is now dead weight that causes confusion.
class DropPricebookCategoryVarcharColumn < ActiveRecord::Migration[8.0]
  def up
    # Remove indexes that reference the varchar category column
    remove_index :pricebooks, name: "index_pricebook_items_on_category_active_supplier", if_exists: true
    remove_index :pricebooks, name: "index_pricebooks_on_category", if_exists: true

    # Drop the varchar column (category_id integer FK remains)
    remove_column :pricebooks, :category, :string
  end

  def down
    # Re-add the varchar column
    add_column :pricebooks, :category, :string

    # Populate from category_id lookup
    execute <<~SQL
      UPDATE pricebooks
      SET category = pc.name
      FROM pricebook_categories pc
      WHERE pc.id = pricebooks.category_id
        AND pricebooks.category_id IS NOT NULL
    SQL

    # Re-add indexes
    add_index :pricebooks, :category, name: "index_pricebooks_on_category"
    add_index :pricebooks, [:category, :is_active, :supplier_id], name: "index_pricebook_items_on_category_active_supplier"
  end
end

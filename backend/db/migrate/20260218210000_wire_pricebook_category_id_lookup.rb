class WirePricebookCategoryIdLookup < ActiveRecord::Migration[8.0]
  # Wire up pricebook_items.category_id (FK to pricebook_categories) which has
  # existed since Nov 2025 but was never populated.
  #
  # Steps:
  #   1. Normalise "Fire System" -> "FIRE SYSTEM" in pricebook_categories
  #   2. Populate category_id from text category field (per tenant)
  #   3. Convert Foundation column: category (single_line_text) -> category_id (lookup)
  #
  # Uses raw SQL for steps 1-2 to bypass acts_as_tenant scoping.

  def up
    # Step 1: Normalise inconsistent casing in pricebook_categories
    execute "UPDATE pricebook_categories SET name = 'FIRE SYSTEM' WHERE name = 'Fire System'"
    # Also fix the text field on items (from previous migration attempt)
    execute "UPDATE pricebooks SET category = 'FIRE SYSTEM' WHERE category = 'Fire System'"

    # Step 2: Populate category_id by matching text category -> pricebook_categories.name
    # Done per-tenant to respect multi-tenancy. category_id FK has no tenant scope itself
    # but pricebook_categories are tenant-scoped so we match on both name AND tenant_id.
    execute <<~SQL
      UPDATE pricebooks p
      SET category_id = pc.id
      FROM pricebook_categories pc
      WHERE pc.name = p.category
        AND pc.tenant_id = p.tenant_id
        AND p.category IS NOT NULL
        AND p.category != ''
        AND p.category_id IS NULL
    SQL

    counts = ActiveRecord::Base.connection.execute(
      "SELECT COUNT(*) FROM pricebooks WHERE category_id IS NOT NULL"
    ).first["count"]
    unmatched = ActiveRecord::Base.connection.execute(
      "SELECT COUNT(*) FROM pricebooks WHERE category IS NOT NULL AND category != '' AND category_id IS NULL AND is_active = true"
    ).first["count"]
    puts "  Populated category_id on #{counts} items"
    puts "  Active items with unmatched text category (no PricebookCategory): #{unmatched}"

    # Step 3: Update Foundation column - category_id becomes the lookup column,
    # category (text) is hidden but kept for legacy compatibility
    foundation = Foundation.find_by(slug: "pricebook_categories")
    pb_foundation = Foundation.find_by(slug: "pricebook-items")

    # Convert category_id column to a proper lookup
    cat_id_col = pb_foundation.columns.find_by(column_name: "category_id")
    cat_text_col = pb_foundation.columns.find_by(column_name: "category")

    if cat_id_col
      cat_id_col.update!(
        column_type: "lookup",
        name: "Category",
        lookup_foundation_id: foundation.id,
        lookup_foundation_slug: "pricebook_categories",
        lookup_display_column: "name",
        position: cat_text_col&.position || 5,
      )
      puts "  Updated category_id column to lookup type"
    end

    # Hide the legacy text category column (keep data, just don't show in UI)
    if cat_text_col
      cat_text_col.update!(has_ui: false)
      puts "  Hidden legacy text category column from UI"
    end
  end

  def down
    foundation = Foundation.find_by(slug: "pricebook_categories")
    pb_foundation = Foundation.find_by(slug: "pricebook-items")

    # Restore category_id column to plain whole_number
    cat_id_col = pb_foundation&.columns&.find_by(column_name: "category_id")
    cat_id_col&.update!(
      column_type: "whole_number",
      name: "Category ID",
      lookup_foundation_id: nil,
      lookup_foundation_slug: nil,
      lookup_display_column: nil,
    )

    # Re-show legacy text category column
    pb_foundation&.columns&.find_by(column_name: "category")&.update!(has_ui: true)

    # Clear category_id (don't touch text category)
    execute "UPDATE pricebooks SET category_id = NULL"

    # Restore Fire System casing
    execute "UPDATE pricebook_categories SET name = 'Fire System' WHERE name = 'FIRE SYSTEM'"
    execute "UPDATE pricebooks SET category = 'Fire System' WHERE category = 'FIRE SYSTEM'"
  end
end

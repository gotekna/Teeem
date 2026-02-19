class WirePricebookBrandAndRangeLookups < ActiveRecord::Migration[8.0]
  # Wire up pricebook_items.brand_id (FK to pricebook_brands) and range_id (FK to pricebook_ranges).
  #
  # Steps:
  #   1. Create Foundation records for pricebook_brands and pricebook_ranges
  #   2. Auto-create PricebookBrand records from existing `brand` text values (per tenant)
  #   3. Populate brand_id FK from text match (tenant-scoped SQL)
  #   4. Wire brand_id Foundation column as lookup → pricebook_brands
  #   5. Hide legacy `brand` text column (has_ui: false)
  #   6. Wire range_id Foundation column as lookup → pricebook_ranges

  def up
    pb_foundation = Foundation.find_by(slug: "pricebook-items")
    unless pb_foundation
      puts "  ⚠️  pricebook-items Foundation not found, skipping Foundation column wiring"
      populate_brand_records_and_ids
      return
    end

    # Step 1: Create Foundation for pricebook_brands (if not exists)
    brands_foundation = Foundation.find_or_create_by!(slug: "pricebook_brands") do |f|
      f.name = "Pricebook Brands"
      f.singular_name = "Pricebook Brand"
      f.plural_name = "Pricebook Brands"
      f.database_table_name = "pricebook_brands"
      f.table_type = "system"
      f.model_class = "PricebookBrand"
      f.is_live = true
    end
    puts "  Created/found pricebook_brands Foundation (id: #{brands_foundation.id})"

    # Create Foundation for pricebook_ranges (if not exists)
    ranges_foundation = Foundation.find_or_create_by!(slug: "pricebook_ranges") do |f|
      f.name = "Pricebook Ranges"
      f.singular_name = "Pricebook Range"
      f.plural_name = "Pricebook Ranges"
      f.database_table_name = "pricebook_ranges"
      f.table_type = "system"
      f.model_class = "PricebookRange"
      f.is_live = true
    end
    puts "  Created/found pricebook_ranges Foundation (id: #{ranges_foundation.id})"

    # Step 2: Auto-create PricebookBrand records from existing text brand values
    populate_brand_records_and_ids

    # Step 3: Wire brand_id column as lookup in Foundation
    brand_id_col = pb_foundation.columns.find_by(column_name: "brand_id")
    brand_text_col = pb_foundation.columns.find_by(column_name: "brand")

    if brand_id_col
      brand_id_col.update!(
        column_type: "lookup",
        name: "Brand",
        lookup_foundation_id: brands_foundation.id,
        lookup_foundation_slug: "pricebook_brands",
        lookup_display_column: "name",
        position: brand_text_col&.position || 6,
      )
      puts "  Updated brand_id column to lookup type"
    else
      puts "  ⚠️  brand_id column not found in Foundation columns (will be auto-discovered on next sync)"
    end

    # Step 4: Hide legacy brand text column
    if brand_text_col
      brand_text_col.update!(has_ui: false)
      puts "  Hidden legacy text brand column from UI"
    end

    # Step 5: Wire range_id column as lookup in Foundation
    range_id_col = pb_foundation.columns.find_by(column_name: "range_id")

    if range_id_col
      range_id_col.update!(
        column_type: "lookup",
        name: "Range",
        lookup_foundation_id: ranges_foundation.id,
        lookup_foundation_slug: "pricebook_ranges",
        lookup_display_column: "name",
        position: (brand_id_col&.position || 6) + 1,
      )
      puts "  Updated range_id column to lookup type"
    else
      puts "  ⚠️  range_id column not found in Foundation columns (will be auto-discovered on next sync)"
    end
  end

  def down
    pb_foundation = Foundation.find_by(slug: "pricebook-items")

    if pb_foundation
      # Restore brand_id to plain whole_number
      brand_id_col = pb_foundation.columns.find_by(column_name: "brand_id")
      brand_id_col&.update!(
        column_type: "whole_number",
        name: "Brand ID",
        lookup_foundation_id: nil,
        lookup_foundation_slug: nil,
        lookup_display_column: nil,
      )

      # Re-show legacy brand text column
      pb_foundation.columns.find_by(column_name: "brand")&.update!(has_ui: true)

      # Restore range_id to plain whole_number
      range_id_col = pb_foundation.columns.find_by(column_name: "range_id")
      range_id_col&.update!(
        column_type: "whole_number",
        name: "Range ID",
        lookup_foundation_id: nil,
        lookup_foundation_slug: nil,
        lookup_display_column: nil,
      )
    end

    # Clear FKs (don't delete brand records - they may have been edited)
    execute "UPDATE pricebooks SET brand_id = NULL"
    execute "UPDATE pricebooks SET range_id = NULL"

    # Remove Foundation records
    Foundation.find_by(slug: "pricebook_brands")&.destroy
    Foundation.find_by(slug: "pricebook_ranges")&.destroy
  end

  private

  def populate_brand_records_and_ids
    # Get distinct brand values per tenant
    brand_rows = execute(<<~SQL)
      SELECT DISTINCT tenant_id, brand
      FROM pricebooks
      WHERE brand IS NOT NULL AND brand != '' AND tenant_id IS NOT NULL
      ORDER BY tenant_id, brand
    SQL

    created_count = 0
    brand_rows.each do |row|
      tenant_id = row["tenant_id"]
      brand_name = row["brand"]

      # Create PricebookBrand if it doesn't exist (tenant-scoped)
      exists = execute(<<~SQL).first
        SELECT id FROM pricebook_brands
        WHERE tenant_id = #{tenant_id} AND name = #{ActiveRecord::Base.connection.quote(brand_name)}
      SQL

      unless exists
        execute(<<~SQL)
          INSERT INTO pricebook_brands (name, tenant_id, is_active, position, color, created_at, updated_at)
          VALUES (
            #{ActiveRecord::Base.connection.quote(brand_name)},
            #{tenant_id},
            true,
            (SELECT COALESCE(MAX(position), 0) + 1 FROM pricebook_brands WHERE tenant_id = #{tenant_id}),
            '#6B7280',
            NOW(),
            NOW()
          )
        SQL
        created_count += 1
      end
    end
    puts "  Created #{created_count} PricebookBrand records from existing text values"

    # Populate brand_id FK from text match
    execute <<~SQL
      UPDATE pricebooks p
      SET brand_id = pb.id
      FROM pricebook_brands pb
      WHERE pb.name = p.brand
        AND pb.tenant_id = p.tenant_id
        AND p.brand IS NOT NULL
        AND p.brand != ''
        AND p.brand_id IS NULL
    SQL

    counts = execute("SELECT COUNT(*) FROM pricebooks WHERE brand_id IS NOT NULL").first["count"]
    unmatched = execute(
      "SELECT COUNT(*) FROM pricebooks WHERE brand IS NOT NULL AND brand != '' AND brand_id IS NULL AND is_active = true"
    ).first["count"]
    puts "  Populated brand_id on #{counts} items"
    puts "  Active items with unmatched text brand: #{unmatched}"
  end
end

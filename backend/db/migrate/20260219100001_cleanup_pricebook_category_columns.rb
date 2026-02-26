class CleanupPricebookCategoryColumns < ActiveRecord::Migration[8.0]
  # Fix: Pricebook has TWO "Category" columns visible - the legacy text field
  # and the new lookup (category_id). This migration:
  #   1. Makes category_id (lookup) visible in Foundation (has_ui: true)
  #   2. Removes the legacy text "category" from all view column configs
  #   3. Ensures category_id is in all views where category was
  #   4. Creates missing PricebookCategory records for unmatched text categories
  #   5. Populates category_id for any remaining unmatched items

  def up
    pb_foundation = Foundation.find_by(slug: "pricebook-items")
    return unless pb_foundation

    # Step 1: Make category_id visible, keep category hidden
    cat_id_col = pb_foundation.columns.find_by(column_name: "category_id")
    cat_text_col = pb_foundation.columns.find_by(column_name: "category")

    if cat_id_col
      cat_id_col.update!(has_ui: true)
      puts "  Set category_id has_ui=true"
    end

    if cat_text_col
      cat_text_col.update!(has_ui: false)
      puts "  Confirmed category has_ui=false"
    end

    # Step 2: Update all views to remove text "category" and keep "category_id"
    views = FoundationView.unscoped.where(foundation_id: pb_foundation.id)
    updated = 0

    views.find_each do |view|
      cols = view.columns
      next unless cols.is_a?(Hash)

      changed = false
      order = cols["order"] || []
      visible = cols["visible"] || {}

      # Remove "category" from order, ensure "category_id" is there
      if order.include?("category")
        cat_position = order.index("category")
        order.delete("category")

        # Insert category_id at the same position if not already present
        unless order.include?("category_id")
          order.insert([cat_position, order.length].min, "category_id")
        end
        changed = true
      end

      # Remove "category" from visible, ensure "category_id" is visible
      if visible.key?("category")
        was_visible = visible.delete("category")
        # If category was visible, make category_id visible too
        visible["category_id"] = true if was_visible
        changed = true
      end

      if changed
        view.update_columns(columns: cols)
        updated += 1
      end
    end

    puts "  Updated #{updated} views to use category_id instead of category"

    # Step 3: Create missing PricebookCategory records for unmatched text categories
    # and populate category_id
    unmatched = execute(<<~SQL).to_a
      SELECT DISTINCT p.category, p.tenant_id
      FROM pricebooks p
      WHERE p.category IS NOT NULL
        AND p.category != ''
        AND p.category_id IS NULL
        AND p.is_active = true
    SQL

    created = 0
    unmatched.each do |row|
      cat_name = row["category"]
      tenant_id = row["tenant_id"]

      # Create category if it doesn't exist for this tenant
      existing = execute("SELECT id FROM pricebook_categories WHERE name = #{quote(cat_name)} AND tenant_id = #{tenant_id.to_i} LIMIT 1").to_a
      if existing.empty?
        max_pos = execute("SELECT COALESCE(MAX(position), 0) FROM pricebook_categories WHERE tenant_id = #{tenant_id.to_i}").first["coalesce"]
        execute(<<~SQL)
          INSERT INTO pricebook_categories (name, tenant_id, is_active, position, created_at, updated_at)
          VALUES (#{quote(cat_name)}, #{tenant_id.to_i}, true, #{max_pos.to_i + 1}, NOW(), NOW())
        SQL
        created += 1
      end
    end

    puts "  Created #{created} missing PricebookCategory records"

    # Now populate category_id for any remaining unmatched items
    populated = execute(<<~SQL).cmd_tuples
      UPDATE pricebooks p
      SET category_id = pc.id
      FROM pricebook_categories pc
      WHERE pc.name = p.category
        AND pc.tenant_id = p.tenant_id
        AND p.category IS NOT NULL
        AND p.category != ''
        AND p.category_id IS NULL
    SQL

    puts "  Populated category_id on #{populated} remaining items"
  end

  def down
    pb_foundation = Foundation.find_by(slug: "pricebook-items")
    return unless pb_foundation

    # Restore category_id to hidden, category to visible
    cat_id_col = pb_foundation.columns.find_by(column_name: "category_id")
    cat_text_col = pb_foundation.columns.find_by(column_name: "category")

    cat_id_col&.update!(has_ui: false)
    cat_text_col&.update!(has_ui: true)
  end
end

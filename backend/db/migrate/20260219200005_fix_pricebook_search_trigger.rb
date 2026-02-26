# frozen_string_literal: true

# Fix: pricebook_items_search_trigger() uses stale PL/pgSQL plan cache.
#
# Root cause: The trigger was created in 20251103074835_create_price_book_system.rb
# referencing `new.category` (text column). Since then:
#   - `category` text → `category_id` FK (lookup to pricebook_categories)
#   - `brand_id`, `range_id`, storage blob IDs, and other columns were added
#   - PL/pgSQL cached plan became stale → PG::DatatypeMismatch on any UPDATE
#
# Fix: Recreate the function to:
#   1. Look up category name via `category_id` FK (instead of text column)
#   2. Force PostgreSQL to invalidate the stale cached plan
#   3. Keep `brand` text column reference (still exists) with `brand_id` fallback
class FixPricebookSearchTrigger < ActiveRecord::Migration[8.0]
  def up
    execute <<~SQL
      CREATE OR REPLACE FUNCTION pricebook_items_search_trigger() RETURNS trigger AS $$
      DECLARE
        cat_name text;
        brand_name text;
      begin
        -- category was converted from text to category_id FK (pricebook_categories)
        IF new.category_id IS NOT NULL THEN
          SELECT name INTO cat_name FROM pricebook_categories WHERE id = new.category_id;
        END IF;

        -- brand: prefer brand_id lookup, fall back to text column
        IF new.brand_id IS NOT NULL THEN
          SELECT name INTO brand_name FROM pricebook_brands WHERE id = new.brand_id;
        ELSE
          brand_name := new.brand;
        END IF;

        new.searchable_text :=
          setweight(to_tsvector('english', coalesce(new.item_code,'')), 'A') ||
          setweight(to_tsvector('english', coalesce(new.item_name,'')), 'A') ||
          setweight(to_tsvector('english', coalesce(cat_name,'')), 'B') ||
          setweight(to_tsvector('english', coalesce(brand_name,'')), 'C') ||
          setweight(to_tsvector('english', coalesce(new.notes,'')), 'D');
        return new;
      end
      $$ LANGUAGE plpgsql;
    SQL
  end

  def down
    # Restore original trigger function (references text columns directly)
    execute <<~SQL
      CREATE OR REPLACE FUNCTION pricebook_items_search_trigger() RETURNS trigger AS $$
      begin
        new.searchable_text :=
          setweight(to_tsvector('english', coalesce(new.item_code,'')), 'A') ||
          setweight(to_tsvector('english', coalesce(new.item_name,'')), 'A') ||
          setweight(to_tsvector('english', coalesce(new.category,'')), 'B') ||
          setweight(to_tsvector('english', coalesce(new.brand,'')), 'C') ||
          setweight(to_tsvector('english', coalesce(new.notes,'')), 'D');
        return new;
      end
      $$ LANGUAGE plpgsql;
    SQL
  end
end

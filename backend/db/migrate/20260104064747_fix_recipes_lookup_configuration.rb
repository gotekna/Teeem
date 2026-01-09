# frozen_string_literal: true

# Fix missing lookup configuration for Recipes foundation columns
#
# Affected columns:
# - recipes.recipe_category_id → should point to recipe_categories foundation
# - recipes.default_supplier_id → should point to contacts foundation
#
# This updates Column metadata records, not the database schema
class FixRecipesLookupConfiguration < ActiveRecord::Migration[8.0]
  def up
    recipes_foundation = Foundation.find_by(slug: 'recipes')
    return unless recipes_foundation

    # Fix recipe_category_id → recipe_categories
    recipe_cat_col = recipes_foundation.columns.find_by(column_name: 'recipe_category_id')
    if recipe_cat_col
      recipe_categories = Foundation.find_by(slug: 'recipe_categories')
      if recipe_categories
        recipe_cat_col.update!(
          lookup_foundation_id: recipe_categories.id,
          lookup_foundation_slug: 'recipe_categories',
          lookup_display_column: 'name'
        )
        puts "  ✅ Fixed recipe_category_id → recipe_categories (display: name)"
      else
        puts "  ⚠️  recipe_categories foundation not found"
      end
    end

    # Fix default_supplier_id → contacts
    supplier_col = recipes_foundation.columns.find_by(column_name: 'default_supplier_id')
    if supplier_col
      contacts = Foundation.find_by(slug: 'contacts')
      if contacts
        supplier_col.update!(
          lookup_foundation_id: contacts.id,
          lookup_foundation_slug: 'contacts',
          lookup_display_column: 'display_name'
        )
        puts "  ✅ Fixed default_supplier_id → contacts (display: display_name)"
      else
        puts "  ⚠️  contacts foundation not found"
      end
    end
  end

  def down
    recipes_foundation = Foundation.find_by(slug: 'recipes')
    return unless recipes_foundation

    # Clear the lookup configuration
    recipes_foundation.columns.where(column_name: %w[recipe_category_id default_supplier_id]).update_all(
      lookup_foundation_id: nil,
      lookup_foundation_slug: nil,
      lookup_display_column: nil
    )
  end
end

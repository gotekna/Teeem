# frozen_string_literal: true

# Fix invalid lookup_display_column for Gold Standard foundation
# 'full_name' doesn't exist in Contacts - should be 'display_name'
#
# Affected columns:
# - gold_standard_table.lookup (lookup → contacts)
# - gold_standard_table.multiple_lookups (multiple_lookups → contacts)
class FixGoldStandardLookupDisplayColumns < ActiveRecord::Migration[8.0]
  def up
    gs_foundation = Foundation.find_by(slug: 'gold_standard_table')
    return unless gs_foundation

    # Fix lookup column
    lookup_col = gs_foundation.columns.find_by(column_name: 'lookup')
    if lookup_col && lookup_col.lookup_display_column == 'full_name'
      lookup_col.update!(lookup_display_column: 'display_name')
      puts "  ✅ Fixed lookup display column: full_name → display_name"
    end

    # Fix multiple_lookups column
    multi_col = gs_foundation.columns.find_by(column_name: 'multiple_lookups')
    if multi_col && multi_col.lookup_display_column == 'full_name'
      multi_col.update!(lookup_display_column: 'display_name')
      puts "  ✅ Fixed multiple_lookups display column: full_name → display_name"
    end
  end

  def down
    gs_foundation = Foundation.find_by(slug: 'gold_standard_table')
    return unless gs_foundation

    gs_foundation.columns.where(column_name: %w[lookup multiple_lookups]).update_all(
      lookup_display_column: 'full_name'
    )
  end
end

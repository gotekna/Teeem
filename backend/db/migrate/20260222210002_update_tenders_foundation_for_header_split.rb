# frozen_string_literal: true

# Update existing tenders Foundation after header split:
# - Remove parent_id column registration (column no longer exists)
# - Add tender_header_id lookup column → tender-headers foundation
# - Update SM Schedule Master's tender_id lookup to still point to tenders foundation
#
class UpdateTendersFoundationForHeaderSplit < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_by(slug: "tenders")
    return unless foundation

    # Remove parent_id column (no longer exists on tenders table)
    foundation.columns.find_by(column_name: "parent_id")&.destroy

    puts "  Removed parent_id column from tenders foundation"

    # Add tender_header_id as lookup to tender-headers foundation
    headers_foundation = Foundation.find_by(slug: "tender_headers")
    if headers_foundation
      last_position = foundation.columns.maximum(:position) || 0

      Column.find_or_create_by!(foundation_id: foundation.id, column_name: "tender_header_id") do |col|
        col.name = "Header"
        col.column_type = "lookup"
        col.lookup_foundation_id = headers_foundation.id
        col.lookup_display_column = "name"
        col.position = last_position + 1
        col.has_ui = true
        col.searchable = false
        col.required = true
      end

      puts "  Added tender_header_id lookup column → tender-headers foundation"
    end
  end

  def down
    foundation = Foundation.find_by(slug: "tenders")
    return unless foundation

    # Remove tender_header_id column
    foundation.columns.find_by(column_name: "tender_header_id")&.destroy

    # Re-add parent_id as self-referential lookup
    Column.find_or_create_by!(foundation_id: foundation.id, column_name: "parent_id") do |col|
      col.name = "Header"
      col.column_type = "lookup"
      col.lookup_foundation_id = foundation.id
      col.lookup_display_column = "name"
      col.position = (foundation.columns.maximum(:position) || 0) + 1
      col.has_ui = true
      col.searchable = false
      col.required = false
    end
  end
end

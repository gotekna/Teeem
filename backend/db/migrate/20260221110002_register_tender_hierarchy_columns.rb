# frozen_string_literal: true

# Register parent_id (lookup to self) and default_note (text) in the Foundation columns
# for the tenders foundation. This lets TeeemTableView display them.
#
class RegisterTenderHierarchyColumns < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_by(slug: "tenders")
    return unless foundation

    last_position = foundation.columns.maximum(:position) || 0

    # parent_id as self-referential lookup (Header column)
    Column.find_or_create_by!(foundation_id: foundation.id, column_name: "parent_id") do |col|
      col.name = "Header"
      col.column_type = "lookup"
      col.lookup_foundation_id = foundation.id
      col.lookup_display_column = "name"
      col.position = last_position + 1
      col.has_ui = true
      col.searchable = false
      col.required = false
    end

    # default_note as text
    Column.find_or_create_by!(foundation_id: foundation.id, column_name: "default_note") do |col|
      col.name = "Default Note"
      col.column_type = "multiple_lines_text"
      col.position = last_position + 2
      col.has_ui = true
      col.searchable = false
      col.required = false
    end

    puts "  Registered parent_id and default_note columns for tenders foundation"
  end

  def down
    foundation = Foundation.find_by(slug: "tenders")
    return unless foundation

    foundation.columns.where(column_name: %w[parent_id default_note]).destroy_all
  end
end

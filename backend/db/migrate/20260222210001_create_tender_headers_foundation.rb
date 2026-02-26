# frozen_string_literal: true

# Create Foundation for TenderHeader model (split from tenders).
#
# This enables TeeemTableView for managing tender headers in Settings > Operations.
#
class CreateTenderHeadersFoundation < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_or_create_by!(slug: "tender_headers") do |f|
      f.name = "Tender Headers"
      f.singular_name = "Tender Header"
      f.plural_name = "Tender Headers"
      f.database_table_name = "tender_headers"
      f.table_type = "system"
      f.model_class = "TenderHeader"
      f.icon = "FolderOpen"
      f.feature = "Jobs"
      f.searchable = true
      f.is_live = true
      f.has_ui = true
      f.has_saved_views = true
      f.allow_reserved_name = true
    end

    foundation.update!(model_class: "TenderHeader") if foundation.model_class.blank?

    puts "  Created Foundation: #{foundation.name} (ID: #{foundation.id})"

    columns_config = [
      { column_name: "id",          position: 1, column_type: "whole_number",        has_ui: false, searchable: false },
      { column_name: "tenant_id",   position: 2, column_type: "whole_number",        has_ui: false, searchable: false },
      { column_name: "code",        position: 3, column_type: "single_line_text",    has_ui: true,  searchable: true,  name: "Code", is_title: true },
      { column_name: "name",        position: 4, column_type: "single_line_text",    has_ui: true,  searchable: true,  name: "Name" },
      { column_name: "description", position: 5, column_type: "multiple_lines_text", has_ui: true,  searchable: true,  name: "Description" },
      { column_name: "sort_order",  position: 6, column_type: "whole_number",        has_ui: true,  searchable: false, name: "Sort Order" },
      { column_name: "active",      position: 7, column_type: "boolean",             has_ui: true,  searchable: false, name: "Active" },
      { column_name: "created_at",  position: 8, column_type: "date_and_time",       has_ui: false, searchable: false, name: "Created At" },
      { column_name: "updated_at",  position: 9, column_type: "date_and_time",       has_ui: false, searchable: false, name: "Updated At" },
    ]

    columns_config.each do |config|
      Column.find_or_create_by!(foundation_id: foundation.id, column_name: config[:column_name]) do |col|
        col.name = config[:name] || config[:column_name].titleize
        col.column_type = config[:column_type]
        col.position = config[:position]
        col.searchable = config[:searchable]
        col.has_ui = config[:has_ui]
        col.is_title = config[:is_title] || false
        col.required = false
      end
    end

    puts "  Synced #{columns_config.size} columns"
  end

  def down
    foundation = Foundation.find_by(slug: "tender_headers")
    if foundation
      foundation.columns.destroy_all
      foundation.destroy
    end
  end
end

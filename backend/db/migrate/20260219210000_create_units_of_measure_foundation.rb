# frozen_string_literal: true

# Create Foundation record for units_of_measure table.
# This converts the UOM settings tab from a custom HTML table to TeeemTableView.
# UOM is a global lookup table (no tenant_id), same as inspiring-quotes.
class CreateUnitsOfMeasureFoundation < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_by(slug: "units_of_measure") ||
                 Foundation.find_by(database_table_name: "units_of_measure")

    if foundation
      foundation.update!(
        slug: "units_of_measure",
        name: "Units of Measure",
        singular_name: "Unit of Measure",
        plural_name: "Units of Measure",
        database_table_name: "units_of_measure",
        table_type: "system",
        model_class: "UnitOfMeasure",
        is_live: true,
        has_ui: true,
        feature: "pricebook"
      )
    else
      foundation = Foundation.create!(
        slug: "units_of_measure",
        name: "Units of Measure",
        singular_name: "Unit of Measure",
        plural_name: "Units of Measure",
        database_table_name: "units_of_measure",
        table_type: "system",
        model_class: "UnitOfMeasure",
        is_live: true,
        has_ui: true,
        feature: "pricebook"
      )
    end

    puts "  Created/found units_of_measure Foundation (id: #{foundation.id})"

    # Define columns with explicit config for UI display
    columns_config = [
      { column_name: "id",          position: 0, column_type: "whole_number",      name: "ID",          searchable: false, has_ui: false },
      { column_name: "code",        position: 1, column_type: "single_line_text",  name: "Code",        searchable: true,  has_ui: true, is_title: true },
      { column_name: "name",        position: 2, column_type: "single_line_text",  name: "Name",        searchable: true,  has_ui: true },
      { column_name: "description", position: 3, column_type: "single_line_text",  name: "Description", searchable: true,  has_ui: true },
      { column_name: "sort_order",  position: 4, column_type: "whole_number",      name: "Sort Order",  searchable: false, has_ui: true },
      { column_name: "is_active",   position: 5, column_type: "boolean",           name: "Active",      searchable: false, has_ui: true },
      { column_name: "created_at",  position: 6, column_type: "date_and_time",     name: "Created At",  searchable: false, has_ui: false },
      { column_name: "updated_at",  position: 7, column_type: "date_and_time",     name: "Updated At",  searchable: false, has_ui: false },
    ]

    columns_config.each do |config|
      Column.find_or_create_by!(foundation_id: foundation.id, column_name: config[:column_name]) do |col|
        col.name = config[:name]
        col.column_type = config[:column_type]
        col.position = config[:position]
        col.searchable = config[:searchable]
        col.is_title = config[:is_title] || false
        col.has_ui = config.fetch(:has_ui, false)
        col.required = false
      end
    end

    puts "  Synced #{columns_config.size} columns for Units of Measure foundation"
  end

  def down
    foundation = Foundation.find_by(slug: "units_of_measure")
    if foundation
      foundation.columns.destroy_all
      foundation.destroy
      puts "  Removed units_of_measure Foundation and columns"
    end
  end
end

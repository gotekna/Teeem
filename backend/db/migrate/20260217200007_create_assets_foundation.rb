# frozen_string_literal: true

# Migration: Create Foundation for Asset Register
#
# The assets table exists but no Foundation record was created,
# causing 404 when frontend tries to load /corporate/assets via TeeemTableView.
#
class CreateAssetsFoundation < ActiveRecord::Migration[7.2]
  def up
    # Check both slug and database_table_name to avoid unique constraint violations
    foundation = Foundation.find_by(slug: "assets") || Foundation.find_by(database_table_name: "assets")

    if foundation
      # Update existing foundation to ensure correct slug and settings
      foundation.update!(
        slug: "assets",
        name: "Assets",
        singular_name: "Asset",
        plural_name: "Assets",
        database_table_name: "assets",
        table_type: "system",
        model_class: "Asset",
        icon: "Package",
        feature: "Corporate",
        searchable: true,
        is_live: true,
        has_ui: true,
        has_saved_views: true
      )
    else
      foundation = Foundation.create!(
        slug: "assets",
        name: "Assets",
        singular_name: "Asset",
        plural_name: "Assets",
        database_table_name: "assets",
        table_type: "system",
        model_class: "Asset",
        icon: "Package",
        feature: "Corporate",
        searchable: true,
        is_live: true,
        has_ui: true,
        has_saved_views: true,
        allow_reserved_name: false
      )
    end

    puts "  Created Foundation: #{foundation.name} (ID: #{foundation.id})"

    columns_config = [
      { column_name: "id",                  position: 1,  column_type: "whole_number",       visible: false, searchable: false },
      { column_name: "tenant_id",           position: 2,  column_type: "whole_number",       visible: false, searchable: false },
      { column_name: "company_id",          position: 3,  column_type: "lookup",             visible: true,  searchable: false, name: "Company" },
      { column_name: "name",               position: 4,  column_type: "single_line_text",   visible: true,  searchable: true,  name: "Name", is_title: true },
      { column_name: "asset_number",        position: 5,  column_type: "single_line_text",   visible: true,  searchable: true,  name: "Asset Number" },
      { column_name: "asset_type",          position: 6,  column_type: "single_line_text",   visible: true,  searchable: true,  name: "Type" },
      { column_name: "status",             position: 7,  column_type: "single_line_text",   visible: true,  searchable: false, name: "Status" },
      { column_name: "purchase_price",      position: 8,  column_type: "currency",           visible: true,  searchable: false, name: "Purchase Price" },
      { column_name: "purchase_date",       position: 9,  column_type: "date",               visible: true,  searchable: false, name: "Purchase Date" },
      { column_name: "current_book_value",  position: 10, column_type: "currency",           visible: true,  searchable: false, name: "Book Value" },
      { column_name: "make",               position: 11, column_type: "single_line_text",   visible: true,  searchable: true,  name: "Make" },
      { column_name: "model",              position: 12, column_type: "single_line_text",   visible: true,  searchable: true,  name: "Model" },
      { column_name: "serial_number",       position: 13, column_type: "single_line_text",   visible: true,  searchable: true,  name: "Serial Number" },
      { column_name: "registration_number", position: 14, column_type: "single_line_text",   visible: true,  searchable: true,  name: "Registration" },
      { column_name: "location",           position: 15, column_type: "single_line_text",   visible: true,  searchable: true,  name: "Location" },
      { column_name: "assigned_user_id",    position: 16, column_type: "lookup",             visible: true,  searchable: false, name: "Assigned To" },
      { column_name: "abbreviation",        position: 17, column_type: "single_line_text",   visible: false, searchable: true,  name: "Abbreviation" },
      { column_name: "description",        position: 18, column_type: "multiple_lines_text", visible: false, searchable: true,  name: "Description" },
      { column_name: "notes",              position: 19, column_type: "multiple_lines_text", visible: false, searchable: false, name: "Notes" },
      { column_name: "sale_date",           position: 20, column_type: "date",               visible: false, searchable: false, name: "Sale Date" },
      { column_name: "odometer_reading",    position: 21, column_type: "whole_number",       visible: false, searchable: false, name: "Odometer" },
      { column_name: "hours_reading",       position: 22, column_type: "whole_number",       visible: false, searchable: false, name: "Hours" },
      { column_name: "last_reading_date",   position: 23, column_type: "date",               visible: false, searchable: false, name: "Last Reading" },
      { column_name: "address",            position: 24, column_type: "single_line_text",   visible: false, searchable: true,  name: "Address" },
      { column_name: "land_area_sqm",      position: 25, column_type: "decimal_number",     visible: false, searchable: false, name: "Land Area (sqm)" },
      { column_name: "building_area_sqm",  position: 26, column_type: "decimal_number",     visible: false, searchable: false, name: "Building Area (sqm)" },
      { column_name: "construction_date",   position: 27, column_type: "date",               visible: false, searchable: false, name: "Construction Date" },
      { column_name: "created_at",          position: 28, column_type: "date_and_time",      visible: false, searchable: false, name: "Created At" },
      { column_name: "updated_at",          position: 29, column_type: "date_and_time",      visible: false, searchable: false, name: "Updated At" },
    ]

    columns_config.each do |config|
      Column.find_or_create_by!(foundation_id: foundation.id, column_name: config[:column_name]) do |col|
        col.name = config[:name] || config[:column_name].titleize
        col.column_type = config[:column_type]
        col.position = config[:position]
        col.searchable = config[:searchable]
        col.is_title = config[:is_title] || false
        col.required = false
      end
    end

    puts "  Synced #{columns_config.size} columns for Assets foundation"
  end

  def down
    foundation = Foundation.find_by(slug: "assets")
    if foundation
      foundation.columns.destroy_all
      foundation.destroy
    end
  end
end

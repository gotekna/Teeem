class Api::V1::ColumnTypesController < ApplicationController
  skip_before_action :authorize_request  # Public endpoint - column types are reference data

  # GET /api/v1/column_types
  # Returns all column type definitions from the Gold Standard Reference table
  def index
    # SSoT: Use slug, not hardcoded ID (IDs differ between environments)
    gold_standard_foundation = Foundation.find_by(slug: "gold_standard_table")

    unless gold_standard_foundation
      render json: {
        success: false,
        error: "Gold Standard Reference table not found",
        data: []
      }, status: :not_found
      return
    end

    # Get sample data from gold_standard_items table (first row)
    sample_data = get_sample_data

    # Get all columns from Gold Standard table and convert to type definitions
    column_types = gold_standard_foundation.columns.map do |column|
      format_column_type(column, sample_data)
    end

    # Sort by category and label
    sorted_types = column_types.sort_by { |t| [ category_order(t[:category]), t[:label] ] }

    render json: {
      success: true,
      data: sorted_types,
      total: sorted_types.count,
      source: "Gold Standard Reference Table",
      table_id: gold_standard_foundation.id,
      has_sample_data: sample_data.present?
    }
  end

  # GET /api/v1/column_types/:column_type
  # Returns specific column type definition
  def show
    # SSoT: Use slug, not hardcoded ID (IDs differ between environments)
    gold_standard_foundation = Foundation.find_by(slug: "gold_standard_table")

    unless gold_standard_foundation
      render json: {
        success: false,
        error: "Gold Standard Reference table not found"
      }, status: :not_found
      return
    end

    # Find column by column_type value
    column = gold_standard_foundation.columns.find_by(column_type: params[:id])

    if column
      render json: {
        success: true,
        data: format_column_type(column)
      }
    else
      render json: {
        success: false,
        error: "Column type '#{params[:id]}' not found in Gold Standard table"
      }, status: :not_found
    end
  end

  # PATCH /api/v1/column_types/:column_type
  # Updates metadata for a specific column type in the Gold Standard table
  def update
    # SSoT: Use slug, not hardcoded ID (IDs differ between environments)
    gold_standard_foundation = Foundation.find_by(slug: "gold_standard_table")

    unless gold_standard_foundation
      render json: {
        success: false,
        error: "Gold Standard Reference table not found"
      }, status: :not_found
      return
    end

    # Find column by column_type value
    column = gold_standard_foundation.columns.find_by(column_type: params[:id])

    unless column
      render json: {
        success: false,
        error: "Column type '#{params[:id]}' not found in Gold Standard table"
      }, status: :not_found
      return
    end

    # Only allow updating the display name
    # All other metadata (validation rules, examples, usage) is auto-generated from column_type
    update_params = {}

    if params[:displayName].present?
      update_params[:name] = params[:displayName]
    end

    # Update the column
    if column.update(update_params)
      render json: {
        success: true,
        message: "Column type updated successfully",
        data: format_column_type(column.reload)
      }
    else
      render json: {
        success: false,
        error: "Failed to update column type",
        errors: column.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  private

  # Get sample data from gold_standard_items table
  def get_sample_data
    # Query the gold_standard_items table directly
    result = ActiveRecord::Base.connection.exec_query("SELECT * FROM gold_standard_items LIMIT 1")
    result.first if result.any?
  rescue StandardError => e
    Rails.logger.error "Failed to fetch sample data: #{e.message}"
    nil
  end

  # Format a Gold Standard column into column type metadata
  def format_column_type(column, sample_data = nil)
    # Map column_type to category
    category = categorize_column_type(column.column_type)

    # Get SQL type from Column model mapping
    sql_type = get_sql_type(column.column_type)

    # Get metadata from column settings or generate defaults
    validation_rules = get_validation_rules(column)
    example = get_example(column)
    used_for = get_used_for(column)

    # Get actual sample value from the table if available
    sample_value = nil
    if sample_data && column.column_type.present?
      sample_value = sample_data[column.column_type]
    end

    {
      value: column.column_type,
      label: format_label(column.name),
      category: category,
      sqlType: sql_type,
      validationRules: validation_rules,
      example: example,
      usedFor: used_for,
      columnName: column.column_name,
      displayName: column.name,
      required: column.required || false,
      columnId: column.id,
      sampleValue: sample_value
    }
  end

  # Categorize column types
  # MUST MATCH: TEEEM_DOCS/GOLD_STANDARD_TABLE.md
  def categorize_column_type(type)
    categories = {
      # Text (6)
      "single_line_text" => "Text",
      "multiple_lines_text" => "Text",
      "email" => "Text",
      "phone" => "Text",
      "mobile" => "Text",
      "url" => "Text",
      # Numbers (4)
      "number" => "Numbers",
      "whole_number" => "Numbers",
      "currency" => "Numbers",
      "percentage" => "Numbers",
      # Date & Time (2)
      "date" => "Date & Time",
      "date_and_time" => "Date & Time",
      # Special (4)
      "gps_coordinates" => "Special",
      "color_picker" => "Special",
      "file_upload" => "Special",
      "action_buttons" => "Special",
      # Selection (2)
      "boolean" => "Selection",
      "choice" => "Selection",
      # Relationships (3)
      "lookup" => "Relationships",
      "multiple_lookups" => "Relationships",
      "user" => "Relationships",
      # Computed (1)
      "computed" => "Computed",
      # Advanced (3)
      "structured_data" => "Advanced",
      "array_of_items" => "Advanced",
      "searchable_text" => "Advanced",
      # Australian (6)
      "abn" => "Australian",
      "acn" => "Australian",
      "bsb" => "Australian",
      "bank_account" => "Australian",
      "postcode" => "Australian",
      "tfn" => "Australian"
    }
    categories[type] || "Other"
  end

  # Get SQL type from Column model mapping
  # Uses Column::COLUMN_SQL_TYPE_MAP which is the single source of truth
  def get_sql_type(column_type)
    Column::COLUMN_SQL_TYPE_MAP[column_type] || "UNKNOWN"
  end

  # Get validation rules for a column type
  # First tries to get from database column.description field
  # Falls back to hardcoded rules if not set
  # MUST MATCH: TEEEM_DOCS/GOLD_STANDARD_TABLE.md
  def get_validation_rules(column)
    # Use database description if available (updated by teeem:update_validation_rules rake task)
    return column.description if column.description.present?

    # Fallback to hardcoded defaults - ALL 31 TYPES
    # Source: TEEEM_DOCS/GOLD_STANDARD_TABLE.md
    fallback_rules = {
      # Text (6)
      "single_line_text" => "Optional, max 255 characters",
      "multiple_lines_text" => "Supports line breaks, unlimited length",
      "email" => "Must contain @, valid email format",
      "phone" => "Format: (03) 9123 4567 or 1300 numbers",
      "mobile" => "Format: 04XX XXX XXX, starts with 04",
      "url" => "Valid URL, starts with http:// or https://",
      # Numbers (4)
      "number" => "Decimal numbers, up to 2 decimal places",
      "whole_number" => "Integers only, no decimals",
      "currency" => "Positive, 2 decimals, displays with $",
      "percentage" => "0-100, displays with % symbol",
      # Date & Time (2)
      "date" => "Stored: YYYY-MM-DD, Display: DD/MM/YYYY",
      "date_and_time" => "Full timestamp with time",
      # Special (4)
      "gps_coordinates" => "Latitude, Longitude format",
      "color_picker" => "Hex color format #RRGGBB",
      "file_upload" => "File path or URL to uploaded file",
      "action_buttons" => "JSON config for row actions",
      # Selection (2)
      "boolean" => "True or False only",
      "choice" => "Must be one of predefined options",
      # Relationships (3)
      "lookup" => "Must reference valid value from linked table",
      "multiple_lookups" => "Array of IDs stored as JSON",
      "user" => "Must reference valid user ID",
      # Computed (1)
      "computed" => "Read-only, calculated from formula",
      # Advanced (3)
      "structured_data" => "Valid JSON object, supports nesting",
      "array_of_items" => "Array of text values",
      "searchable_text" => "Read-only, auto-generated for search",
      # Australian (6)
      "abn" => "11 digits, format: XX XXX XXX XXX",
      "acn" => "9 digits, format: XXX XXX XXX",
      "bsb" => "6 digits, format: XXX-XXX",
      "bank_account" => "Up to 9 digits",
      "postcode" => "Exactly 4 digits",
      "tfn" => "9 digits, format: XXX XXX XXX"
    }

    fallback_rules[column.column_type] || "No validation rules defined"
  end

  # Get example value for a column type
  def get_example(column)
    examples = {
      "single_line_text" => "CONC-001, STL-042A",
      "multiple_lines_text" => 'This is a longer description\nwith multiple lines',
      "email" => "john.doe@example.com",
      "phone" => "(02) 1234 5678",
      "mobile" => "0412 345 678",
      "url" => "https://example.com/document",
      "number" => "123.45",
      "whole_number" => "42",
      "currency" => "$1,234.56",
      "percentage" => "15.5%",
      "date" => "19/11/2024",
      "date_and_time" => "19/11/2024 16:45",
      "gps_coordinates" => "-33.8688, 151.2093",
      "color_picker" => "#3498DB",
      "file_upload" => "/uploads/document.pdf",
      "action_buttons" => '{"buttons": [{"label": "View", "action": "view"}, {"label": "Edit", "action": "edit"}]}',
      "boolean" => "true, false",
      "choice" => "Active, Pending, Complete",
      "lookup" => "Customer: ABC Corp",
      "multiple_lookups" => "Tag1, Tag2, Tag3",
      "user" => "John Doe",
      "computed" => "={price} * {quantity}"
    }

    examples[column.column_type] || "No example available"
  end

  # Get usage description for a column type
  def get_used_for(column)
    descriptions = {
      "single_line_text" => "Unique identifier code for inventory",
      "multiple_lines_text" => "Detailed notes, descriptions, comments",
      "email" => "Contact email addresses",
      "phone" => "Landline phone numbers",
      "mobile" => "Mobile phone numbers",
      "url" => "Links to documents, websites, resources",
      "number" => "Quantities, measurements, decimal values",
      "whole_number" => "Counts, IDs, whole number quantities",
      "currency" => "Prices, costs, monetary amounts",
      "percentage" => "Discounts, completion rates, percentages",
      "date" => "Start dates, due dates, milestones",
      "date_and_time" => "Timestamps, created/updated times",
      "gps_coordinates" => "Location data, addresses with coordinates",
      "color_picker" => "Status colors, category colors",
      "file_upload" => "Attachments, documents, images",
      "action_buttons" => "Row-level actions like View, Edit, Download, Approve, Process",
      "boolean" => "Yes/No flags, active/inactive status",
      "choice" => "Status, priority, category selection",
      "lookup" => "Link to related record in another table",
      "multiple_lookups" => "Tags, categories, multiple selections",
      "user" => "Assigned user, created by, owner",
      "computed" => "Calculated totals, formulas, derived values"
    }

    descriptions[column.column_type] || "No usage description available"
  end

  # Format column name to display label
  def format_label(name)
    # Convert "Mobile" to "Mobile", "Email Address" to "Email address", etc.
    name.to_s
  end

  # Category ordering for sorting
  def category_order(category)
    order = {
      "Text" => 1,
      "Numbers" => 2,
      "Date & Time" => 3,
      "Special" => 4,
      "Selection" => 5,
      "Relationships" => 6,
      "Computed" => 7,
      "Other" => 8
    }
    order[category] || 99
  end
end

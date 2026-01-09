class Api::V1::ColumnTypesController < ApplicationController
  skip_before_action :authorize_request  # Public endpoint - column types are reference data

  # SSoT: All column type metadata in one place
  # MUST MATCH: TEEEM_DOCS/GOLD_STANDARD_TABLE.md
  COLUMN_TYPE_METADATA = {
    # Text (6)
    "single_line_text" => {
      category: "Text",
      validation: "Optional, max 255 characters",
      example: "CONC-001, STL-042A",
      usage: "Unique identifier code for inventory"
    },
    "multiple_lines_text" => {
      category: "Text",
      validation: "Supports line breaks, unlimited length",
      example: 'This is a longer description\nwith multiple lines',
      usage: "Detailed notes, descriptions, comments"
    },
    "email" => {
      category: "Text",
      validation: "Must contain @, valid email format",
      example: "john.doe@example.com",
      usage: "Contact email addresses"
    },
    "phone" => {
      category: "Text",
      validation: "Format: (03) 9123 4567 or 1300 numbers",
      example: "(02) 1234 5678",
      usage: "Landline phone numbers"
    },
    "mobile" => {
      category: "Text",
      validation: "Format: 04XX XXX XXX, starts with 04",
      example: "0412 345 678",
      usage: "Mobile phone numbers"
    },
    "url" => {
      category: "Text",
      validation: "Valid URL, starts with http:// or https://",
      example: "https://example.com/document",
      usage: "Links to documents, websites, resources"
    },
    # Numbers (4)
    "number" => {
      category: "Numbers",
      validation: "Decimal numbers, up to 2 decimal places",
      example: "123.45",
      usage: "Quantities, measurements, decimal values"
    },
    "whole_number" => {
      category: "Numbers",
      validation: "Integers only, no decimals",
      example: "42",
      usage: "Counts, IDs, whole number quantities"
    },
    "currency" => {
      category: "Numbers",
      validation: "Positive, 2 decimals, displays with $",
      example: "$1,234.56",
      usage: "Prices, costs, monetary amounts"
    },
    "percentage" => {
      category: "Numbers",
      validation: "0-100, displays with % symbol",
      example: "15.5%",
      usage: "Discounts, completion rates, percentages"
    },
    # Date & Time (2)
    "date" => {
      category: "Date & Time",
      validation: "Stored: YYYY-MM-DD, Display: DD/MM/YYYY",
      example: "19/11/2024",
      usage: "Start dates, due dates, milestones"
    },
    "date_and_time" => {
      category: "Date & Time",
      validation: "Full timestamp with time",
      example: "19/11/2024 16:45",
      usage: "Timestamps, created/updated times"
    },
    # Special (4)
    "gps_coordinates" => {
      category: "Special",
      validation: "Latitude, Longitude format",
      example: "-33.8688, 151.2093",
      usage: "Location data, addresses with coordinates"
    },
    "color_picker" => {
      category: "Special",
      validation: "Hex color format #RRGGBB",
      example: "#3498DB",
      usage: "Status colors, category colors"
    },
    "file_upload" => {
      category: "Special",
      validation: "File path or URL to uploaded file",
      example: "/uploads/document.pdf",
      usage: "Attachments, documents, images"
    },
    "action_buttons" => {
      category: "Special",
      validation: "JSON config for row actions",
      example: '{"buttons": [{"label": "View", "action": "view"}]}',
      usage: "Row-level actions like View, Edit, Download, Approve, Process"
    },
    # Selection (2)
    "boolean" => {
      category: "Selection",
      validation: "True or False only",
      example: "true, false",
      usage: "Yes/No flags, active/inactive status"
    },
    "choice" => {
      category: "Selection",
      validation: "Must be one of predefined options",
      example: "Active, Pending, Complete",
      usage: "Status, priority, category selection"
    },
    # Relationships (3)
    "lookup" => {
      category: "Relationships",
      validation: "Must reference valid value from linked table",
      example: "Customer: ABC Corp",
      usage: "Link to related record in another table"
    },
    "multiple_lookups" => {
      category: "Relationships",
      validation: "Array of IDs stored as JSON",
      example: "Tag1, Tag2, Tag3",
      usage: "Tags, categories, multiple selections"
    },
    "user" => {
      category: "Relationships",
      validation: "Must reference valid user ID",
      example: "John Doe",
      usage: "Assigned user, created by, owner"
    },
    # Computed (1)
    "computed" => {
      category: "Computed",
      validation: "Read-only, calculated from formula",
      example: "={price} * {quantity}",
      usage: "Calculated totals, formulas, derived values"
    },
    # Advanced (3)
    "structured_data" => {
      category: "Advanced",
      validation: "Valid JSON object, supports nesting",
      example: '{"key": "value"}',
      usage: "Complex nested data structures"
    },
    "array_of_items" => {
      category: "Advanced",
      validation: "Array of text values",
      example: '["item1", "item2", "item3"]',
      usage: "Lists, tags, multiple text values"
    },
    "searchable_text" => {
      category: "Advanced",
      validation: "Read-only, auto-generated for search",
      example: "Full-text searchable content",
      usage: "GIN indexed search optimization"
    },
    # Australian (6)
    "abn" => {
      category: "Australian",
      validation: "11 digits, format: XX XXX XXX XXX",
      example: "12 345 678 901",
      usage: "Australian Business Number"
    },
    "acn" => {
      category: "Australian",
      validation: "9 digits, format: XXX XXX XXX",
      example: "123 456 789",
      usage: "Australian Company Number"
    },
    "bsb" => {
      category: "Australian",
      validation: "6 digits, format: XXX-XXX",
      example: "123-456",
      usage: "Bank State Branch code"
    },
    "bank_account" => {
      category: "Australian",
      validation: "Up to 9 digits",
      example: "123456789",
      usage: "Bank account numbers"
    },
    "postcode" => {
      category: "Australian",
      validation: "Exactly 4 digits",
      example: "4000",
      usage: "Australian postcodes"
    },
    "tfn" => {
      category: "Australian",
      validation: "9 digits, format: XXX XXX XXX",
      example: "123 456 789",
      usage: "Tax File Number"
    }
  }.freeze

  # Category display order
  CATEGORY_ORDER = {
    "Text" => 1,
    "Numbers" => 2,
    "Date & Time" => 3,
    "Special" => 4,
    "Selection" => 5,
    "Relationships" => 6,
    "Computed" => 7,
    "Advanced" => 8,
    "Australian" => 9,
    "Other" => 99
  }.freeze

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

  # Categorize column types - reads from COLUMN_TYPE_METADATA SSoT
  def categorize_column_type(type)
    COLUMN_TYPE_METADATA.dig(type, :category) || "Other"
  end

  # Get SQL type from Column model mapping
  # Uses Column::COLUMN_SQL_TYPE_MAP which is the single source of truth
  def get_sql_type(column_type)
    Column::COLUMN_SQL_TYPE_MAP[column_type] || "UNKNOWN"
  end

  # Get validation rules for a column type
  # First tries to get from database column.description field
  # Falls back to COLUMN_TYPE_METADATA SSoT
  def get_validation_rules(column)
    # Use database description if available (updated by teeem:update_validation_rules rake task)
    return column.description if column.description.present?

    # Fallback to SSoT constant
    COLUMN_TYPE_METADATA.dig(column.column_type, :validation) || "No validation rules defined"
  end

  # Get example value for a column type - reads from COLUMN_TYPE_METADATA SSoT
  def get_example(column)
    COLUMN_TYPE_METADATA.dig(column.column_type, :example) || "No example available"
  end

  # Get usage description for a column type - reads from COLUMN_TYPE_METADATA SSoT
  def get_used_for(column)
    COLUMN_TYPE_METADATA.dig(column.column_type, :usage) || "No usage description available"
  end

  # Format column name to display label
  def format_label(name)
    # Convert "Mobile" to "Mobile", "Email Address" to "Email address", etc.
    name.to_s
  end

  # Category ordering for sorting - reads from CATEGORY_ORDER SSoT
  def category_order(category)
    CATEGORY_ORDER[category] || 99
  end
end

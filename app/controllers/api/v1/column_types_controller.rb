class Api::V1::ColumnTypesController < ApplicationController
  skip_before_action :authorize_request  # Public endpoint - column types are reference data

  # GET /api/v1/column_types
  # Returns all column type definitions from the Gold Standard Reference table
  def index
    gold_standard_table = Table.find_by(id: 166) || Table.find_by(name: 'Gold Standard Reference')

    unless gold_standard_table
      render json: {
        success: false,
        error: 'Gold Standard Reference table not found',
        data: []
      }, status: :not_found
      return
    end

    # Get all columns from Gold Standard table and convert to type definitions
    column_types = gold_standard_table.columns.map do |column|
      format_column_type(column)
    end

    # Sort by category and label
    sorted_types = column_types.sort_by { |t| [category_order(t[:category]), t[:label]] }

    render json: {
      success: true,
      data: sorted_types,
      total: sorted_types.count,
      source: 'Gold Standard Reference Table',
      table_id: gold_standard_table.id
    }
  end

  # GET /api/v1/column_types/:column_type
  # Returns specific column type definition
  def show
    gold_standard_table = Table.find_by(id: 166) || Table.find_by(name: 'Gold Standard Reference')

    unless gold_standard_table
      render json: {
        success: false,
        error: 'Gold Standard Reference table not found'
      }, status: :not_found
      return
    end

    # Find column by column_type value
    column = gold_standard_table.columns.find_by(column_type: params[:id])

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
    gold_standard_table = Table.find_by(id: 166) || Table.find_by(name: 'Gold Standard Reference')

    unless gold_standard_table
      render json: {
        success: false,
        error: 'Gold Standard Reference table not found'
      }, status: :not_found
      return
    end

    # Find column by column_type value
    column = gold_standard_table.columns.find_by(column_type: params[:id])

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
        message: 'Column type updated successfully',
        data: format_column_type(column.reload)
      }
    else
      render json: {
        success: false,
        error: 'Failed to update column type',
        errors: column.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  private

  # Format a Gold Standard column into column type metadata
  def format_column_type(column)
    # Map column_type to category
    category = categorize_column_type(column.column_type)

    # Get SQL type from Column model mapping
    sql_type = get_sql_type(column.column_type)

    # Get metadata from column settings or generate defaults
    validation_rules = get_validation_rules(column)
    example = get_example(column)
    used_for = get_used_for(column)

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
      columnId: column.id
    }
  end

  # Categorize column types
  def categorize_column_type(type)
    categories = {
      'single_line_text' => 'Text',
      'multiple_lines_text' => 'Text',
      'email' => 'Text',
      'phone' => 'Text',
      'mobile' => 'Text',
      'url' => 'Text',
      'number' => 'Numbers',
      'whole_number' => 'Numbers',
      'currency' => 'Numbers',
      'percentage' => 'Numbers',
      'date' => 'Date & Time',
      'date_and_time' => 'Date & Time',
      'gps_coordinates' => 'Special',
      'color_picker' => 'Special',
      'file_upload' => 'Special',
      'boolean' => 'Selection',
      'choice' => 'Selection',
      'lookup' => 'Relationships',
      'multiple_lookups' => 'Relationships',
      'user' => 'Relationships',
      'computed' => 'Computed'
    }
    categories[type] || 'Other'
  end

  # Get SQL type from Column model mapping
  def get_sql_type(column_type)
    db_type = Column::COLUMN_TYPE_MAP[column_type]

    sql_types = {
      string: 'VARCHAR(255)',
      text: 'TEXT',
      integer: 'INTEGER',
      decimal: 'DECIMAL(10,2)',
      boolean: 'BOOLEAN',
      date: 'DATE',
      datetime: 'TIMESTAMP'
    }

    sql_types[db_type] || 'UNKNOWN'
  end

  # Get validation rules for a column type
  def get_validation_rules(column)
    # Check settings first
    return column.settings['validation_rules'] if column.settings&.dig('validation_rules').present?

    # Fall back to defaults
    rules = {
      'single_line_text' => 'Optional text field, max 255 characters, alphanumeric',
      'multiple_lines_text' => 'Long text field, unlimited length, supports line breaks',
      'email' => 'Valid email address format (user@domain.com)',
      'phone' => 'Phone number format, various formats accepted',
      'mobile' => 'Mobile phone number format: 04XX XXX XXX',
      'url' => 'Valid URL starting with http:// or https://',
      'number' => 'Decimal number with up to 2 decimal places',
      'whole_number' => 'Integer only, no decimal places',
      'currency' => 'Currency amount with 2 decimal places',
      'percentage' => 'Percentage value (0-100) with decimals',
      'date' => 'Date format: DD/MM/YYYY',
      'date_and_time' => 'Date and time format: DD/MM/YYYY HH:MM',
      'gps_coordinates' => 'GPS format: latitude, longitude',
      'color_picker' => 'Hex color code: #RRGGBB',
      'file_upload' => 'File path or URL to uploaded file',
      'boolean' => 'True/False, Yes/No, 1/0',
      'choice' => 'Single selection from predefined list',
      'lookup' => 'Reference to another table record',
      'multiple_lookups' => 'Multiple references to another table',
      'user' => 'Reference to a user in the system',
      'computed' => 'Formula-based calculated value'
    }

    rules[column.column_type] || 'No validation rules defined'
  end

  # Get example value for a column type
  def get_example(column)
    # Check settings first
    return column.settings['example'] if column.settings&.dig('example').present?

    # Fall back to defaults
    examples = {
      'single_line_text' => 'CONC-001, STL-042A',
      'multiple_lines_text' => 'This is a longer description\nwith multiple lines',
      'email' => 'john.doe@example.com',
      'phone' => '(02) 1234 5678',
      'mobile' => '0412 345 678',
      'url' => 'https://example.com/document',
      'number' => '123.45',
      'whole_number' => '42',
      'currency' => '$1,234.56',
      'percentage' => '15.5%',
      'date' => '19/11/2024',
      'date_and_time' => '19/11/2024 16:45',
      'gps_coordinates' => '-33.8688, 151.2093',
      'color_picker' => '#3498DB',
      'file_upload' => '/uploads/document.pdf',
      'boolean' => 'true, false',
      'choice' => 'Active, Pending, Complete',
      'lookup' => 'Customer: ABC Corp',
      'multiple_lookups' => 'Tag1, Tag2, Tag3',
      'user' => 'John Doe',
      'computed' => '={price} * {quantity}'
    }

    examples[column.column_type] || 'No example available'
  end

  # Get usage description for a column type
  def get_used_for(column)
    # Check settings first
    return column.settings['used_for'] if column.settings&.dig('used_for').present?

    # Fall back to defaults
    descriptions = {
      'single_line_text' => 'Unique identifier code for inventory',
      'multiple_lines_text' => 'Detailed notes, descriptions, comments',
      'email' => 'Contact email addresses',
      'phone' => 'Landline phone numbers',
      'mobile' => 'Mobile phone numbers',
      'url' => 'Links to documents, websites, resources',
      'number' => 'Quantities, measurements, decimal values',
      'whole_number' => 'Counts, IDs, whole number quantities',
      'currency' => 'Prices, costs, monetary amounts',
      'percentage' => 'Discounts, completion rates, percentages',
      'date' => 'Start dates, due dates, milestones',
      'date_and_time' => 'Timestamps, created/updated times',
      'gps_coordinates' => 'Location data, addresses with coordinates',
      'color_picker' => 'Status colors, category colors',
      'file_upload' => 'Attachments, documents, images',
      'boolean' => 'Yes/No flags, active/inactive status',
      'choice' => 'Status, priority, category selection',
      'lookup' => 'Link to related record in another table',
      'multiple_lookups' => 'Tags, categories, multiple selections',
      'user' => 'Assigned user, created by, owner',
      'computed' => 'Calculated totals, formulas, derived values'
    }

    descriptions[column.column_type] || 'No usage description available'
  end

  # Format column name to display label
  def format_label(name)
    # Convert "Mobile" to "Mobile", "Email Address" to "Email address", etc.
    name.to_s
  end

  # Category ordering for sorting
  def category_order(category)
    order = {
      'Text' => 1,
      'Numbers' => 2,
      'Date & Time' => 3,
      'Special' => 4,
      'Selection' => 5,
      'Relationships' => 6,
      'Computed' => 7,
      'Other' => 8
    }
    order[category] || 99
  end
end

class Api::V1::GoldStandardItemsController < ApplicationController
  before_action :set_item, only: [:update, :destroy]
  before_action :authenticate_user!, only: [:sync_with_columns]

  def index
    # Pagination parameters
    page = (params[:page] || 1).to_i
    per_page = [(params[:per_page] || 250).to_i, 250].min  # Default 250, cap at 250 max
    page = [page, 1].max  # Ensure page is at least 1

    # Calculate offset
    offset = (page - 1) * per_page

    # Start with base query
    query = GoldStandardItem.all

    # Apply filters if provided
    if params[:filters].present?
      query = apply_filters(query, params[:filters])
    end

    # Apply sorting
    query = query.order(created_at: :desc)

    # Get total count AFTER filtering
    total_count = query.count

    # Fetch paginated items
    items = query.limit(per_page).offset(offset)

    # Set caching headers (5 minutes cache) - disable if filters present
    expires_in 5.minutes, public: true unless params[:filters].present?

    render json: {
      success: true,
      items: items,
      pagination: {
        current_page: page,
        per_page: per_page,
        total_count: total_count,
        total_pages: (total_count.to_f / per_page).ceil,
        has_next_page: offset + per_page < total_count,
        has_prev_page: page > 1
      },
      filters_applied: params[:filters].present?
    }
  end

  def create
    item = GoldStandardItem.new(item_params)

    if item.save
      render json: { success: true, item: item }, status: :created
    else
      render json: { success: false, errors: item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @item.update(item_params)
      render json: { success: true, item: @item }
    else
      render json: { success: false, errors: @item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @item.destroy
    render json: { success: true, message: "Item deleted successfully" }
  end

  # Public endpoint to sync column types with the columns table
  # NOTE: This should be protected in production - see Item 14
  def sync_with_columns
    begin
      # Fetch all columns for the Gold Standard table (table_id = 9)
      columns = Column.where(table_id: 9).order(:position)

      render json: {
        success: true,
        message: "Column sync retrieved successfully",
        columns: columns.map { |col| {
          id: col.id,
          name: col.name,
          column_type: col.column_type,
          position: col.position
        }}
      }
    rescue => e
      render json: {
        success: false,
        error: e.message
      }, status: :internal_server_error
    end
  end

  private

  def set_item
    @item = GoldStandardItem.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { success: false, error: "Item not found" }, status: :not_found
  end

  # Apply filters to the query
  # Supports filtering by any column with appropriate matching strategy
  def apply_filters(query, filters)
    filters.each do |key, value|
      next if value.blank?

      column_name = key.to_s

      # Skip invalid column names for security
      next unless GoldStandardItem.column_names.include?(column_name)

      # Determine filter type based on column type
      column = GoldStandardItem.columns_hash[column_name]

      case column.type
      when :string, :text
        # Text fields: case-insensitive partial match
        query = query.where("LOWER(#{column_name}) LIKE ?", "%#{value.to_s.downcase}%")
      when :integer, :decimal, :float
        # Numeric fields: exact match (or could extend to support ranges)
        query = query.where(column_name => value)
      when :boolean
        # Boolean fields: exact match
        bool_value = ActiveModel::Type::Boolean.new.cast(value)
        query = query.where(column_name => bool_value)
      when :date, :datetime
        # Date fields: exact match (or could extend to support ranges)
        query = query.where(column_name => value)
      else
        # Default: exact match
        query = query.where(column_name => value)
      end
    end

    query
  end

  def item_params
    # SECURITY: Only permit user-editable fields, never system timestamps or IDs
    params.require(:gold_standard_item).permit(
      # Contact fields
      :email,
      :phone,
      :mobile,

      # Text fields
      :single_line_text,
      :multiple_lines_text,

      # Numeric fields
      :whole_number,
      :number,
      :currency,
      :percentage,

      # Date fields
      :date,
      :date_and_time,

      # Special fields
      :url,
      :gps_coordinates,
      :color_picker,
      :file_upload,
      :boolean,

      # Lookup and choice fields
      :choice,
      :lookup,
      :multiple_lookups,

      # Other fields
      :user,
      :computed,
      :action_buttons
    )
  end
end

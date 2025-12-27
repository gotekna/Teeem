class Api::V1::GoldStandardTableController < ApplicationController
  before_action :set_item, only: [ :update, :destroy, :merge ]
  # sync_with_columns uses the default authorize_request from ApplicationController

  def index
    # Pagination parameters
    page = (params[:page] || 1).to_i
    per_page = [ (params[:per_page] || 250).to_i, 250 ].min  # Default 250, cap at 250 max
    page = [ page, 1 ].max  # Ensure page is at least 1

    # Calculate offset
    offset = (page - 1) * per_page

    # Start with base query
    query = GoldStandardTable.all

    # Apply search using SSoT SearchService
    if params[:search].present?
      search_columns = if params[:search_all] == "true"
        # Search all text columns
        GoldStandardTable.column_names.select do |col|
          GoldStandardTable.columns_hash[col].type.in?([ :string, :text ])
        end
      else
        # Search primary columns only
        %w[single_line_text multiple_lines_text]
      end

      query = SearchService.apply(
        query,
        params[:search],
        columns: search_columns,
        mode: params[:search_mode] || 'contains',
        model: GoldStandardTable
      )
    end

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

    # Disable caching for admin table - needs to reflect changes immediately
    # expires_in 5.minutes, public: true unless params[:filters].present?
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

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
    item = GoldStandardTable.new(item_params)

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

  # POST /api/v1/gold_standard_table/bulk_delete
  def bulk_delete
    ids = params[:ids]
    return render json: { success: false, error: "No IDs provided" }, status: :bad_request if ids.blank?

    ids = ids.first(1000) if ids.is_a?(Array)
    deleted_count = GoldStandardTable.where(id: ids).delete_all

    render json: {
      success: true,
      deleted_count: deleted_count,
      requested_count: ids.size
    }
  rescue => e
    Rails.logger.error "Error bulk deleting gold standard items: #{e.class} - #{e.message}"
    render json: { error: e.message }, status: :internal_server_error
  end

  # POST /api/v1/gold_standard_table/:id/merge
  def merge
    secondary_ids = params[:secondary_ids]

    return render json: { success: false, error: "No secondary IDs provided" }, status: :bad_request if secondary_ids.blank?

    secondary_items = GoldStandardTable.where(id: secondary_ids)

    ActiveRecord::Base.transaction do
      # Merge data from secondary items into primary
      # For each field, use primary value if present, otherwise use first non-nil secondary value
      secondary_items.each do |secondary|
        @item.attributes.each_key do |attr|
          next if %w[id created_at updated_at].include?(attr)
          next if @item[attr].present?

          if secondary[attr].present?
            @item[attr] = secondary[attr]
          end
        end
      end

      @item.save!

      # Delete secondary items
      deleted_count = secondary_items.delete_all

      render json: {
        success: true,
        primary_item: @item,
        merged_count: deleted_count,
        message: "Successfully merged #{deleted_count} item(s) into item ##{@item.id}"
      }
    end
  rescue => e
    Rails.logger.error "Error merging gold standard items: #{e.class} - #{e.message}"
    render json: { success: false, error: e.message }, status: :internal_server_error
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
    @item = GoldStandardTable.find(params[:id])
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
      next unless GoldStandardTable.column_names.include?(column_name)

      # Determine filter type based on column type
      column = GoldStandardTable.columns_hash[column_name]

      case column.type
      when :string, :text
        # Text fields: case-insensitive partial match
        # Use quote_column_name to prevent SQL injection
        safe_column = ActiveRecord::Base.connection.quote_column_name(column_name)
        query = query.where("LOWER(#{safe_column}) LIKE ?", "%#{value.to_s.downcase}%")
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
    params.require(:gold_standard_table).permit(
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
      :action_buttons,

      # Australian identifier fields
      :abn,
      :acn,
      :bsb,
      :bank_account,
      :postcode,
      :tfn
    )
  end
end

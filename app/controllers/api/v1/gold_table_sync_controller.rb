class Api::V1::GoldTableSyncController < ApplicationController
  skip_before_action :authorize_request  # Public endpoint for system administration

  # GET /api/v1/gold_table_sync
  # Returns comparison of column type definitions from all sources
  def index
    gold_standard_table = Table.find_by(id: 1) || Table.find_by(name: 'Gold Standard Reference')

    unless gold_standard_table
      render json: {
        success: false,
        error: 'Gold Standard Reference table not found'
      }, status: :not_found
      return
    end

    # Get all columns from Gold Standard table (from database schema)
    db_columns = ActiveRecord::Base.connection.columns('gold_standard_items')

    # Get column metadata from columns table
    metadata_columns = gold_standard_table.columns.index_by(&:column_name)

    comparison_data = db_columns.map do |db_col|
      column_name = db_col.name
      metadata = metadata_columns[column_name]

      # Determine if system column
      is_system = ['id', 'created_at', 'updated_at'].include?(column_name)

      # Get column type (if it's a column type column)
      column_type = metadata&.column_type

      # Get SQL types from different sources
      trinity_sql = get_trinity_sql_type(column_type) if column_type
      backend_sql = Column::COLUMN_SQL_TYPE_MAP[column_type] if column_type
      frontend_sql = get_frontend_sql_type(column_type) if column_type

      # Determine status
      status = if is_system
        'system'
      elsif column_type.nil?
        'no_type'
      elsif trinity_sql == backend_sql && backend_sql == frontend_sql
        'match'
      else
        'mismatch'
      end

      {
        column_name: column_name,
        display_name: metadata&.name || column_name.titleize,
        column_type: column_type,
        is_system: is_system,
        trinity_sql: trinity_sql || (is_system ? 'N/A' : 'Not Found'),
        backend_sql: backend_sql || (is_system ? db_col.sql_type.upcase : 'Not Found'),
        frontend_sql: frontend_sql || (is_system ? 'N/A' : 'Not Found'),
        actual_db_sql: db_col.sql_type.upcase,
        status: status
      }
    end

    render json: {
      success: true,
      data: comparison_data,
      total: comparison_data.length,
      summary: {
        total_columns: comparison_data.length,
        system_columns: comparison_data.count { |c| c[:is_system] },
        matching: comparison_data.count { |c| c[:status] == 'match' },
        mismatched: comparison_data.count { |c| c[:status] == 'mismatch' },
        no_type: comparison_data.count { |c| c[:status] == 'no_type' }
      }
    }
  end

  private

  def get_trinity_sql_type(column_type)
    return nil unless column_type

    # Search Trinity for the column type entry by matching title
    # Trinity entries were created with title like "Mobile - mobile"
    # Match the exact column_type after the dash to avoid partial matches
    # (e.g., "number" should not match "Phone number")
    trinity_entry = Trinity.where(category: 'teacher', chapter_number: 19)
                           .where("title ILIKE ?", "% - #{column_type}")
                           .first

    # Extract SQL type from description (format: "Column type: VARCHAR(20)")
    if trinity_entry && trinity_entry.description
      sql_type = trinity_entry.description.match(/Column type: (.+)/)&.captures&.first
      return sql_type if sql_type
    end

    nil
  end

  def get_frontend_sql_type(column_type)
    return nil unless column_type

    # Source of Truth: Column::COLUMN_SQL_TYPE_MAP (see Bible Rule #19.37)
    # DO NOT hardcode a duplicate map here - read from the single source
    Column::COLUMN_SQL_TYPE_MAP[column_type]
  end
end

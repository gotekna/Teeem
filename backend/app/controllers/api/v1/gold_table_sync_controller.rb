class Api::V1::GoldTableSyncController < ApplicationController
  skip_before_action :authorize_request  # Public endpoint for system administration

  # GET /api/v1/gold_table_sync
  # Returns comparison of column type definitions from all sources
  def index
    # SSoT: Use slug, not hardcoded ID (IDs differ between environments)
    gold_standard_foundation = Foundation.find_by(slug: "gold_standard_table")

    unless gold_standard_foundation
      render json: {
        success: false,
        error: "Gold Standard Reference foundation not found"
      }, status: :not_found
      return
    end

    # Get all columns from Gold Standard foundation (from database schema)
    db_columns = ActiveRecord::Base.connection.columns("gold_standard_table")

    # Get column metadata from columns table
    metadata_columns = gold_standard_foundation.columns.index_by(&:column_name)

    comparison_data = db_columns.map do |db_col|
      column_name = db_col.name
      metadata = metadata_columns[column_name]

      # Determine if system column
      is_system = [ "id", "created_at", "updated_at" ].include?(column_name)

      # Get column type (if it's a column type column)
      column_type = metadata&.column_type

      # Get SQL types from different sources
      trinity_sql = get_trinity_sql_type(column_type) if column_type
      backend_sql = Column::COLUMN_SQL_TYPE_MAP[column_type] if column_type
      frontend_sql = get_frontend_sql_type(column_type) if column_type

      # Determine status - normalize SQL types for comparison
      # (e.g., DECIMAL vs NUMERIC, DATETIME vs TIMESTAMP are equivalent)
      normalized_trinity = normalize_sql_type(trinity_sql)
      normalized_backend = normalize_sql_type(backend_sql)
      normalized_frontend = normalize_sql_type(frontend_sql)

      status = if is_system
        "system"
      elsif column_type.nil?
        "no_type"
      elsif normalized_trinity == normalized_backend && normalized_backend == normalized_frontend
        "match"
      else
        "mismatch"
      end

      {
        column_name: column_name,
        display_name: metadata&.name || column_name.titleize,
        column_type: column_type,
        is_system: is_system,
        trinity_sql: trinity_sql || (is_system ? "N/A" : "Not Found"),
        backend_sql: backend_sql || (is_system ? db_col.sql_type.upcase : "Not Found"),
        frontend_sql: frontend_sql || (is_system ? "N/A" : "Not Found"),
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
        matching: comparison_data.count { |c| c[:status] == "match" },
        mismatched: comparison_data.count { |c| c[:status] == "mismatch" },
        no_type: comparison_data.count { |c| c[:status] == "no_type" }
      }
    }
  end

  private

  def get_trinity_sql_type(column_type)
    return nil unless column_type

    # Search Trinity for the column type entry by matching metadata.column_type_value
    # Trinity entries in Chapter 19 have metadata like:
    #   {"column_type_value": "mobile", "sql_type": "VARCHAR(20)", ...}
    trinity_entry = Trinity.where(category: "teacher", chapter_number: 19)
                           .where("metadata->>'column_type_value' = ?", column_type)
                           .first

    # Extract SQL type from metadata (stored in metadata.sql_type)
    if trinity_entry && trinity_entry.metadata.present?
      sql_type = trinity_entry.metadata["sql_type"]
      return sql_type if sql_type.present?
    end

    nil
  end

  def get_frontend_sql_type(column_type)
    return nil unless column_type

    # Source of Truth: Column::COLUMN_SQL_TYPE_MAP (see Bible Rule #19.37)
    # DO NOT hardcode a duplicate map here - read from the single source
    Column::COLUMN_SQL_TYPE_MAP[column_type]
  end

  # Normalize SQL types to handle synonyms in PostgreSQL
  # DECIMAL and NUMERIC are identical in PostgreSQL
  # DATETIME and TIMESTAMP are equivalent
  # COMPUTED/VIRTUAL are implementation-specific
  def normalize_sql_type(sql_type)
    return nil unless sql_type

    normalized = sql_type.upcase
    # Normalize DECIMAL to NUMERIC (PostgreSQL treats them identically)
    normalized = normalized.gsub(/\bDECIMAL\b/, "NUMERIC")
    # Normalize DATETIME to TIMESTAMP
    normalized = normalized.gsub(/\bDATETIME\b/, "TIMESTAMP")
    # Normalize computed column variants
    normalized = normalized.gsub(/\bVIRTUAL\/COMPUTED\b|\bCOMPUTED\b|\bVIRTUAL\b/, "COMPUTED")
    normalized
  end
end

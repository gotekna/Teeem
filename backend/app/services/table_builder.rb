class TableBuilder
  attr_reader :table, :errors

  def initialize(table)
    @table = table
    @errors = []
  end

  # Create the actual database table based on the table definition
  def create_database_table
    return { success: false, errors: @errors } unless validate_table

    begin
      # Store these in local variables for use inside the schema block
      table_name = @table.database_table_name
      columns = @table.columns.order(:position).to_a
      builder = self

      ActiveRecord::Migration.suppress_messages do
        ActiveRecord::Schema.define do
          create_table table_name.to_sym, force: true do |t|
            # Add columns from the table definition
            # Skip reserved columns as Rails creates them automatically:
            # - 'id' as the primary key
            # - 'created_at' and 'updated_at' via t.timestamps
            columns.each do |column|
              next if TableBuilder::RESERVED_COLUMNS.include?(column.column_name)
              builder.send(:add_column_to_migration, t, column)
            end

            t.timestamps
          end

          # Add indexes for commonly sorted/queried timestamp fields to improve performance
          add_index table_name.to_sym, :created_at
          add_index table_name.to_sym, :updated_at
        end
      end

      # Reload the dynamic model to include new columns
      @table.reload_dynamic_model

      { success: true }
    rescue => e
      @errors << "Failed to create database table: #{e.message}"
      { success: false, errors: @errors }
    end
  end

  # Add a new column to an existing table
  def add_column(column)
    begin
      ActiveRecord::Migration.suppress_messages do
        ActiveRecord::Migration.add_column(
          @table.database_table_name.to_sym,
          column.column_name.to_sym,
          column.db_type,
          column_options(column)
        )
      end

      # Add index for lookup columns
      if column.column_type == "lookup"
        ActiveRecord::Migration.add_index(
          @table.database_table_name.to_sym,
          column.column_name.to_sym
        )
      end

      # Add foreign key for lookup columns
      if column.column_type == "lookup" && column.lookup_foundation
        begin
          ActiveRecord::Migration.add_foreign_key(
            @table.database_table_name.to_sym,
            column.lookup_foundation.database_table_name.to_sym,
            column: column.column_name.to_sym,
            on_delete: :nullify  # Set to NULL when referenced record is deleted
          )
        rescue => e
          Rails.logger.error "Failed to add foreign key for #{column.column_name}: #{e.message}"
          # Don't fail the whole operation if FK creation fails
        end
      end

      # Reload the dynamic model
      @table.reload_dynamic_model

      { success: true }
    rescue => e
      @errors << "Failed to add column: #{e.message}"
      { success: false, errors: @errors }
    end
  end

  # Remove a column from an existing table
  def remove_column(column)
    begin
      ActiveRecord::Migration.suppress_messages do
        ActiveRecord::Migration.remove_column(
          @table.database_table_name.to_sym,
          column.column_name.to_sym
        )
      end

      # Reload the dynamic model
      @table.reload_dynamic_model

      { success: true }
    rescue => e
      @errors << "Failed to remove column: #{e.message}"
      { success: false, errors: @errors }
    end
  end

  # Drop the database table
  def drop_database_table
    begin
      ActiveRecord::Migration.suppress_messages do
        ActiveRecord::Migration.drop_table @table.database_table_name.to_sym, if_exists: true
      end

      # Remove the dynamic model class
      begin
        class_name = @table.name.classify
        Object.send(:remove_const, class_name) if Object.const_defined?(class_name)
      rescue NameError
        # If class name is invalid, just skip this step
      end

      { success: true }
    rescue => e
      # If the error is that the table doesn't exist, that's fine - treat as success
      if e.message.include?("does not exist") || e.is_a?(ActiveRecord::StatementInvalid)
        { success: true }
      else
        @errors << "Failed to drop database table: #{e.message}"
        { success: false, errors: @errors }
      end
    end
  end

  private

  # Reserved column names that Rails creates automatically
  RESERVED_COLUMNS = %w[id created_at updated_at].freeze

  def validate_table
    # Allow tables with no columns - they will have id and timestamps at minimum
    # Tables can be created empty and columns added later

    if @table.database_table_name.blank?
      @errors << "Table must have a database_table_name"
      return false
    end

    # Check for SQL injection in table/column names
    unless safe_name?(@table.database_table_name)
      @errors << "Invalid table name"
      return false
    end

    @table.columns.each do |column|
      unless safe_name?(column.column_name)
        @errors << "Invalid column name: #{column.name}"
        return false
      end
    end

    true
  end

  def safe_name?(name)
    # Only allow alphanumeric and underscores
    name.match?(/\A[a-z_][a-z0-9_]*\z/)
  end

  def add_column_to_migration(table_definition, column)
    options = column_options(column)

    table_definition.send(
      column.db_type,
      column.column_name.to_sym,
      **options
    )

    # Add index for unique columns
    if column.is_unique
      table_definition.index column.column_name.to_sym, unique: true
    end

    # Add index for lookup columns
    if column.column_type == "lookup"
      table_definition.index column.column_name.to_sym
    end
  end

  def column_options(column)
    options = {}

    # Get the SQL type from SSoT (Column::COLUMN_SQL_TYPE_MAP)
    sql_type = column.effective_sql_type

    # String/text length - parse from SQL type or use column override
    if column.db_type == :string
      limit = parse_varchar_limit(sql_type) || column.max_length
      options[:limit] = limit if limit
    end

    # Decimal precision/scale - parse from SQL type (SSoT)
    if column.db_type == :decimal
      precision, scale = parse_numeric_precision(sql_type)
      options[:precision] = precision || 10
      options[:scale] = scale || 2
    end

    # Default value
    options[:default] = column.default_value if column.default_value.present?

    # Null constraint
    options[:null] = !column.required

    options
  end

  # Parse VARCHAR(N) to extract the limit
  # e.g., "VARCHAR(255)" => 255, "VARCHAR(20)" => 20
  def parse_varchar_limit(sql_type)
    return nil unless sql_type
    match = sql_type.match(/VARCHAR\((\d+)\)/i)
    match ? match[1].to_i : nil
  end

  # Parse NUMERIC(P,S) to extract precision and scale
  # e.g., "NUMERIC(10,2)" => [10, 2], "NUMERIC(5,2)" => [5, 2]
  def parse_numeric_precision(sql_type)
    return [10, 2] unless sql_type
    match = sql_type.match(/NUMERIC\((\d+),(\d+)\)/i)
    match ? [match[1].to_i, match[2].to_i] : [10, 2]
  end
end

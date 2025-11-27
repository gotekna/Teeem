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
            # Skip 'id' column as Rails creates it automatically as the primary key
            columns.each do |column|
              next if column.column_name == 'id'
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
      if column.column_type == 'lookup'
        ActiveRecord::Migration.add_index(
          @table.database_table_name.to_sym,
          column.column_name.to_sym
        )
      end

      # Add foreign key for lookup columns
      if column.column_type == 'lookup' && column.lookup_foundation
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
    if column.column_type == 'lookup'
      table_definition.index column.column_name.to_sym
    end
  end

  def column_options(column)
    options = {}

    # String/text length
    if column.db_type == :string && column.max_length
      options[:limit] = column.max_length
    end

    # Decimal precision
    if column.db_type == :decimal
      options[:precision] = 15
      options[:scale] = 2
    end

    # Default value
    options[:default] = column.default_value if column.default_value.present?

    # Null constraint
    options[:null] = !column.required

    options
  end
end

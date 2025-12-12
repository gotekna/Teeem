class AddSystemColumnsToJobsFoundation < ActiveRecord::Migration[8.0]
  def up
    # Find Jobs foundation by database_table_name (more reliable across environments)
    jobs_foundation = Foundation.find_by(database_table_name: 'jobs')

    unless jobs_foundation
      puts "WARNING: Jobs foundation not found, skipping system columns"
      return
    end

    puts "Found Jobs foundation (id: #{jobs_foundation.id})"

    # System columns to add
    system_columns = [
      {
        column_name: 'id',
        name: 'ID',
        column_type: 'whole_number',
        column_group: 'System',
        searchable: false,
        position: 0
      },
      {
        column_name: 'created_at',
        name: 'Created At',
        column_type: 'date_and_time',
        column_group: 'System',
        searchable: false,
        position: 1
      },
      {
        column_name: 'updated_at',
        name: 'Updated At',
        column_type: 'date_and_time',
        column_group: 'System',
        searchable: false,
        position: 2
      }
    ]

    # Add each system column if it doesn't already exist
    system_columns.each do |col_attrs|
      existing = jobs_foundation.columns.find_by(column_name: col_attrs[:column_name])

      if existing
        puts "Column #{col_attrs[:column_name]} already exists, skipping"
      else
        column = jobs_foundation.columns.create!(col_attrs)
        puts "Created system column: #{column.name} (#{column.column_type})"
      end
    end

    puts "System columns added to Jobs foundation successfully"
  end

  def down
    # Find Jobs foundation by database_table_name
    jobs_foundation = Foundation.find_by(database_table_name: 'jobs')
    return unless jobs_foundation

    # Remove system columns
    %w[id created_at updated_at].each do |col_name|
      column = jobs_foundation.columns.find_by(column_name: col_name)
      if column
        column.destroy
        puts "Removed system column: #{col_name}"
      end
    end
  end
end

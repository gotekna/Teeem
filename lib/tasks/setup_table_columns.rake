namespace :trapid do
  desc "Auto-generate column definitions for a table from its database schema"
  task :setup_table_columns, [:table_id] => :environment do |t, args|
    table_id = args[:table_id]&.to_i

    unless table_id
      puts "Usage: bin/rails trapid:setup_table_columns[TABLE_ID]"
      puts ""
      puts "Available tables without column definitions:"
      Table.where.not(database_table_name: [nil, '']).each do |table|
        column_count = Column.where(table_id: table.id).count
        if column_count == 0
          puts "  #{table.id}: #{table.name} (#{table.database_table_name})"
        end
      end
      exit
    end

    table = Table.find(table_id)
    puts "Setting up columns for Table #{table.id}: #{table.name}"
    puts "Database table: #{table.database_table_name}"

    # Check if model exists
    model_name = table.database_table_name.classify
    begin
      model = model_name.constantize
    rescue NameError
      puts "Warning: Model #{model_name} not found, using raw schema"
      model = nil
    end

    # Get columns from database schema
    begin
      if model
        db_columns = model.columns
      else
        db_columns = ActiveRecord::Base.connection.columns(table.database_table_name)
      end
      puts "Found #{db_columns.length} database columns"
    rescue ActiveRecord::StatementInvalid => e
      if e.message.include?('UndefinedTable') || e.message.include?('does not exist')
        puts ""
        puts "⚠️  This is a virtual table (no physical database table exists)."
        puts "   Virtual tables store data in the 'records' table as JSON."
        puts ""
        puts "   For virtual tables, you need to manually define columns based on"
        puts "   the intended data structure. Consider:"
        puts "   1. Copy columns from a similar table"
        puts "   2. Use the Schema Editor in the UI"
        puts "   3. Create a custom rake task for this table"
        puts ""
        exit
      else
        raise e
      end
    end

    # Delete existing columns for this table
    existing_count = Column.where(table_id: table_id).count
    if existing_count > 0
      print "Delete #{existing_count} existing column definitions? (y/n): "
      response = STDIN.gets.chomp.downcase
      if response == 'y'
        Column.where(table_id: table_id).destroy_all
        puts "Deleted existing columns"
      else
        puts "Keeping existing columns, adding new ones only"
      end
    end

    # Map SQL types to Gold Standard column types
    def sql_type_to_column_type(column)
      case column.type
      when :string
        case column.name
        when /email/i then 'email'
        when /phone|mobile|fax/i then 'phone'
        when /url|website|link/i then 'url'
        when /color|colour/i then 'color_picker'
        else 'single_line_text'
        end
      when :text
        'multiple_lines_text'
      when :integer, :bigint
        if column.name.end_with?('_id')
          'lookup'
        else
          'whole_number'
        end
      when :decimal, :float
        if column.name =~ /price|cost|amount|total|balance/i
          'currency'
        elsif column.name =~ /percent|rate/i
          'percentage'
        else
          'number'
        end
      when :boolean
        'boolean'
      when :date
        'date'
      when :datetime, :timestamp
        'date_and_time'
      when :json, :jsonb
        'multiple_lines_text'
      else
        'single_line_text'
      end
    end

    # Columns to skip
    skip_columns = %w[id created_at updated_at deleted_at]

    # Create column definitions
    position = 0
    created_count = 0
    skipped_count = 0

    # Add action_buttons column at position 0 (Gold Standard pattern)
    unless Column.exists?(table_id: table_id, column_type: 'action_buttons')
      Column.create!(
        table_id: table_id,
        name: 'Actions',
        column_name: 'actions',
        column_type: 'action_buttons',
        position: position,
        searchable: false
      )
      puts "  Created: Actions (actions) - action_buttons"
      created_count += 1
    end
    position = 1  # Start regular columns at position 1

    db_columns.each do |db_col|
      # Skip system columns
      if skip_columns.include?(db_col.name) || db_col.name.end_with?('$type')
        skipped_count += 1
        next
      end

      # Check if column already exists
      existing = Column.find_by(table_id: table_id, column_name: db_col.name)
      if existing
        puts "  Skipping #{db_col.name} (already exists)"
        skipped_count += 1
        next
      end

      column_type = sql_type_to_column_type(db_col)
      display_name = db_col.name.humanize.titleize

      # Special handling for _id columns (lookups)
      lookup_table_id = nil
      if db_col.name.end_with?('_id') && column_type == 'lookup'
        # Try to find the related table
        related_table_name = db_col.name.sub(/_id$/, '').pluralize
        related_table = Table.find_by(database_table_name: related_table_name)
        if related_table
          lookup_table_id = related_table.id
          display_name = db_col.name.sub(/_id$/, '').humanize.titleize
        else
          # Can't find lookup table, use single_line_text instead
          column_type = 'single_line_text'
        end
      end

      Column.create!(
        table_id: table_id,
        name: display_name,
        column_name: db_col.name,
        column_type: column_type,
        position: position,
        searchable: %w[single_line_text email multiple_lines_text].include?(column_type),
        is_title: position == 1,
        lookup_table_id: lookup_table_id
      )

      puts "  Created: #{display_name} (#{db_col.name}) - #{column_type}"
      created_count += 1
      position += 1
    end

    # Add system columns at the end
    %w[created_at updated_at].each do |sys_col|
      next if Column.exists?(table_id: table_id, column_name: sys_col)

      Column.create!(
        table_id: table_id,
        name: sys_col == 'created_at' ? 'Created' : 'Updated',
        column_name: sys_col,
        column_type: 'date_and_time',
        position: position,
        searchable: false
      )
      puts "  Created: #{sys_col} - date_and_time"
      created_count += 1
      position += 1
    end

    puts ""
    puts "Done! Created #{created_count} columns, skipped #{skipped_count}"
    puts "Column types used:"
    Column.where(table_id: table_id).group(:column_type).count.each do |type, count|
      puts "  #{type}: #{count}"
    end
    puts ""
    puts "Test at: /tables/#{table.slug || table_id}"
  end

  desc "Setup columns for ALL tables that don't have column definitions"
  task setup_all_table_columns: :environment do
    tables_without_columns = Table.where.not(database_table_name: [nil, '']).select do |table|
      Column.where(table_id: table.id).count == 0
    end

    if tables_without_columns.empty?
      puts "All tables already have column definitions!"
      exit
    end

    puts "Found #{tables_without_columns.length} tables without column definitions:"
    tables_without_columns.each do |table|
      puts "  #{table.id}: #{table.name} (#{table.database_table_name})"
    end

    print "\nSetup columns for all these tables? (y/n): "
    response = STDIN.gets.chomp.downcase
    exit unless response == 'y'

    tables_without_columns.each do |table|
      puts "\n" + "="*60
      Rake::Task['trapid:setup_table_columns'].reenable
      Rake::Task['trapid:setup_table_columns'].invoke(table.id)
    end

    puts "\n" + "="*60
    puts "All done!"
  end
end

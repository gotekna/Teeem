namespace :trapid do
  desc "Setup columns for tables with real database tables (non-interactive)"
  task setup_real_table_columns: :environment do
    # Map virtual tables to their actual database tables
    table_mappings = {
      199 => 'financial_transactions',  # Financial Transactions
      205 => 'pricebook_items',         # Price Books (pricebook_items)
      206 => 'whs_swms',                # WHS SWMS
      207 => 'whs_action_items',        # WHS Action Items
      208 => 'whs_inductions',          # WHS Inductions
      209 => 'whs_inspections',         # WHS Inspections
      210 => 'whs_incidents',           # WHS Incidents
      211 => 'contact_roles',           # Contact Roles
      213 => 'inspiring_quotes',        # Inspiring Quotes (Test)
      215 => 'suppliers',               # Suppliers
      216 => 'estimates',               # Estimates
      217 => 'purchase_orders',         # Purchase Orders
      218 => 'sm_tasks',                # SM Tasks
      219 => 'sm_resources',            # SM Resources
      220 => 'sm_time_entries',         # SM Time Entries
      221 => 'price_histories',         # Price Histories
    }

    table_mappings.each do |table_id, db_table|
      table = Table.find_by(id: table_id)
      next unless table

      puts "\n#{'=' * 60}"
      puts "Processing Table #{table_id}: #{table.name}"
      puts "Database table: #{db_table}"

      # Check if the database table exists
      begin
        db_columns = ActiveRecord::Base.connection.columns(db_table)
        puts "Found #{db_columns.length} database columns"
      rescue => e
        puts "ERROR: Database table '#{db_table}' does not exist"
        next
      end

      # Update the table to point to the real database table
      if table.database_table_name != db_table
        table.update!(database_table_name: db_table)
        puts "Updated database_table_name to: #{db_table}"
      end

      # Delete existing column definitions
      existing_count = Column.where(table_id: table_id).count
      if existing_count > 0
        Column.where(table_id: table_id).destroy_all
        puts "Deleted #{existing_count} existing column definitions"
      end

      # Create new column definitions from database schema
      create_columns_from_schema(table_id, db_columns)
    end

    puts "\n#{'=' * 60}"
    puts "All done!"
  end

  desc "Regenerate column definitions for a specific table from its database schema (no prompts)"
  task :regenerate_columns, [:table_id] => :environment do |t, args|
    table_id = args[:table_id]&.to_i

    unless table_id
      puts "Usage: bin/rails trapid:regenerate_columns[TABLE_ID]"
      puts ""
      puts "Tables with real database tables:"
      Table.all.each do |table|
        next if table.database_table_name.blank?
        begin
          col_count = ActiveRecord::Base.connection.columns(table.database_table_name).count
          col_defs = Column.where(table_id: table.id).count
          puts "  #{table.id}: #{table.name} (#{col_count} DB cols, #{col_defs} defined)"
        rescue
          # Virtual table
        end
      end
      exit
    end

    table = Table.find(table_id)
    puts "Regenerating columns for Table #{table.id}: #{table.name}"
    puts "Database table: #{table.database_table_name}"

    begin
      db_columns = ActiveRecord::Base.connection.columns(table.database_table_name)
      puts "Found #{db_columns.length} database columns"
    rescue => e
      puts "ERROR: Table has no real database table (#{table.database_table_name})"
      exit 1
    end

    # Delete existing column definitions
    existing_count = Column.where(table_id: table_id).count
    if existing_count > 0
      Column.where(table_id: table_id).destroy_all
      puts "Deleted #{existing_count} existing column definitions"
    end

    # Create new column definitions
    create_columns_from_schema(table_id, db_columns)

    puts ""
    puts "Done! Test at: /tables/#{table.slug || table_id}"
  end

  private

  def create_columns_from_schema(table_id, db_columns)
    skip_columns = %w[id created_at updated_at deleted_at]
    position = 0
    created_count = 0

    # Add action_buttons column at position 0 (Gold Standard pattern)
    Column.create!(
      table_id: table_id,
      name: 'Actions',
      column_name: 'actions',
      column_type: 'action_buttons',
      position: position,
      searchable: false
    )
    puts "  Created: Actions (action_buttons)"
    created_count += 1
    position = 1

    db_columns.each do |db_col|
      # Skip system columns
      next if skip_columns.include?(db_col.name)
      next if db_col.name.end_with?('$type')

      column_type = infer_column_type(db_col)
      display_name = db_col.name.humanize.titleize

      # Special handling for _id columns (lookups)
      lookup_table_id = nil
      lookup_display_column = nil
      if db_col.name.end_with?('_id') && column_type == 'lookup'
        related_table_name = db_col.name.sub(/_id$/, '').pluralize
        related_table = Table.find_by(database_table_name: related_table_name)
        if related_table
          # Find a valid display column from the lookup table's columns
          lookup_cols = Column.where(table_id: related_table.id).pluck(:column_name)
          # Prefer 'name', 'title', 'full_name', or first text column
          lookup_display_column = (%w[name title full_name] & lookup_cols).first
          lookup_display_column ||= lookup_cols.find { |c| !c.end_with?('_id') && c != 'actions' && c != 'id' }

          if lookup_display_column
            lookup_table_id = related_table.id
            display_name = db_col.name.sub(/_id$/, '').humanize.titleize
          else
            # No valid display column found, use whole_number
            column_type = 'whole_number'
          end
        else
          column_type = 'whole_number'  # Fallback if lookup table not found
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
        lookup_table_id: lookup_table_id,
        lookup_display_column: lookup_display_column
      )
      puts "  Created: #{display_name} (#{db_col.name}) - #{column_type}"
      created_count += 1
      position += 1
    end

    # Add system columns at the end
    %w[created_at updated_at].each do |sys_col|
      Column.create!(
        table_id: table_id,
        name: sys_col == 'created_at' ? 'Created' : 'Updated',
        column_name: sys_col,
        column_type: 'date_and_time',
        position: position,
        searchable: false
      )
      puts "  Created: #{sys_col == 'created_at' ? 'Created' : 'Updated'} - date_and_time"
      created_count += 1
      position += 1
    end

    puts ""
    puts "Created #{created_count} column definitions"
    puts "Column types:"
    Column.where(table_id: table_id).group(:column_type).count.each do |type, count|
      puts "  #{type}: #{count}"
    end
  end

  def infer_column_type(db_col)
    case db_col.type
    when :string
      case db_col.name
      when /email/i then 'email'
      when /phone|mobile|fax/i then 'phone'
      when /url|website|link/i then 'url'
      when /color|colour/i then 'color_picker'
      else 'single_line_text'
      end
    when :text
      'multiple_lines_text'
    when :integer, :bigint
      if db_col.name.end_with?('_id')
        'lookup'
      else
        'whole_number'
      end
    when :decimal, :float
      if db_col.name =~ /price|cost|amount|total|balance|value/i
        'currency'
      elsif db_col.name =~ /percent|rate/i
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
end

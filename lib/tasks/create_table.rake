namespace :trapid do
  desc "Create a new table with automatic column setup from database schema"
  task :create_table, [:name, :slug, :db_table] => :environment do |t, args|
    unless args[:name] && args[:slug] && args[:db_table]
      puts "Usage: bin/rails 'trapid:create_table[Table Name,table-slug,database_table_name]'"
      puts ""
      puts "Example: bin/rails 'trapid:create_table[My Items,my-items,my_items]'"
      puts ""
      puts "This will:"
      puts "  1. Create a new Table record"
      puts "  2. Auto-detect columns from the database table"
      puts "  3. Create Column records with appropriate types"
      puts "  4. Make the table available at /tables/ID or /tables/slug"
      exit 1
    end

    name = args[:name]
    slug = args[:slug]
    db_table = args[:db_table]

    puts "=" * 60
    puts "Creating new table: #{name}"
    puts "=" * 60

    # Check if database table exists
    unless ActiveRecord::Base.connection.table_exists?(db_table)
      puts "ERROR: Database table '#{db_table}' does not exist!"
      puts ""
      puts "Create it first with a migration:"
      puts "  bin/rails generate migration Create#{db_table.camelize}"
      exit 1
    end

    # Check if Table already exists
    if Table.exists?(slug: slug)
      puts "ERROR: Table with slug '#{slug}' already exists!"
      exit 1
    end

    # Create the Table record
    table = Table.create!(
      name: name,
      slug: slug,
      database_table_name: db_table,
      is_live: true
    )
    puts "Created Table ID: #{table.id}"

    # Get database columns
    db_columns = ActiveRecord::Base.connection.columns(db_table)
    puts "Found #{db_columns.length} columns in database table"

    # Skip these system columns
    skip_columns = %w[id created_at updated_at deleted_at]

    # Column type inference
    def infer_column_type(db_col)
      case db_col.type
      when :string
        case db_col.name
        when /email/i then 'email'
        when /phone|mobile/i then 'phone'
        when /url|website|link/i then 'url'
        when /color|colour/i then 'color_picker'
        else 'single_line_text'
        end
      when :text then 'multiple_lines_text'
      when :integer, :bigint
        return 'lookup' if db_col.name.end_with?('_id')
        'whole_number'
      when :decimal, :float
        case db_col.name
        when /price|cost|amount|total|value/i then 'currency'
        when /percent|rate/i then 'percentage'
        else 'number'
        end
      when :boolean then 'boolean'
      when :date then 'date'
      when :datetime, :timestamp then 'date_and_time'
      when :json, :jsonb then 'multiple_lines_text'
      else 'single_line_text'
      end
    end

    # Create column definitions
    position = 0

    # Add Actions column first
    Column.create!(
      table_id: table.id,
      name: 'Actions',
      column_name: 'actions',
      column_type: 'action_buttons',
      position: position
    )
    puts "  Created: Actions (actions) - action_buttons"
    position += 1

    # Create columns from database schema
    created_count = 0
    db_columns.each do |db_col|
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
          lookup_cols = Column.where(table_id: related_table.id).pluck(:column_name)
          lookup_display_column = (%w[name title full_name] & lookup_cols).first
          lookup_display_column ||= lookup_cols.find { |c| !c.end_with?('_id') && c != 'actions' && c != 'id' }

          if lookup_display_column
            lookup_table_id = related_table.id
            display_name = db_col.name.sub(/_id$/, '').humanize.titleize
          else
            column_type = 'whole_number'
          end
        else
          column_type = 'whole_number'
        end
      end

      Column.create!(
        table_id: table.id,
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
        table_id: table.id,
        name: sys_col.humanize.titleize,
        column_name: sys_col,
        column_type: 'date_and_time',
        position: position
      )
      puts "  Created: #{sys_col.humanize.titleize} (#{sys_col}) - date_and_time"
      position += 1
    end

    puts ""
    puts "=" * 60
    puts "SUCCESS! Table created with #{created_count + 3} columns"
    puts "=" * 60
    puts ""
    puts "Access your table at:"
    puts "  /tables/#{table.id}"
    puts "  /tables/#{slug}"
    puts ""
    puts "To add to sidebar navigation, edit:"
    puts "  frontend/src/components/layout/AppLayout.jsx"
    puts ""
    puts "Add this line to the navigation array:"
    puts "  { name: '#{name}', href: '/tables/#{table.id}', icon: SomeIcon },"
    puts ""
  end

  desc "List all tables"
  task list_tables: :environment do
    puts "=" * 80
    puts "All Tables in System"
    puts "=" * 80
    puts ""
    puts format("%-6s %-30s %-25s %-10s %s", "ID", "Name", "Slug", "Live?", "DB Table")
    puts "-" * 80

    Table.order(:id).each do |t|
      col_count = Column.where(table_id: t.id).count
      puts format("%-6d %-30s %-25s %-10s %s (%d cols)",
        t.id,
        t.name.to_s.truncate(28),
        t.slug.to_s.truncate(23),
        t.is_live ? "Yes" : "No",
        t.database_table_name.to_s.truncate(20),
        col_count
      )
    end
    puts ""
  end
end

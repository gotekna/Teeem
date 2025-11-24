namespace :trapid do
  desc "Copy Gold Standard column types to another table"
  task :copy_gold_standard_columns, [:target_table_id] => :environment do |t, args|
    target_id = args[:target_table_id]&.to_i

    unless target_id
      puts "Usage: bin/rails 'trapid:copy_gold_standard_columns[TABLE_ID]'"
      puts ""
      puts "This copies all 22 Gold Standard column types to the target table."
      puts "Useful for testing TrapidTableView features on any table."
      puts ""
      puts "Tables without column definitions:"
      Table.where.not(database_table_name: [nil, '']).each do |table|
        col_count = Column.where(table_id: table.id).count
        if col_count == 0
          puts "  #{table.id}: #{table.name}"
        end
      end
      exit
    end

    gold_standard = Table.find_by(id: 1)
    unless gold_standard
      puts "Error: Gold Standard table (ID 1) not found"
      exit 1
    end

    target_table = Table.find(target_id)
    puts "Copying Gold Standard columns to Table #{target_id}: #{target_table.name}"

    # Check existing columns
    existing_count = Column.where(table_id: target_id).count
    if existing_count > 0
      print "Delete #{existing_count} existing column definitions? (y/n): "
      response = STDIN.gets.chomp.downcase
      if response == 'y'
        Column.where(table_id: target_id).destroy_all
        puts "Deleted existing columns"
      else
        puts "Aborted"
        exit
      end
    end

    # Copy columns from Gold Standard
    gold_columns = Column.where(table_id: 1).order(:position)
    created_count = 0

    # First, add action_buttons at position 0
    Column.create!(
      table_id: target_id,
      name: 'Actions',
      column_name: 'actions',
      column_type: 'action_buttons',
      position: 0,
      searchable: false
    )
    puts "  Created: Actions (action_buttons) at position 0"
    created_count += 1

    # Copy each Gold Standard column
    gold_columns.each do |source|
      # Skip action_buttons since we already added it
      next if source.column_type == 'action_buttons'

      Column.create!(
        table_id: target_id,
        name: source.name,
        column_name: source.column_name,
        column_type: source.column_type,
        position: source.position,
        searchable: source.searchable,
        is_title: source.is_title,
        is_unique: source.is_unique,
        required: source.required,
        lookup_table_id: source.lookup_table_id,
        lookup_display_column: source.lookup_display_column
      )
      puts "  Created: #{source.name} (#{source.column_type}) at position #{source.position}"
      created_count += 1
    end

    puts ""
    puts "Done! Created #{created_count} columns for #{target_table.name}"
    puts "Test at: /tables/#{target_table.slug || target_id}"
  end

  desc "Setup basic columns for a virtual table (action_buttons + common fields)"
  task :setup_basic_columns, [:table_id] => :environment do |t, args|
    table_id = args[:table_id]&.to_i

    unless table_id
      puts "Usage: bin/rails 'trapid:setup_basic_columns[TABLE_ID]'"
      puts ""
      puts "This creates a basic set of columns for any virtual table:"
      puts "  - Actions (action_buttons)"
      puts "  - Name (single_line_text, title)"
      puts "  - Description (multiple_lines_text)"
      puts "  - Status (choice)"
      puts "  - Created (date_and_time)"
      puts "  - Updated (date_and_time)"
      exit
    end

    table = Table.find(table_id)
    puts "Setting up basic columns for Table #{table_id}: #{table.name}"

    existing_count = Column.where(table_id: table_id).count
    if existing_count > 0
      print "Delete #{existing_count} existing column definitions? (y/n): "
      response = STDIN.gets.chomp.downcase
      if response == 'y'
        Column.where(table_id: table_id).destroy_all
        puts "Deleted existing columns"
      else
        puts "Aborted"
        exit
      end
    end

    columns = [
      { name: 'Actions', column_name: 'actions', column_type: 'action_buttons', position: 0 },
      { name: 'Name', column_name: 'name', column_type: 'single_line_text', position: 1, is_title: true, searchable: true },
      { name: 'Description', column_name: 'description', column_type: 'multiple_lines_text', position: 2, searchable: true },
      { name: 'Status', column_name: 'status', column_type: 'choice', position: 3 },
      { name: 'Created', column_name: 'created_at', column_type: 'date_and_time', position: 4 },
      { name: 'Updated', column_name: 'updated_at', column_type: 'date_and_time', position: 5 },
    ]

    columns.each do |col|
      Column.create!(col.merge(table_id: table_id))
      puts "  Created: #{col[:name]} (#{col[:column_type]})"
    end

    puts ""
    puts "Done! Created #{columns.length} basic columns for #{table.name}"
    puts "Test at: /tables/#{table.slug || table_id}"
  end
end

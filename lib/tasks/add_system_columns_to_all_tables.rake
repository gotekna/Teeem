namespace :teeem do
  namespace :tables do
    desc "Add system columns (id, created_at, updated_at) to ALL system tables"
    task add_system_columns_to_all: :environment do
      # Find all system tables
      system_tables = Table.where(table_type: "system").order(:id)

      puts "Found #{system_tables.count} system tables"
      puts "="*80
      puts ""

      # System columns to add
      system_column_definitions = [
        {
          name: "ID",
          column_name: "id",
          column_type: "whole_number",
          description: "System-generated unique identifier",
          searchable: true,
          is_unique: true,
          required: true,
          position: 0  # First column
        },
        {
          name: "Created At",
          column_name: "created_at",
          column_type: "date_and_time",
          description: "Timestamp when record was created",
          searchable: false,
          required: true,
          position: 998  # Near the end
        },
        {
          name: "Updated At",
          column_name: "updated_at",
          column_type: "date_and_time",
          description: "Timestamp when record was last modified",
          searchable: false,
          required: true,
          position: 999  # Last column
        }
      ]

      total_added = 0
      total_skipped = 0
      tables_updated = 0

      system_tables.each do |table|
        puts "Processing: #{table.name} (ID: #{table.id})"
        puts "  Current columns: #{table.columns.count}"

        added = 0
        skipped = 0

        system_column_definitions.each do |col_data|
          # Check if column already exists
          existing = table.columns.find_by(column_name: col_data[:column_name])

          if existing
            skipped += 1
            next
          end

          # Create the column
          begin
            column = table.columns.create!(col_data)
            added += 1
            puts "  ✓ Added: #{col_data[:name]}"
          rescue => e
            puts "  ✗ Error adding #{col_data[:name]}: #{e.message}"
          end
        end

        if added > 0
          # Reorder all columns by position
          table.columns.order(:position).each_with_index do |col, index|
            col.update_column(:position, index + 1)
          end
          tables_updated += 1
        end

        total_added += added
        total_skipped += skipped

        puts "  Result: #{added} added, #{skipped} skipped"
        puts "  Total columns now: #{table.columns.count}"
        puts ""
      end

      puts "="*80
      puts "SUMMARY:"
      puts "  Tables processed: #{system_tables.count}"
      puts "  Tables updated: #{tables_updated}"
      puts "  Total columns added: #{total_added}"
      puts "  Total columns skipped: #{total_skipped}"
      puts "="*80
      puts ""
      puts "Done! System columns have been added to all system tables."
    end
  end
end

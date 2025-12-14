namespace :teeem do
  namespace :gold_standard do
    desc "Add system columns (id, created_at, updated_at) to Gold Standard table"
    task add_system_columns: :environment do
      # Find the Gold Standard Reference foundation (ID: 1)
      foundation = Foundation.find_by(id: 1)

      unless foundation
        puts "Error: Gold Standard Reference foundation not found!"
        exit 1
      end

      puts "Adding system columns to: #{foundation.name} (ID: #{foundation.id})"
      puts "Current columns: #{foundation.columns.count}"

      # System columns to add
      system_columns = [
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
          position: 999  # Near the end
        },
        {
          name: "Updated At",
          column_name: "updated_at",
          column_type: "date_and_time",
          description: "Timestamp when record was last modified",
          searchable: false,
          required: true,
          position: 1000  # Last column
        }
      ]

      added = 0
      skipped = 0

      system_columns.each do |col_data|
        # Check if column already exists
        existing = foundation.columns.find_by(column_name: col_data[:column_name])

        if existing
          puts "  Skipped: #{col_data[:name]} (already exists)"
          skipped += 1
          next
        end

        # Create the column
        column = foundation.columns.create!(col_data)
        puts "  Added: #{col_data[:name]} (column_name: #{col_data[:column_name]})"
        added += 1
      rescue => e
        puts "  Error adding #{col_data[:name]}: #{e.message}"
      end

      # Reorder all columns by position
      foundation.columns.order(:position).each_with_index do |col, index|
        col.update_column(:position, index + 1)
      end

      puts "\nSummary:"
      puts "  Added: #{added}"
      puts "  Skipped: #{skipped}"
      puts "  Total columns now: #{foundation.columns.count}"
      puts "\nDone! System columns have been added to the Gold Standard table."
    end
  end
end

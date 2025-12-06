class AddMissingColumnTypesToGoldStandard < ActiveRecord::Migration[7.0]
  def up
    # Find the Gold Standard table (ID 166 based on previous queries)
    gold_standard = Table.find_by(id: 166)
    return unless gold_standard

    # Add missing column types in order
    missing_columns = [
      {
        name: 'URL',
        column_name: 'url',
        column_type: 'url',
        description: 'Web URL field',
        position: gold_standard.columns.maximum(:position).to_i + 1
      },
      {
        name: 'Date',
        column_name: 'date',
        column_type: 'date',
        description: 'Date field (no time)',
        position: gold_standard.columns.maximum(:position).to_i + 2
      },
      {
        name: 'Date and Time',
        column_name: 'date_and_time',
        column_type: 'date_and_time',
        description: 'Date with time field',
        position: gold_standard.columns.maximum(:position).to_i + 3
      },
      {
        name: 'Whole Number',
        column_name: 'whole_number',
        column_type: 'whole_number',
        description: 'Integer field',
        position: gold_standard.columns.maximum(:position).to_i + 4
      },
      {
        name: 'Lookup',
        column_name: 'lookup',
        column_type: 'lookup',
        description: 'Link to another record',
        lookup_table_id: gold_standard.id, # Self-reference for demo
        lookup_display_column: 'single_line_text',
        position: gold_standard.columns.maximum(:position).to_i + 5
      },
      {
        name: 'User',
        column_name: 'user',
        column_type: 'user',
        description: 'User field',
        position: gold_standard.columns.maximum(:position).to_i + 6
      },
      {
        name: 'Computed',
        column_name: 'computed',
        column_type: 'computed',
        description: 'Computed/formula field',
        settings: { formula: 'CONCAT([single_line_text], " - ", [email])' }.to_json,
        position: gold_standard.columns.maximum(:position).to_i + 7
      }
    ]

    missing_columns.each do |col_attrs|
      # Check if column already exists
      existing = gold_standard.columns.find_by(column_name: col_attrs[:column_name])
      unless existing
        gold_standard.columns.create!(col_attrs)
        puts "✓ Created column: #{col_attrs[:name]}"
      else
        puts "- Column already exists: #{col_attrs[:name]}"
      end
    end

    # Rebuild the database table to include new columns
    table_reloaded = Table.includes(:columns).find(gold_standard.id)
    builder = TableBuilder.new(table_reloaded)
    result = builder.create_database_table

    if result[:success]
      puts "✓ Gold Standard table rebuilt successfully"
      # Reload dynamic model
      table_reloaded.reload_dynamic_model
    else
      puts "✗ Failed to rebuild table: #{result[:errors].inspect}"
    end
  end

  def down
    gold_standard = Table.find_by(id: 166)
    return unless gold_standard

    # Remove the columns we added
    column_names = [ 'url', 'date', 'date_and_time', 'whole_number', 'lookup', 'user', 'computed' ]
    gold_standard.columns.where(column_name: column_names).destroy_all

    # Rebuild the table without these columns
    table_reloaded = Table.includes(:columns).find(gold_standard.id)
    builder = TableBuilder.new(table_reloaded)
    builder.create_database_table
  end
end

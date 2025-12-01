class AddNewColumnTypesToGoldStandardColumns < ActiveRecord::Migration[8.0]
  def up
    # Find the Gold Standard foundation
    gold_standard = Foundation.find_by(database_table_name: 'gold_standard_table')
    return unless gold_standard

    # Add column definitions for the 3 new advanced types
    new_columns = [
      {
        name: 'Structured Data',
        column_name: 'structured_data',
        column_type: 'structured_data',
        foundation_id: gold_standard.id
      },
      {
        name: 'Array of Items',
        column_name: 'array_of_items',
        column_type: 'array_of_items',
        foundation_id: gold_standard.id
      },
      {
        name: 'Searchable Text',
        column_name: 'searchable_text',
        column_type: 'searchable_text',
        foundation_id: gold_standard.id
      }
    ]

    new_columns.each do |col_attrs|
      # Only create if it doesn't already exist
      unless Column.exists?(foundation_id: gold_standard.id, column_name: col_attrs[:column_name])
        Column.create!(col_attrs)
        puts "  Created column definition: #{col_attrs[:column_name]}"
      end
    end
  end

  def down
    gold_standard = Foundation.find_by(database_table_name: 'gold_standard_table')
    return unless gold_standard

    %w[structured_data array_of_items searchable_text].each do |col_name|
      Column.where(foundation_id: gold_standard.id, column_name: col_name).destroy_all
    end
  end
end

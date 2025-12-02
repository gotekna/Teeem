class FixGoldStandardColumnTypeValues < ActiveRecord::Migration[8.0]
  def up
    # Fix Gold Standard column definitions to use correct column_type values
    # These were incorrectly set to generic types instead of their specific types
    gold_standard = Foundation.find_by(database_table_name: 'gold_standard_table')
    return unless gold_standard

    fixes = {
      'action_buttons' => 'action_buttons',
      'number' => 'number',
      'percentage' => 'percentage',
      'color_picker' => 'color_picker',
      'gps_coordinates' => 'gps_coordinates',
      'file_upload' => 'file_upload'
    }

    fixes.each do |col_name, correct_type|
      col = Column.find_by(foundation_id: gold_standard.id, column_name: col_name)
      if col && col.column_type != correct_type
        old_type = col.column_type
        col.update!(column_type: correct_type)
        puts "  Fixed #{col_name}: #{old_type} => #{correct_type}"
      end
    end
  end

  def down
    # Revert to original (incorrect) types
    gold_standard = Foundation.find_by(database_table_name: 'gold_standard_table')
    return unless gold_standard

    reverts = {
      'action_buttons' => 'single_line_text',
      'number' => 'currency',
      'percentage' => 'currency',
      'color_picker' => 'single_line_text',
      'gps_coordinates' => 'single_line_text',
      'file_upload' => 'multiple_lines_text'
    }

    reverts.each do |col_name, old_type|
      col = Column.find_by(foundation_id: gold_standard.id, column_name: col_name)
      col&.update!(column_type: old_type)
    end
  end
end

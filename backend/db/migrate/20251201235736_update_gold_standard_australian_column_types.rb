class UpdateGoldStandardAustralianColumnTypes < ActiveRecord::Migration[8.0]
  def up
    # Add postcode and tfn columns to gold_standard_table
    add_column :gold_standard_table, :postcode, :string, limit: 4
    add_column :gold_standard_table, :tfn, :string, limit: 11

    # Find Gold Standard foundation and update column types
    gold_standard = Foundation.find_by(database_table_name: 'gold_standard_table')
    return unless gold_standard

    # Update existing columns to use new Australian types
    type_updates = {
      'abn' => 'abn',
      'acn' => 'acn',
      'bsb' => 'bsb',
      'bank_account' => 'bank_account'
    }

    type_updates.each do |column_name, new_type|
      col = Column.find_by(foundation_id: gold_standard.id, column_name: column_name)
      if col
        col.update!(column_type: new_type)
        puts "  Updated #{column_name} to type: #{new_type}"
      end
    end

    # Add new column definitions for postcode and tfn
    new_columns = [
      { name: 'Postcode', column_name: 'postcode', column_type: 'postcode' },
      { name: 'TFN', column_name: 'tfn', column_type: 'tfn' }
    ]

    new_columns.each do |col_attrs|
      unless Column.exists?(foundation_id: gold_standard.id, column_name: col_attrs[:column_name])
        Column.create!(col_attrs.merge(foundation_id: gold_standard.id))
        puts "  Created column definition: #{col_attrs[:column_name]}"
      end
    end
  end

  def down
    remove_column :gold_standard_table, :postcode, if_exists: true
    remove_column :gold_standard_table, :tfn, if_exists: true

    gold_standard = Foundation.find_by(database_table_name: 'gold_standard_table')
    return unless gold_standard

    # Revert Australian types back to single_line_text
    %w[abn acn bsb bank_account].each do |col_name|
      col = Column.find_by(foundation_id: gold_standard.id, column_name: col_name)
      col&.update!(column_type: 'single_line_text')
    end

    # Remove postcode and tfn column definitions
    %w[postcode tfn].each do |col_name|
      Column.where(foundation_id: gold_standard.id, column_name: col_name).destroy_all
    end
  end
end

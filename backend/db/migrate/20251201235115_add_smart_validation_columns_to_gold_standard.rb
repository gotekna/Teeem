class AddSmartValidationColumnsToGoldStandard < ActiveRecord::Migration[8.0]
  def up
    # Add columns to gold_standard_table for smart validation examples
    # These demonstrate how column names trigger automatic validation

    # ABN - Australian Business Number (11 digits: XX XXX XXX XXX)
    add_column :gold_standard_table, :abn, :string, limit: 14

    # ACN - Australian Company Number (9 digits: XXX XXX XXX)
    add_column :gold_standard_table, :acn, :string, limit: 11

    # BSB - Bank State Branch (6 digits: XXX-XXX)
    add_column :gold_standard_table, :bsb, :string, limit: 7

    # Bank Account Number (1-9 digits)
    add_column :gold_standard_table, :bank_account, :string, limit: 9

    # Add column definitions to columns table
    gold_standard = Foundation.find_by(database_table_name: 'gold_standard_table')
    return unless gold_standard

    smart_columns = [
      { name: 'ABN', column_name: 'abn', column_type: 'single_line_text' },
      { name: 'ACN', column_name: 'acn', column_type: 'single_line_text' },
      { name: 'BSB', column_name: 'bsb', column_type: 'single_line_text' },
      { name: 'Bank Account', column_name: 'bank_account', column_type: 'single_line_text' }
    ]

    smart_columns.each do |col_attrs|
      unless Column.exists?(foundation_id: gold_standard.id, column_name: col_attrs[:column_name])
        Column.create!(col_attrs.merge(foundation_id: gold_standard.id))
        puts "  Created column definition: #{col_attrs[:column_name]}"
      end
    end
  end

  def down
    remove_column :gold_standard_table, :abn, if_exists: true
    remove_column :gold_standard_table, :acn, if_exists: true
    remove_column :gold_standard_table, :bsb, if_exists: true
    remove_column :gold_standard_table, :bank_account, if_exists: true

    gold_standard = Foundation.find_by(database_table_name: 'gold_standard_table')
    return unless gold_standard

    %w[abn acn bsb bank_account].each do |col_name|
      Column.where(foundation_id: gold_standard.id, column_name: col_name).destroy_all
    end
  end
end

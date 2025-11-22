class CompleteGoldStandardTableWithAllColumnTypes < ActiveRecord::Migration[8.0]
  def change
    # Add missing columns to make Gold Standard table complete with all 22 column types
    # Use unless_exists to avoid duplicate column errors

    # single_line_text
    add_column :gold_standard_items, :item_code, :string unless column_exists?(:gold_standard_items, :item_code)

    # multiple_lines_text
    add_column :gold_standard_items, :notes, :text unless column_exists?(:gold_standard_items, :notes)

    # date
    add_column :gold_standard_items, :start_date, :date unless column_exists?(:gold_standard_items, :start_date)

    # gps_coordinates
    add_column :gold_standard_items, :location_coords, :string unless column_exists?(:gold_standard_items, :location_coords)

    # color_picker
    add_column :gold_standard_items, :color_code, :string unless column_exists?(:gold_standard_items, :color_code)

    # file_upload
    add_column :gold_standard_items, :file_attachment, :string unless column_exists?(:gold_standard_items, :file_attachment)

    # multiple_lookups
    add_column :gold_standard_items, :multi_tags, :text unless column_exists?(:gold_standard_items, :multi_tags)

    # user
    add_column :gold_standard_items, :assigned_user_id, :integer unless column_exists?(:gold_standard_items, :assigned_user_id)

    # computed (virtual column - stores computed result for display)
    add_column :gold_standard_items, :total_cost, :decimal, precision: 10, scale: 2 unless column_exists?(:gold_standard_items, :total_cost)
  end
end

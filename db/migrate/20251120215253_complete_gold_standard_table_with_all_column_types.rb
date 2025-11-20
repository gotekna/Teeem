class CompleteGoldStandardTableWithAllColumnTypes < ActiveRecord::Migration[8.0]
  def change
    # Add missing columns to make Gold Standard table complete with all 22 column types

    # single_line_text
    add_column :gold_standard_items, :item_code, :string

    # multiple_lines_text
    add_column :gold_standard_items, :notes, :text

    # date
    add_column :gold_standard_items, :start_date, :date

    # gps_coordinates
    add_column :gold_standard_items, :location_coords, :string

    # color_picker
    add_column :gold_standard_items, :color_code, :string

    # file_upload
    add_column :gold_standard_items, :file_attachment, :string

    # multiple_lookups
    add_column :gold_standard_items, :multi_tags, :text

    # user
    add_column :gold_standard_items, :assigned_user_id, :integer

    # computed (virtual column - stores computed result for display)
    add_column :gold_standard_items, :total_cost, :decimal, precision: 10, scale: 2
  end
end

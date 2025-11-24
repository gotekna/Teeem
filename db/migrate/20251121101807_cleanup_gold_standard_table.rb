class CleanupGoldStandardTable < ActiveRecord::Migration[8.0]
  def up
    # Remove old demo columns from gold_standard_items table
    # Keep only the columns that match the CSV gold standard

    columns_to_remove = [
      :is_active,
      :discount,
      :price,
      :quantity,
      :status,
      :category_type,
      :document_link,
      :item_code,
      :notes,
      :start_date,
      :location_coords,
      :color_code,
      :file_attachment,
      :multi_tags,
      :assigned_user_id,
      :total_cost
    ]

    columns_to_remove.each do |column|
      if column_exists?(:gold_standard_items, column)
        say "Removing column: #{column}"
        remove_column :gold_standard_items, column
      end
    end

    # Now add the correct columns from CSV in the proper order
    # Reference: gold_standard_columns.csv

    add_column :gold_standard_items, :single_line_text, :string, limit: 255 unless column_exists?(:gold_standard_items, :single_line_text)
    add_column :gold_standard_items, :multiple_lines_text, :text unless column_exists?(:gold_standard_items, :multiple_lines_text)
    # email already exists
    # phone already exists
    # mobile already exists
    add_column :gold_standard_items, :url, :string, limit: 500 unless column_exists?(:gold_standard_items, :url)
    add_column :gold_standard_items, :number, :integer unless column_exists?(:gold_standard_items, :number)
    # whole_number already exists
    add_column :gold_standard_items, :currency, :decimal, precision: 10, scale: 2 unless column_exists?(:gold_standard_items, :currency)
    add_column :gold_standard_items, :percentage, :decimal, precision: 5, scale: 2 unless column_exists?(:gold_standard_items, :percentage)
    add_column :gold_standard_items, :date, :date unless column_exists?(:gold_standard_items, :date)
    add_column :gold_standard_items, :date_and_time, :timestamp unless column_exists?(:gold_standard_items, :date_and_time)
    add_column :gold_standard_items, :gps_coordinates, :string, limit: 100 unless column_exists?(:gold_standard_items, :gps_coordinates)
    add_column :gold_standard_items, :color_picker, :string, limit: 7 unless column_exists?(:gold_standard_items, :color_picker)
    add_column :gold_standard_items, :file_upload, :text unless column_exists?(:gold_standard_items, :file_upload)
    # action_buttons already exists
    add_column :gold_standard_items, :boolean, :boolean unless column_exists?(:gold_standard_items, :boolean)
    add_column :gold_standard_items, :choice, :string, limit: 50 unless column_exists?(:gold_standard_items, :choice)
    add_column :gold_standard_items, :lookup, :string, limit: 255 unless column_exists?(:gold_standard_items, :lookup)
    add_column :gold_standard_items, :multiple_lookups, :text unless column_exists?(:gold_standard_items, :multiple_lookups)
    add_column :gold_standard_items, :user, :integer unless column_exists?(:gold_standard_items, :user)
    add_column :gold_standard_items, :computed, :string, limit: 255 unless column_exists?(:gold_standard_items, :computed)

    say "✅ Gold Standard table schema updated to match CSV"
  end

  def down
    # This migration is not reversible as we're deleting demo data
    say "Warning: This migration removes demo columns and cannot be reversed"
  end
end

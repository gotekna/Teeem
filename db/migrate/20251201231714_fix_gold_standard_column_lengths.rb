class FixGoldStandardColumnLengths < ActiveRecord::Migration[8.0]
  def up
    # Fix Gold Standard table columns to match Trinity T19.xxx specification
    # Bible Rule #19.37: Trinity T19.001-T19.021 = Single Source of Truth for Column Types

    # email: should be VARCHAR(255) per spec
    change_column :gold_standard_table, :email, :string, limit: 255

    # action_buttons: should be VARCHAR(255) per spec
    change_column :gold_standard_table, :action_buttons, :string, limit: 255

    # gps_coordinates: should be VARCHAR(255) per spec (was 100)
    change_column :gold_standard_table, :gps_coordinates, :string, limit: 255

    # color_picker: should be VARCHAR(255) per spec (was 7)
    # Note: Expanding from 7 to 255 is safe - allows for more color formats
    change_column :gold_standard_table, :color_picker, :string, limit: 255

    # percentage: should be NUMERIC(10,2) per spec (was 5,2)
    change_column :gold_standard_table, :percentage, :decimal, precision: 10, scale: 2
  end

  def down
    # Revert to original sizes (though this may truncate data)
    change_column :gold_standard_table, :email, :string
    change_column :gold_standard_table, :action_buttons, :string
    change_column :gold_standard_table, :gps_coordinates, :string, limit: 100
    change_column :gold_standard_table, :color_picker, :string, limit: 7
    change_column :gold_standard_table, :percentage, :decimal, precision: 5, scale: 2
  end
end

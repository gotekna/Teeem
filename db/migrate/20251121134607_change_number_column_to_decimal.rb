class ChangeNumberColumnToDecimal < ActiveRecord::Migration[8.0]
  def up
    # Change number column from integer to decimal to support decimal values
    change_column :gold_standard_items, :number, :decimal, precision: 10, scale: 2
  end

  def down
    # Revert back to integer (will lose decimal precision)
    change_column :gold_standard_items, :number, :integer
  end
end

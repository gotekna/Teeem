class RenameGoldStandardItemsToGoldStandardTable < ActiveRecord::Migration[8.0]
  def change
    rename_table :gold_standard_items, :gold_standard_table
  end
end

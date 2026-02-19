class ChangePriceHistoryLgaToArray < ActiveRecord::Migration[7.1]
  def up
    # Convert single string LGA to text array
    # Existing values become single-element arrays; NULLs become empty arrays
    change_column :price_histories, :lga, :text, array: true, default: [], using: "CASE WHEN lga IS NOT NULL THEN ARRAY[lga]::text[] ELSE '{}'::text[] END"
  end

  def down
    # Convert back: take the first element of the array
    change_column :price_histories, :lga, :string, using: "lga[1]"
  end
end

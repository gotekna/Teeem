class AddColourToPricebook < ActiveRecord::Migration[8.0]
  def change
    add_column :pricebook, :colour, :string
    add_column :pricebook, :colour_code, :string
    add_column :pricebook, :colour_brand, :string
    add_index :pricebook, :colour
  end
end

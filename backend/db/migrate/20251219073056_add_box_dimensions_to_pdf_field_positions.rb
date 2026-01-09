class AddBoxDimensionsToPdfFieldPositions < ActiveRecord::Migration[8.0]
  def change
    add_column :pdf_field_positions, :box_width, :integer
    add_column :pdf_field_positions, :box_height, :integer
  end
end

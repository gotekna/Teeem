class AddTextAlignToPdfFieldPositions < ActiveRecord::Migration[8.0]
  def change
    add_column :pdf_field_positions, :text_align, :string
  end
end

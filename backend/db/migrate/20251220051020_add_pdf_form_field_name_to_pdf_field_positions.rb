class AddPdfFormFieldNameToPdfFieldPositions < ActiveRecord::Migration[8.0]
  def change
    add_column :pdf_field_positions, :pdf_form_field_name, :string
  end
end

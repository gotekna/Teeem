class RenameDocumentTypeColumns < ActiveRecord::Migration[7.0]
  def change
    rename_column :document_types, :naming_format, :file_name
  end
end

class AddNamingFormatToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :document_types, :naming_format, :string
    add_column :document_types, :abbreviation, :string
  end
end

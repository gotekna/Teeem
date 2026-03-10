class AddUpdatesCorporateKeyToDocumentTypes < ActiveRecord::Migration[7.2]
  def change
    add_column :document_types, :updates_corporate_key, :boolean, default: false, null: false
  end
end

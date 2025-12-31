class AddSkipRenameToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :document_types, :skip_rename, :boolean
  end
end

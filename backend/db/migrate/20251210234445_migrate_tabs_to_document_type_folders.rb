class MigrateTabsToDocumentTypeFolders < ActiveRecord::Migration[8.0]
  def up
    # Migrate existing tabs JSONB array data to the new join table
    DocumentType.find_each do |doc_type|
      tabs = doc_type.tabs || []
      primary_tab = doc_type.primary_tab

      tabs.each do |tab_name|
        # Find the folder by name
        folder = DocumentFolder.find_by(name: tab_name)
        next unless folder

        # Check if assignment already exists
        unless DocumentTypeFolder.exists?(document_type_id: doc_type.id, document_folder_id: folder.id)
          DocumentTypeFolder.create!(
            document_type_id: doc_type.id,
            document_folder_id: folder.id,
            is_primary: (tab_name == primary_tab)
          )
        end
      end
    end
  end

  def down
    # Migrate back from join table to JSONB (if needed)
    DocumentType.find_each do |doc_type|
      folder_names = doc_type.folders.pluck(:name)
      primary_folder = doc_type.document_type_folders.find_by(is_primary: true)&.document_folder

      doc_type.update_columns(
        tabs: folder_names,
        primary_tab: primary_folder&.name
      )
    end

    # Clear the join table
    DocumentTypeFolder.delete_all
  end
end

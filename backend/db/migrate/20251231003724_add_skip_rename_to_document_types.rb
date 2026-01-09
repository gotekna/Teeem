class AddSkipRenameToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :document_types, :skip_rename, :boolean, default: false, null: false

    # Set skip_rename=true for CAD/BIM file types that shouldn't be renamed
    # Also add file extensions for Datasmith
    reversible do |dir|
      dir.up do
        # Revit, AutoCAD, Datasmith types - keep original filenames
        execute <<-SQL
          UPDATE document_types
          SET skip_rename = true
          WHERE name IN (
            'Revit Project',
            'Revit Family',
            'AutoCAD Drawing',
            'Datasmith Export'
          )
        SQL

        # Add Datasmith file extensions
        execute <<-SQL
          UPDATE document_types
          SET file_extensions = ARRAY['.udatasmith']::text[]
          WHERE name = 'Datasmith Export'
        SQL
      end
    end
  end
end

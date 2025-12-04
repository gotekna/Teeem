class AddScopeToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    # Scope: 'company' (existing corporate docs), 'job' (new job docs), or 'both'
    add_column :document_types, :scope, :string, default: 'company'

    # File extensions for auto-detection (e.g., [".rvt", ".rfa"])
    add_column :document_types, :file_extensions, :string, array: true, default: []

    # Target folder path in SharePoint for job documents (e.g., "01 REVIT")
    add_column :document_types, :target_folder, :string

    add_index :document_types, :scope
    add_index :document_types, :file_extensions, using: :gin
  end
end

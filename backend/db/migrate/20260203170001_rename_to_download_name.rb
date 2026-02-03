# frozen_string_literal: true

# Standardize download name column across models:
# - warehouse_documents.send_name → download_name
# - document_types.file_name → download_name
# - warehouse_folders.download_name stays as is (already correct)
class RenameToDownloadName < ActiveRecord::Migration[8.0]
  def change
    rename_column :warehouse_documents, :send_name, :download_name
    rename_column :document_types, :file_name, :download_name
  end
end

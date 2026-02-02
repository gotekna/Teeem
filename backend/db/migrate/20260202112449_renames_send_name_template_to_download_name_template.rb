# frozen_string_literal: true

# SSoT: Rename send_name_template → download_name for consistency
# UI Label: "Document Download Name"
# Pattern matches: warehouse_folder, display_name, download_name
class RenamesSendNameTemplateToDownloadNameTemplate < ActiveRecord::Migration[8.0]
  def change
    rename_column :warehouse_folders, :send_name_template, :download_name
  end
end

# frozen_string_literal: true

# Migration: Remove unused template columns from base_folders
#
# SSoT (Feb 2026): These columns were never used - UI/DL templates
# are managed at the document type level, not base folder level.
#
class RemoveTemplateColumnsFromBaseFolders < ActiveRecord::Migration[7.2]
  def change
    remove_column :base_folders, :download_name_template, :string
    remove_column :base_folders, :ui_name_template, :string
  end
end

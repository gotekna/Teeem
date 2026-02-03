# frozen_string_literal: true

# Migration to add notebook warehouse folder configuration
# This enables notebook pages to be exported and stored in the File Warehouse
class AddNotebookWarehouseFolder < ActiveRecord::Migration[7.2]
  def up
    # Add notebook warehouse folder configuration
    # Root folder: "Notes"
    # Template: "Notes/{{NotebookName}}/{{Year}}"
    WarehouseFolder.find_or_create_by!(warehouse_type: 'notebook', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = 'Notebook'
      tab.warehouse_enabled = true
      tab.warehouse_folder = 'Notes/{{NotebookName}}/{{Year}}'
      tab.download_name = '{{PageTitle}} - {{NotebookName}}.html'
      tab.ui_name = '{{PageTitle}}'
      tab.root_folder = 'Notes'
    end

    # Sub-folder for notebook exports by year
    WarehouseFolder.find_or_create_by!(warehouse_type: 'notebook', tab_key: 'exports') do |tab|
      tab.display_name = 'Exports'
      tab.tab_group = 'documents'
      tab.order_position = 10
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = 'FileText'
      tab.warehouse_enabled = true
    end

    Rails.logger.info "[Migration] Added notebook warehouse folder configuration"
  end

  def down
    WarehouseFolder.where(warehouse_type: 'notebook').destroy_all
    Rails.logger.info "[Migration] Removed notebook warehouse folder configuration"
  end
end

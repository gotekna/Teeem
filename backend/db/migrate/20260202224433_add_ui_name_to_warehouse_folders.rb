# frozen_string_literal: true

# SSoT: Add ui_name column for "Document UI Name" template per tab
#
# This column stores the template for how documents are displayed in the UI.
# Example: "{{OriginalFileName}}" or "{{CompanyCode}} {{DocTypeName}}"
#
# Completes the per-tab SSoT pattern:
#   - warehouse_folder: Storage path template
#   - download_name: Download filename template
#   - ui_name: UI display name template (NEW)
#
class AddUiNameToWarehouseFolders < ActiveRecord::Migration[8.0]
  def change
    add_column :warehouse_folders, :ui_name, :string
  end
end

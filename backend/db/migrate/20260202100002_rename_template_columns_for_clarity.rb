# frozen_string_literal: true

# Rename template columns in warehouse_providers for clarity
#
# The current naming is confusing:
# - "display_name_templates" sounds like folder names, but it's actually the
#   document UI name template (what users see in File Warehouse)
# - "file_name_templates" is the filename when downloading
#
# New names are clearer:
# - "ui_name_templates" → The document name shown in the UI
# - "download_name_templates" → The filename when downloading
class RenameTemplateColumnsForClarity < ActiveRecord::Migration[8.0]
  def change
    # Rename for clarity: these are TEMPLATES, not actual values
    rename_column :warehouse_providers, :display_name_templates, :ui_name_templates
    rename_column :warehouse_providers, :file_name_templates, :download_name_templates
  end
end

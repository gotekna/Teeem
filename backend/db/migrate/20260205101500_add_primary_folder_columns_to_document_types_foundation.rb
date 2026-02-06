# Add Primary Folder and Show In columns to document_types Foundation
# These are computed columns - the API already returns this data, but
# they need to be in the Foundation for View Manager column visibility.
#
# Columns added:
# - primary_folder: Name of the primary warehouse folder
# - primary_folder_path: Full hierarchy path (e.g., "Corporate > Financial > Tax")
# - show_in_folders: Secondary folders where this doc type also appears
class AddPrimaryFolderColumnsToDocumentTypesFoundation < ActiveRecord::Migration[8.0]
  def up
    foundation = Foundation.find_by(slug: "document_types")
    return unless foundation

    # Get the current max position
    max_position = foundation.columns.maximum(:position) || 0

    # Add primary_folder column (computed from primary_warehouse_folder.display_name)
    # Position after warehouse_type_id
    foundation.columns.find_or_create_by!(column_name: "primary_folder") do |col|
      col.name = "Primary Folder"
      col.column_type = "single_line_text"
      col.position = max_position + 1
      col.required = false
      col.searchable = true
      col.settings = { computed: true, source: "primary_warehouse_folder.display_name" }
    end

    # Add primary_folder_path column (computed from primary_warehouse_folder.hierarchy_path)
    foundation.columns.find_or_create_by!(column_name: "primary_folder_path") do |col|
      col.name = "Primary Folder Path"
      col.column_type = "single_line_text"
      col.position = max_position + 2
      col.required = false
      col.searchable = true
      col.settings = { computed: true, source: "primary_warehouse_folder.hierarchy_path" }
    end

    # Add show_in_folders column (computed from secondary warehouse folders)
    foundation.columns.find_or_create_by!(column_name: "show_in_folders") do |col|
      col.name = "Show In"
      col.column_type = "single_line_text"
      col.position = max_position + 3
      col.required = false
      col.searchable = false
      col.settings = { computed: true, source: "secondary_warehouse_folders" }
    end

    puts "Added primary_folder, primary_folder_path, and show_in_folders columns to document_types Foundation"
  end

  def down
    foundation = Foundation.find_by(slug: "document_types")
    return unless foundation

    foundation.columns.where(column_name: %w[primary_folder primary_folder_path show_in_folders]).destroy_all
    puts "Removed primary_folder, primary_folder_path, and show_in_folders columns from document_types Foundation"
  end
end

# frozen_string_literal: true

# EntityTabFolderRenameService - DB-only virtual folder path updates
#
# Phase 3 Blob Architecture: Files are stored at content-hash paths (Blobs/{hash}/...)
# and NEVER physically move. "Folder" is just a virtual path in WarehouseDocument.folder.
#
# When EntityTab.display_name changes, this service:
# 1. Updates WarehouseDocument.folder (virtual path - instant DB update)
# 2. Updates job_documents.folder_path (legacy field - instant DB update)
# 3. Cascades to child tabs recursively
#
# NO physical file movement - that's the whole point of Phase 3 architecture!
#
# Usage:
#   service = EntityTabFolderRenameService.new(
#     entity_tab: tab,
#     old_display_name: "Supervisor",
#     new_display_name: "Supervisor Photo"
#   )
#   result = service.execute
#   # => { success: true, stats: { documents_updated: 120, warehouse_documents_updated: 45 } }
#
class EntityTabFolderRenameService
  def initialize(entity_tab:, old_display_name:, new_display_name:)
    @entity_tab = entity_tab
    @old_display_name = old_display_name
    @new_display_name = new_display_name
    @stats = { documents_updated: 0, warehouse_documents_updated: 0 }
  end

  def execute
    return error_result("Not a job-scope tab") unless @entity_tab.warehouse_type == 'job'
    return error_result("No storage folder configured") unless @entity_tab.warehouse_enabled

    # Compute old and new folder paths
    @old_path = compute_old_folder_path
    @new_path = @entity_tab.upload_folder_path

    Rails.logger.info "[EntityTabFolderRename] DB-only path update: '#{@old_path}' → '#{@new_path}'"

    # Step 1: Bulk update WarehouseDocument.folder (Phase 3 SSoT)
    update_warehouse_document_folders

    # Step 2: Bulk update job_documents.folder_path (legacy field)
    update_job_document_paths

    # Step 3: Cascade to child tabs
    cascade_to_child_tabs

    Rails.logger.info "[EntityTabFolderRename] Complete: #{@stats.inspect}"
    { success: true, stats: @stats }
  rescue StandardError => e
    Rails.logger.error "[EntityTabFolderRename] Error: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    { success: false, error: e.message, stats: @stats }
  end

  private

  def error_result(message)
    { success: false, error: message, stats: @stats }
  end

  # Compute what the folder path WAS before the rename
  # Logic mirrors EntityTab#upload_folder_path but with old_display_name
  def compute_old_folder_path
    if @entity_tab.parent&.warehouse_enabled
      # Child tab: parent_path + "/" + old_display_name
      parent_path = @entity_tab.parent.upload_folder_path
      "#{parent_path}/#{@old_display_name}"
    else
      # Root tab: just the old display_name
      @old_display_name
    end
  end

  # Phase 3 SSoT: Update WarehouseDocument.folder (virtual paths, instant)
  def update_warehouse_document_folders
    # Update exact matches and nested paths
    affected_count = WarehouseDocument
      .where("folder = ? OR folder LIKE ?", @old_path, "#{@old_path}/%")
      .update_all(
        ["folder = REPLACE(folder, ?, ?)", @old_path, @new_path]
      )

    @stats[:warehouse_documents_updated] = affected_count
    Rails.logger.info "[EntityTabFolderRename] Updated #{affected_count} WarehouseDocument folders"
  end

  # Legacy: Update job_documents.folder_path for backwards compatibility
  def update_job_document_paths
    affected_count = JobDocument
      .where("folder_path = ? OR folder_path LIKE ?", @old_path, "#{@old_path}/%")
      .update_all(
        ["folder_path = REPLACE(folder_path, ?, ?)", @old_path, @new_path]
      )

    @stats[:documents_updated] = affected_count
    Rails.logger.info "[EntityTabFolderRename] Updated #{affected_count} JobDocument folder paths"
  end

  # When a parent tab is renamed, child tabs' computed paths change too
  # Since this is DB-only, we just update the virtual paths
  def cascade_to_child_tabs
    child_tabs = @entity_tab.children.where(warehouse_enabled: true)
    return if child_tabs.empty?

    Rails.logger.info "[EntityTabFolderRename] Cascading to #{child_tabs.count} child tabs"

    child_tabs.each do |child|
      # Old child path = old_parent_path + "/" + child.display_name
      old_child_path = "#{@old_path}/#{child.display_name}"
      # New child path = new_parent_path + "/" + child.display_name
      new_child_path = "#{@new_path}/#{child.display_name}"

      # Update WarehouseDocument.folder for this child's path
      warehouse_affected = WarehouseDocument
        .where("folder = ? OR folder LIKE ?", old_child_path, "#{old_child_path}/%")
        .update_all(
          ["folder = REPLACE(folder, ?, ?)", old_child_path, new_child_path]
        )

      @stats[:warehouse_documents_updated] += warehouse_affected

      # Update job_documents for this child's path (legacy)
      child_affected = JobDocument
        .where("folder_path = ? OR folder_path LIKE ?", old_child_path, "#{old_child_path}/%")
        .update_all(
          ["folder_path = REPLACE(folder_path, ?, ?)", old_child_path, new_child_path]
        )

      @stats[:documents_updated] += child_affected

      # Recurse for grandchildren
      if child.children.where(warehouse_enabled: true).exists?
        cascade_child_documents(child, old_child_path, new_child_path)
      end
    end
  end

  # Recursively update document paths for nested children
  def cascade_child_documents(parent_tab, old_parent_path, new_parent_path)
    parent_tab.children.where(warehouse_enabled: true).each do |child|
      old_child_path = "#{old_parent_path}/#{child.display_name}"
      new_child_path = "#{new_parent_path}/#{child.display_name}"

      # Update WarehouseDocument.folder
      warehouse_affected = WarehouseDocument
        .where("folder = ? OR folder LIKE ?", old_child_path, "#{old_child_path}/%")
        .update_all(
          ["folder = REPLACE(folder, ?, ?)", old_child_path, new_child_path]
        )

      @stats[:warehouse_documents_updated] += warehouse_affected

      # Update job_documents (legacy)
      affected = JobDocument
        .where("folder_path = ? OR folder_path LIKE ?", old_child_path, "#{old_child_path}/%")
        .update_all(
          ["folder_path = REPLACE(folder_path, ?, ?)", old_child_path, new_child_path]
        )

      @stats[:documents_updated] += affected

      # Continue recursion if this child has children
      if child.children.where(warehouse_enabled: true).exists?
        cascade_child_documents(child, old_child_path, new_child_path)
      end
    end
  end
end

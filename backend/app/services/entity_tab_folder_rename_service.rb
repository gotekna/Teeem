# frozen_string_literal: true

# Service to rename SharePoint folders and update job_documents when EntityTab display_name changes
#
# SSoT: EntityTab.display_name is the source of truth for folder paths.
# When it changes, this service syncs:
# 1. SharePoint physical folders (renamed via Graph API)
# 2. job_documents.folder_path (bulk SQL update)
# 3. Child tab paths (cascaded recursively)
#
# Usage:
#   service = EntityTabFolderRenameService.new(
#     entity_tab: tab,
#     old_display_name: "Supervisor",
#     new_display_name: "Supervisor Photo"
#   )
#   result = service.execute
#   # => { success: true, stats: { renamed: 45, skipped: 5, errors: [], documents_updated: 120 } }
#
class EntityTabFolderRenameService
  def initialize(entity_tab:, old_display_name:, new_display_name:)
    @entity_tab = entity_tab
    @old_display_name = old_display_name
    @new_display_name = new_display_name
    @stats = { renamed: 0, skipped: 0, errors: [], documents_updated: 0 }
  end

  def execute
    return error_result("Not a job-scope tab") unless @entity_tab.scope == 'job'
    return error_result("No SharePoint folder configured") unless @entity_tab.has_sharepoint_folder

    # Compute old and new folder paths
    @old_path = compute_old_folder_path
    @new_path = @entity_tab.upload_folder_path

    Rails.logger.info "[EntityTabFolderRename] Path change: '#{@old_path}' → '#{@new_path}'"

    # Get SharePoint credential
    @credential = OrganizationSharePointCredential.active_credential
    return error_result("No SharePoint credential configured") unless @credential

    @client = MicrosoftGraphClient.new(@credential)

    # Step 1: Rename SharePoint folders for all jobs
    rename_sharepoint_folders

    # Step 2: Bulk update job_documents.folder_path
    update_job_document_paths

    # Step 3: Cascade to child tabs (their computed paths include parent path)
    cascade_to_child_tabs

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
    if @entity_tab.parent&.has_sharepoint_folder
      # Child tab: parent_path + "/" + old_display_name
      parent_path = @entity_tab.parent.upload_folder_path
      "#{parent_path}/#{@old_display_name}"
    else
      # Root tab: just the old display_name
      @old_display_name
    end
  end

  # Rename the SharePoint folder for each job that has SharePoint folders
  def rename_sharepoint_folders
    jobs_with_folders = Job.where(sharepoint_folder_status: 'completed')
    total_jobs = jobs_with_folders.count
    Rails.logger.info "[EntityTabFolderRename] Processing #{total_jobs} jobs with SharePoint folders"

    jobs_with_folders.find_each.with_index do |job, index|
      rename_folder_for_job(job)

      # Log progress every 50 jobs
      if (index + 1) % 50 == 0
        Rails.logger.info "[EntityTabFolderRename] Progress: #{index + 1}/#{total_jobs} jobs processed"
      end
    end
  end

  def rename_folder_for_job(job)
    # Find the job's root SharePoint folder
    job_folder = @client.find_job_folder(job)
    unless job_folder
      @stats[:skipped] += 1
      return
    end

    # Navigate to the target folder using old path
    target_folder = find_folder_by_path(job_folder['id'], @old_path)

    if target_folder
      # Rename the folder to just the new display_name (not full path)
      new_folder_name = @new_path.split('/').last
      @client.rename_file(target_folder['id'], new_folder_name)
      @stats[:renamed] += 1
      Rails.logger.debug "[EntityTabFolderRename] Renamed folder in job #{job.id}"
    else
      # Folder doesn't exist (job never had uploads to this tab) - that's ok
      @stats[:skipped] += 1
    end
  rescue MicrosoftGraphClient::APIError => e
    @stats[:errors] << { job_id: job.id, error: e.message }
    Rails.logger.warn "[EntityTabFolderRename] Failed for job #{job.id}: #{e.message}"
  end

  # Navigate to a folder by path (e.g., "Photo/Supervisor")
  def find_folder_by_path(parent_folder_id, path)
    return nil if path.blank?

    path_parts = path.split('/')
    current_folder_id = parent_folder_id

    path_parts.each do |folder_name|
      contents = @client.list_folder_contents(current_folder_id)
      folder = contents.find { |item| item[:is_folder] && item[:name] == folder_name }
      return nil unless folder
      current_folder_id = folder[:id]
    end

    { 'id' => current_folder_id }
  rescue MicrosoftGraphClient::APIError
    nil
  end

  # Bulk update job_documents.folder_path
  # Handles both exact matches and nested paths (e.g., "Photo/Supervisor/SubFolder")
  def update_job_document_paths
    # Use SQL REPLACE to update paths efficiently
    # Match exact path OR paths starting with old_path/
    affected_count = JobDocument
      .where("folder_path = ? OR folder_path LIKE ?", @old_path, "#{@old_path}/%")
      .update_all(
        ["folder_path = REPLACE(folder_path, ?, ?)", @old_path, @new_path]
      )

    @stats[:documents_updated] = affected_count
    Rails.logger.info "[EntityTabFolderRename] Updated #{affected_count} JobDocument folder paths"
  end

  # When a parent tab is renamed, child tabs' computed paths change too
  # The physical child folders don't need renaming (parent folder was renamed)
  # But any job_documents in child folders need path updates
  def cascade_to_child_tabs
    child_tabs = @entity_tab.children.where(has_sharepoint_folder: true)
    return if child_tabs.empty?

    Rails.logger.info "[EntityTabFolderRename] Cascading to #{child_tabs.count} child tabs"

    child_tabs.each do |child|
      # Old child path = old_parent_path + "/" + child.display_name
      old_child_path = "#{@old_path}/#{child.display_name}"
      # New child path = new_parent_path + "/" + child.display_name
      new_child_path = "#{@new_path}/#{child.display_name}"

      # Update job_documents for this child's path
      child_affected = JobDocument
        .where("folder_path = ? OR folder_path LIKE ?", old_child_path, "#{old_child_path}/%")
        .update_all(
          ["folder_path = REPLACE(folder_path, ?, ?)", old_child_path, new_child_path]
        )

      @stats[:documents_updated] += child_affected

      # Recurse for grandchildren
      if child.children.where(has_sharepoint_folder: true).exists?
        cascade_child_documents(child, old_child_path, new_child_path)
      end
    end
  end

  # Recursively update document paths for nested children
  def cascade_child_documents(parent_tab, old_parent_path, new_parent_path)
    parent_tab.children.where(has_sharepoint_folder: true).each do |child|
      old_child_path = "#{old_parent_path}/#{child.display_name}"
      new_child_path = "#{new_parent_path}/#{child.display_name}"

      affected = JobDocument
        .where("folder_path = ? OR folder_path LIKE ?", old_child_path, "#{old_child_path}/%")
        .update_all(
          ["folder_path = REPLACE(folder_path, ?, ?)", old_child_path, new_child_path]
        )

      @stats[:documents_updated] += affected

      # Continue recursion if this child has children
      if child.children.where(has_sharepoint_folder: true).exists?
        cascade_child_documents(child, old_child_path, new_child_path)
      end
    end
  end
end

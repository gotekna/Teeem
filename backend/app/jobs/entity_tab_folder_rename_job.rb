# frozen_string_literal: true

# Background job for syncing SharePoint folder names and job_documents when EntityTab is renamed
#
# SSoT: When EntityTab.display_name changes, this job:
# 1. Renames the corresponding SharePoint folder for ALL jobs
# 2. Updates job_documents.folder_path to match the new path
# 3. Cascades to child tabs (their paths include parent path)
#
# Usage:
#   EntityTabFolderRenameJob.perform_later(
#     entity_tab_id: 123,
#     old_display_name: "Supervisor",
#     new_display_name: "Supervisor Photo"
#   )
#
class EntityTabFolderRenameJob < ApplicationJob
  queue_as :default

  # Retry on Microsoft Graph API errors with exponential backoff
  retry_on MicrosoftGraphClient::APIError, wait: :polynomially_longer, attempts: 5

  def perform(entity_tab_id:, old_display_name:, new_display_name:)
    entity_tab = EntityTab.find_by(id: entity_tab_id)
    unless entity_tab
      Rails.logger.warn "[EntityTabFolderRename] Tab #{entity_tab_id} not found (may have been deleted)"
      return { success: false, error: "Tab not found" }
    end

    Rails.logger.info "[EntityTabFolderRename] Starting rename: '#{old_display_name}' → '#{new_display_name}' for tab #{entity_tab_id}"

    service = EntityTabFolderRenameService.new(
      entity_tab: entity_tab,
      old_display_name: old_display_name,
      new_display_name: new_display_name
    )

    result = service.execute

    if result[:success]
      Rails.logger.info "[EntityTabFolderRename] Complete: #{result[:stats].inspect}"
    else
      Rails.logger.error "[EntityTabFolderRename] Failed: #{result[:error]}"
    end

    result
  end
end

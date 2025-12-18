# frozen_string_literal: true

# =============================================================================
# PlanStagingCleanupJob - Clean up orphaned staging files
# =============================================================================
# This job runs daily to delete staging files that were not cleaned up
# after plan upload completion/failure.
#
# Scheduled via SolidQueue recurring schedule.
#
# =============================================================================
class PlanStagingCleanupJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "[PlanStagingCleanupJob] Starting cleanup..."

    result = PlanUpload.cleanup_stale_staging_files!(max_age: 24.hours)

    Rails.logger.info "[PlanStagingCleanupJob] Cleaned up #{result[:cleaned]} staging files"

    if result[:errors].any?
      Rails.logger.warn "[PlanStagingCleanupJob] Errors during cleanup: #{result[:errors].inspect}"
    end

    # Also clean up the staging folder in SharePoint if it's empty or has old files
    cleanup_sharepoint_staging_folder

    Rails.logger.info "[PlanStagingCleanupJob] Completed"
  end

  private

  def cleanup_sharepoint_staging_folder
    credential = OrganizationSharePointCredential.active_credential
    return unless credential

    client = MicrosoftGraphClient.new(credential)
    staging_folder_name = PlanUpload.staging_folder_name

    begin
      # Find staging folder
      drive_path = credential.drive_id.present? ? "/drives/#{credential.drive_id}" : "/me/drive"
      response = client.get("#{drive_path}/root/children")
      folders = response["value"] || []
      staging_folder = folders.find { |f| f["name"] == staging_folder_name && f["folder"] }

      return unless staging_folder

      # List items in staging folder
      items_response = client.get("#{drive_path}/items/#{staging_folder["id"]}/children")
      items = items_response["value"] || []

      # Delete files older than 24 hours
      cutoff = 24.hours.ago
      deleted = 0

      items.each do |item|
        created_at = Time.parse(item["createdDateTime"]) rescue nil
        next unless created_at && created_at < cutoff

        begin
          client.delete("#{drive_path}/items/#{item["id"]}")
          deleted += 1
        rescue => e
          Rails.logger.warn "[PlanStagingCleanupJob] Failed to delete #{item["name"]}: #{e.message}"
        end
      end

      Rails.logger.info "[PlanStagingCleanupJob] Deleted #{deleted} old files from SharePoint staging folder"

    rescue => e
      Rails.logger.warn "[PlanStagingCleanupJob] Error cleaning SharePoint staging: #{e.message}"
    end
  end
end

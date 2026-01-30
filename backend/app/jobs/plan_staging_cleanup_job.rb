# frozen_string_literal: true

# =============================================================================
# PlanStagingCleanupJob - Clean up orphaned staging files
# =============================================================================
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Cleans up Wasabi, SharePoint, or S3 staging folders              ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# This job runs daily to delete staging files that were not cleaned up
# after plan upload completion/failure.
#
# Scheduled via SolidQueue recurring schedule.
#
# =============================================================================
class PlanStagingCleanupJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  def perform
    Rails.logger.info "[PlanStagingCleanupJob] Starting cleanup..."

    result = PlanUpload.cleanup_stale_staging_files!(max_age: 24.hours)

    Rails.logger.info "[PlanStagingCleanupJob] Cleaned up #{result[:cleaned]} staging files"

    if result[:errors].any?
      Rails.logger.warn "[PlanStagingCleanupJob] Errors during cleanup: #{result[:errors].inspect}"
    end

    # Also clean up the staging folder in storage if it's empty or has old files
    cleanup_storage_staging_folder

    Rails.logger.info "[PlanStagingCleanupJob] Completed"
  end

  private

  def cleanup_storage_staging_folder
    # SSoT: Setup document provider using WarehouseProvider
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.warn "[PlanStagingCleanupJob] No storage provider configured: #{e.message}"
      return
    end

    staging_folder_name = PlanUpload.staging_folder_name
    staging_folder_path = "/#{staging_folder_name}"

    begin
      # Check if staging folder exists
      return unless folder_exists_in_provider?(staging_folder_path)

      # List items in staging folder
      items = list_folder_in_provider(staging_folder_path)

      # Delete files older than 24 hours
      cutoff = 24.hours.ago
      deleted = 0

      items.each do |item|
        next unless item[:type] == :file
        created_at = item[:created_at] || item[:modified_at]
        next unless created_at && created_at < cutoff

        begin
          delete_from_provider(item[:id])
          deleted += 1
        rescue DocumentProviders::Error => e
          Rails.logger.warn "[PlanStagingCleanupJob] Failed to delete #{item[:name]}: #{e.message}"
        end
      end

      Rails.logger.info "[PlanStagingCleanupJob] Deleted #{deleted} old files from staging folder (provider: #{current_provider_type})"

    rescue DocumentProviders::NotFoundError
      Rails.logger.debug "[PlanStagingCleanupJob] Staging folder not found, nothing to clean"
    rescue DocumentProviders::Error => e
      Rails.logger.warn "[PlanStagingCleanupJob] Error cleaning staging folder: #{e.message}"
    end
  end
end

# frozen_string_literal: true

# Clean up temporary files from storage
# Runs daily to remove old TaskResponseZips (7+ days old)
class CleanupTempFilesJob < ApplicationJob
  include DeduplicatableJob
  queue_as :low

  # Keep temp files for 7 days (links expire but users may re-request)
  RETENTION_DAYS = 7

  # ⚠️ FRC (Feb 2026): Must iterate over tenants
  # Root cause: Organization.first without tenant context returns the first org
  # in the database (wrong tenant). Each tenant has its own storage provider.
  def perform
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        cleanup_response_zips_for_tenant
      end
    end
  end

  private

  def cleanup_response_zips_for_tenant
    org = Organization.first
    return unless org

    provider = DocumentProviders.for_organization(org)
    return unless provider

    folder_path = "Temp/TaskResponseZips"
    cutoff_time = RETENTION_DAYS.days.ago

    files = provider.list_folder(folder_path) rescue []
    return if files.empty?

    deleted = 0

    files.each do |file|
      next unless file[:name]&.end_with?(".zip")

      # Parse timestamp from filename: YYYYMMDD_HHMMSS_name.zip
      if file[:name] =~ /^(\d{8})_(\d{6})_/
        date_str = $1
        time_str = $2
        file_time = Time.zone.parse("#{date_str} #{time_str}") rescue nil

        if file_time && file_time < cutoff_time
          begin
            provider.delete_file(file[:id] || "#{folder_path}/#{file[:name]}")
            deleted += 1
          rescue => e
            Rails.logger.warn "[CleanupTempFilesJob] Failed to delete #{file[:name]}: #{e.message}"
          end
        end
      end
    end

    Rails.logger.info "[CleanupTempFilesJob] #{ActsAsTenant.current_tenant.name}: Deleted #{deleted} old TaskResponseZips"
  rescue DocumentProviders::NotConnectedError => e
    Rails.logger.warn "[CleanupTempFilesJob] Storage not connected: #{e.message}"
  rescue => e
    Rails.logger.error "[CleanupTempFilesJob] Error: #{e.message}"
  end
end

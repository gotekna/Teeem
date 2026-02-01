# frozen_string_literal: true

# Clean up temporary files from storage
# Runs daily to remove old TaskResponseZips (7+ days old)
class CleanupTempFilesJob < ApplicationJob
  queue_as :low

  # Keep temp files for 7 days (links expire but users may re-request)
  RETENTION_DAYS = 7

  def perform
    cleanup_response_zips
  end

  private

  def cleanup_response_zips
    provider = DocumentProviders.for_organization(Organization.first)
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

    Rails.logger.info "[CleanupTempFilesJob] Deleted #{deleted} old TaskResponseZips"
  rescue DocumentProviders::NotConnectedError => e
    Rails.logger.warn "[CleanupTempFilesJob] Storage not connected: #{e.message}"
  rescue => e
    Rails.logger.error "[CleanupTempFilesJob] Error: #{e.message}"
  end
end

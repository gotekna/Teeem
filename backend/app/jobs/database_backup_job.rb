# frozen_string_literal: true

# DatabaseBackupJob - Weekly database backup to Backblaze B2
#
# Downloads the latest Heroku backup and uploads it to the backup storage bucket.
# Run weekly via Heroku Scheduler: rails runner "DatabaseBackupJob.perform_now"
#
# Configuration required:
#   HEROKU_API_KEY: Heroku API key for backup access
#   BACKUP_S3_*: Backblaze B2 credentials (see BackupStorageService)
#
# The job:
#   1. Gets the latest backup URL from Heroku
#   2. Downloads the backup
#   3. Uploads to Backblaze B2 with timestamp
#   4. Cleans up old backups (keeps last 12 = ~3 months)
#
class DatabaseBackupJob < ApplicationJob
  queue_as :low

  # Number of weekly backups to keep (12 = ~3 months)
  BACKUPS_TO_KEEP = 12

  # Heroku app name for production database
  HEROKU_APP = "teeem-production"

  def perform
    Rails.logger.info "[DatabaseBackup] Starting weekly database backup"

    unless BackupStorageService.configured?
      Rails.logger.warn "[DatabaseBackup] Skipped - backup storage not configured"
      return
    end

    unless heroku_api_key.present?
      Rails.logger.warn "[DatabaseBackup] Skipped - HEROKU_API_KEY not set"
      return
    end

    # Get latest backup URL from Heroku
    backup_url = fetch_heroku_backup_url
    unless backup_url
      Rails.logger.error "[DatabaseBackup] Failed to get Heroku backup URL"
      return
    end

    # Upload to backup storage
    filename = "db-backup-#{Date.current.strftime('%Y%m%d')}.dump"
    key = "database/#{filename}"

    result = BackupStorageService.upload_from_url(
      key: key,
      url: backup_url,
      metadata: {
        source: "heroku",
        app: HEROKU_APP,
        backup_date: Date.current.iso8601,
        backed_up_at: Time.current.iso8601
      }
    )

    Rails.logger.info "[DatabaseBackup] Uploaded: #{key} (#{result[:size]} bytes)"

    # Cleanup old backups
    deleted = BackupStorageService.cleanup_old_backups("database/", keep: BACKUPS_TO_KEEP)
    Rails.logger.info "[DatabaseBackup] Cleanup: deleted #{deleted} old backups" if deleted > 0

    Rails.logger.info "[DatabaseBackup] Complete"
  end

  private

  def heroku_api_key
    ENV["HEROKU_API_KEY"]
  end

  def fetch_heroku_backup_url
    require "net/http"
    require "uri"

    # Step 1: List backups to get the latest one
    list_uri = URI.parse("https://api.heroku.com/apps/#{HEROKU_APP}/transfers")
    list_request = Net::HTTP::Get.new(list_uri)
    list_request["Accept"] = "application/vnd.heroku+json; version=3"
    list_request["Authorization"] = "Bearer #{heroku_api_key}"

    list_response = Net::HTTP.start(list_uri.hostname, list_uri.port, use_ssl: true) do |http|
      http.request(list_request)
    end

    unless list_response.code == "200"
      Rails.logger.error "[DatabaseBackup] Failed to list backups: #{list_response.code} - #{list_response.body}"
      return nil
    end

    transfers = JSON.parse(list_response.body)
    # Find the latest completed backup (not a restore)
    latest_backup = transfers
      .select { |t| t["succeeded"] && t["to_type"] == "gof3r" }
      .max_by { |t| Time.parse(t["finished_at"]) rescue Time.at(0) }

    unless latest_backup
      Rails.logger.error "[DatabaseBackup] No completed backups found"
      return nil
    end

    backup_num = latest_backup["num"]
    Rails.logger.info "[DatabaseBackup] Found backup ##{backup_num} from #{latest_backup['finished_at']}"

    # Step 2: Get the public URL for this backup
    url_uri = URI.parse("https://api.heroku.com/apps/#{HEROKU_APP}/transfers/#{latest_backup['id']}/actions/public-url")
    url_request = Net::HTTP::Post.new(url_uri)
    url_request["Accept"] = "application/vnd.heroku+json; version=3"
    url_request["Authorization"] = "Bearer #{heroku_api_key}"

    url_response = Net::HTTP.start(url_uri.hostname, url_uri.port, use_ssl: true) do |http|
      http.request(url_request)
    end

    if url_response.code == "200" || url_response.code == "201"
      JSON.parse(url_response.body)["url"]
    else
      Rails.logger.error "[DatabaseBackup] Failed to get backup URL: #{url_response.code} - #{url_response.body}"
      nil
    end
  rescue => e
    Rails.logger.error "[DatabaseBackup] Failed to fetch backup URL: #{e.message}"
    nil
  end
end

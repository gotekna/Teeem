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

    # Heroku pg-backups uses a separate API (pg-api.heroku.com)
    # First get the database attachment name from the app
    attachment_name = fetch_database_attachment
    return nil unless attachment_name

    # Step 1: List backups using the pg-api
    list_uri = URI.parse("https://pg-api.heroku.com/client/v11/databases/#{attachment_name}/transfers")
    list_request = Net::HTTP::Get.new(list_uri)
    list_request["Accept"] = "application/json"
    list_request["Authorization"] = "Bearer #{heroku_api_key}"

    list_response = Net::HTTP.start(list_uri.hostname, list_uri.port, use_ssl: true) do |http|
      http.request(list_request)
    end

    unless list_response.code == "200"
      Rails.logger.error "[DatabaseBackup] Failed to list backups: #{list_response.code} - #{list_response.body}"
      return nil
    end

    transfers = JSON.parse(list_response.body)
    # Find the latest completed backup (succeeded=true, to_type=gof3r means backup)
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
    url_uri = URI.parse("https://pg-api.heroku.com/client/v11/databases/#{attachment_name}/transfers/#{backup_num}/actions/public-url")
    url_request = Net::HTTP::Post.new(url_uri)
    url_request["Accept"] = "application/json"
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

  def fetch_database_attachment
    require "net/http"
    require "uri"

    # Get database add-on attachments for the app
    uri = URI.parse("https://api.heroku.com/apps/#{HEROKU_APP}/addon-attachments")
    request = Net::HTTP::Get.new(uri)
    request["Accept"] = "application/vnd.heroku+json; version=3"
    request["Accept-Encoding"] = "identity"  # Prevent compression
    request["Authorization"] = "Bearer #{heroku_api_key}"

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    body = decompress_response(response)

    unless response.code == "200"
      Rails.logger.error "[DatabaseBackup] Failed to get add-ons: #{response.code} - #{body}"
      return nil
    end

    attachments = JSON.parse(body)
    # Find the Postgres attachment (typically named DATABASE or HEROKU_POSTGRESQL_*)
    pg_attachment = attachments.find { |a| a.dig("addon", "name")&.include?("postgresql") }

    unless pg_attachment
      Rails.logger.error "[DatabaseBackup] No Postgres add-on found. Attachments: #{attachments.map { |a| a['name'] }.join(', ')}"
      return nil
    end

    Rails.logger.info "[DatabaseBackup] Found database attachment: #{pg_attachment['name']}"
    pg_attachment["name"]
  rescue => e
    Rails.logger.error "[DatabaseBackup] Failed to fetch database attachment: #{e.class} - #{e.message}"
    nil
  end

  def decompress_response(response)
    body = response.body
    case response["content-encoding"]
    when "gzip"
      require "zlib"
      Zlib::GzipReader.new(StringIO.new(body)).read
    when "deflate"
      require "zlib"
      Zlib::Inflate.inflate(body)
    else
      body
    end
  rescue => e
    Rails.logger.warn "[DatabaseBackup] Failed to decompress: #{e.message}, using raw body"
    response.body
  end
end

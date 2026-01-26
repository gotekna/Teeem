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

    # Heroku pg-backups uses a separate API (api.data.heroku.com)
    # First get the database attachment name from the app
    attachment_name = fetch_database_attachment
    return nil unless attachment_name

    # Step 1: List backups using Heroku Data API (with redirect following)
    # Returns both body AND final URL (after any redirects)
    list_result = fetch_with_redirects(
      "https://api.data.heroku.com/client/v11/databases/#{attachment_name}/transfers",
      :get,
      return_final_url: true
    )
    return nil unless list_result

    list_body = list_result[:body]
    final_url = list_result[:final_url]

    transfers = JSON.parse(list_body)
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
    # Use the same base URL pattern that Step 1 was redirected to
    # e.g., if redirected to https://postgres-api.heroku.com/client/v11/apps/{uuid}/transfers
    # then use https://postgres-api.heroku.com/client/v11/apps/{uuid}/transfers/{num}/actions/public-url
    public_url_endpoint = "#{final_url}/#{backup_num}/actions/public-url"
    Rails.logger.info "[DatabaseBackup] Getting public URL from: #{public_url_endpoint}"

    url_result = fetch_with_redirects(public_url_endpoint, :post, return_final_url: true)
    return nil unless url_result

    JSON.parse(url_result[:body])["url"]
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
    # The addon.name contains the actual addon ID like "postgresql-curved-12345"
    pg_attachment = attachments.find { |a| a.dig("addon", "name")&.include?("postgresql") }

    unless pg_attachment
      Rails.logger.error "[DatabaseBackup] No Postgres add-on found. Attachments: #{attachments.map { |a| a['name'] }.join(', ')}"
      return nil
    end

    addon_name = pg_attachment.dig("addon", "name")
    Rails.logger.info "[DatabaseBackup] Found database addon: #{addon_name} (attachment: #{pg_attachment['name']})"
    addon_name
  rescue => e
    Rails.logger.error "[DatabaseBackup] Failed to fetch database attachment: #{e.class} - #{e.message}"
    nil
  end

  def fetch_with_redirects(url, method = :get, return_final_url: false, max_redirects: 5)
    require "net/http"
    require "uri"

    uri = URI.parse(url)
    redirects = 0

    loop do
      request = method == :post ? Net::HTTP::Post.new(uri) : Net::HTTP::Get.new(uri)
      request["Accept"] = "application/json"
      request["Accept-Encoding"] = "identity"
      request["Authorization"] = "Bearer #{heroku_api_key}"

      response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        http.request(request)
      end

      case response.code
      when "200", "201"
        body = decompress_response(response)
        if return_final_url
          # Return both body and the final URL (without query string)
          final_url = "#{uri.scheme}://#{uri.host}#{uri.path}"
          return { body: body, final_url: final_url }
        else
          return body
        end
      when "301", "302", "303", "307", "308"
        redirects += 1
        if redirects > max_redirects
          Rails.logger.error "[DatabaseBackup] Too many redirects"
          return nil
        end
        location = response["location"]
        Rails.logger.info "[DatabaseBackup] Following redirect to: #{location}"
        uri = URI.parse(location)
      else
        Rails.logger.error "[DatabaseBackup] HTTP error: #{response.code} - #{decompress_response(response)}"
        return nil
      end
    end
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

# frozen_string_literal: true

# TenantDatabaseBackupJob - Database backup for a specific tenant
#
# Downloads the Heroku backup and uploads to the tenant's configured
# primary storage provider.
#
# Note: Currently Teeem uses a single Heroku database, so the database
# backup is the same for all tenants. However, each tenant's backup
# goes to their own configured storage bucket for data isolation.
#
class TenantDatabaseBackupJob < ApplicationJob
  queue_as :low

  # Heroku app name for production database
  HEROKU_APP = "teeem-production"

  def perform(tenant_id)
    @tenant = Tenant.find(tenant_id)

    ActsAsTenant.with_tenant(@tenant) do
      @config = BackupConfiguration.for_tenant

      unless @config.enabled?
        Rails.logger.info "[TenantDatabaseBackup] Skipped - backups disabled for tenant #{@tenant.id}"
        return
      end

      unless @config.primary_credential
        Rails.logger.warn "[TenantDatabaseBackup] Skipped - no primary credential for tenant #{@tenant.id}"
        return
      end

      run_backup
    end
  end

  private

  def run_backup
    log = BackupLog.start!(@config, type: "database", provider: @config.primary_credential.provider_name)
    start_time = Time.current

    begin
      # Get Heroku backup URL
      backup_url = fetch_heroku_backup_url
      unless backup_url
        log.fail!(error_message: "Failed to get Heroku backup URL", duration_seconds: elapsed(start_time))
        return
      end

      # Initialize tenant backup service
      service = TenantBackupService.new(@config.primary_credential)

      # Upload to tenant's storage
      filename = "db-backup-#{Date.current.strftime('%Y%m%d')}.dump"
      key = "database/#{@tenant.id}/#{filename}"

      result = service.upload_from_url(
        key: key,
        url: backup_url,
        metadata: {
          source: "heroku",
          app: HEROKU_APP,
          tenant_id: @tenant.id.to_s,
          backup_date: Date.current.iso8601,
          backed_up_at: Time.current.iso8601
        }
      )

      # Update log
      log.complete!(
        size_bytes: result[:size],
        duration_seconds: elapsed(start_time),
        storage_key: key
      )

      # Update config
      @config.record_backup_completed!(:database)

      # Cleanup old backups
      retention = (@config.retention_days / 7.0).ceil  # Convert days to weekly backups
      deleted = service.cleanup_old_backups("database/#{@tenant.id}/", keep: retention)
      Rails.logger.info "[TenantDatabaseBackup] Cleanup: deleted #{deleted} old backups" if deleted > 0

      # Queue mirror job if enabled
      if @config.mirror_enabled? && @config.secondary_credential
        BackupMirrorJob.perform_later(@tenant.id, "database", key)
      end

      Rails.logger.info "[TenantDatabaseBackup] Complete for tenant #{@tenant.id}: #{key}"
    rescue => e
      log.fail!(error_message: e.message, duration_seconds: elapsed(start_time))
      Rails.logger.error "[TenantDatabaseBackup] Failed for tenant #{@tenant.id}: #{e.message}"
      raise e
    end
  end

  def heroku_api_key
    ENV["HEROKU_API_KEY"]
  end

  def elapsed(start_time)
    (Time.current - start_time).to_i
  end

  def fetch_heroku_backup_url
    return nil unless heroku_api_key.present?

    # Get the database attachment name
    attachment_name = fetch_database_attachment
    return nil unless attachment_name

    # List backups
    list_result = fetch_with_redirects(
      "https://api.data.heroku.com/client/v11/databases/#{attachment_name}/transfers",
      :get,
      return_final_url: true
    )
    return nil unless list_result

    transfers = JSON.parse(list_result[:body])
    latest_backup = transfers
      .select { |t| t["succeeded"] && t["to_type"] == "gof3r" }
      .max_by { |t| Time.parse(t["finished_at"]) rescue Time.at(0) }

    unless latest_backup
      Rails.logger.error "[TenantDatabaseBackup] No completed backups found"
      return nil
    end

    backup_num = latest_backup["num"]
    Rails.logger.info "[TenantDatabaseBackup] Found backup ##{backup_num}"

    # Get public URL
    public_url_endpoint = "#{list_result[:final_url]}/#{backup_num}/actions/public-url"
    url_result = fetch_with_redirects(public_url_endpoint, :post, return_final_url: true)
    return nil unless url_result

    JSON.parse(url_result[:body])["url"]
  rescue => e
    Rails.logger.error "[TenantDatabaseBackup] Failed to fetch backup URL: #{e.message}"
    nil
  end

  def fetch_database_attachment
    require "net/http"

    uri = URI.parse("https://api.heroku.com/apps/#{HEROKU_APP}/addon-attachments")
    request = Net::HTTP::Get.new(uri)
    request["Accept"] = "application/vnd.heroku+json; version=3"
    request["Accept-Encoding"] = "identity"
    request["Authorization"] = "Bearer #{heroku_api_key}"

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    return nil unless response.code == "200"

    attachments = JSON.parse(response.body)
    pg_attachment = attachments.find { |a| a.dig("addon", "name")&.include?("postgresql") }
    pg_attachment&.dig("addon", "name")
  rescue => e
    Rails.logger.error "[TenantDatabaseBackup] Failed to fetch attachment: #{e.message}"
    nil
  end

  def fetch_with_redirects(url, method = :get, return_final_url: false, max_redirects: 5)
    require "net/http"

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
        if return_final_url
          final_url = "#{uri.scheme}://#{uri.host}#{uri.path}"
          return { body: response.body, final_url: final_url }
        else
          return response.body
        end
      when "301", "302", "303", "307", "308"
        redirects += 1
        return nil if redirects > max_redirects
        uri = URI.parse(response["location"])
      else
        Rails.logger.error "[TenantDatabaseBackup] HTTP error: #{response.code}"
        return nil
      end
    end
  end
end

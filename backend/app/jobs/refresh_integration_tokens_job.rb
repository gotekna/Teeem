# Proactively refresh OAuth tokens before they expire
# Run this job every 15 minutes via SolidQueue recurring tasks
#
# RESILIENCE: Added retry logic for connection exhaustion (Option C refactor)
# - Retries automatically on database connection errors
# - Skips gracefully if connection pool is critically exhausted
# - ConnectionHealthMonitorJob caches pool status every 5 minutes
#
class RefreshIntegrationTokensJob < ApplicationJob
  queue_as :default

  # Automatic retry on transient connection errors
  # Wait 5 seconds between retries, up to 5 attempts
  retry_on ActiveRecord::ConnectionNotEstablished, wait: 5.seconds, attempts: 5
  retry_on ActiveRecord::ConnectionTimeoutError, wait: 5.seconds, attempts: 5
  retry_on PG::ConnectionBad, wait: 5.seconds, attempts: 5

  # Check connection health before running
  # FIX: Don't skip entirely - tokens could expire. Instead, run with delays.
  around_perform do |_job, block|
    connection_health = Rails.cache.read("connection_health")

    if connection_health&.dig(:status) == :critical
      Rails.logger.warn "[TokenRefresh] Connection pool critical - running with delays to prevent token expiry"
      Rails.logger.warn "[TokenRefresh] Pool status: #{connection_health[:message]}"
      # Set flag for delayed mode - checked by refresh methods
      Thread.current[:token_refresh_delayed_mode] = true
    elsif connection_health&.dig(:status) == :warning
      Rails.logger.info "[TokenRefresh] Running with elevated connection pool usage: #{connection_health[:message]}"
      Thread.current[:token_refresh_delayed_mode] = false
    else
      Thread.current[:token_refresh_delayed_mode] = false
    end

    block.call
  ensure
    Thread.current[:token_refresh_delayed_mode] = nil
  end

  def perform
    refresh_onedrive_tokens
    refresh_xero_tokens

    # SSoT: Refresh all Microsoft credentials (unified table)
    refresh_unified_microsoft_credentials

    # SELF-HEALING: Auto-reconnect app credentials that failed
    # App credentials use client_id/secret so can reconnect without user interaction
    heal_disconnected_app_credentials
  end

  private

  def refresh_onedrive_tokens
    # SSoT: Use MicrosoftCredential for org-level SharePoint credentials
    # Proactively refresh tokens expiring in the next HOUR
    # Ultra thinking: 4x buffer vs 15-min job interval - tokens never get close to expiring
    MicrosoftCredential.delegated_credentials.org_level.active.each do |credential|
      next unless credential.token_expires_at.present?
      next unless credential.token_expires_at <= 1.hour.from_now

      Rails.logger.info "[TokenRefresh] Refreshing SharePoint token expiring at #{credential.token_expires_at}"

      begin
        credential.refresh_delegated_token!
        Rails.logger.info "[TokenRefresh] SharePoint token refreshed successfully, new expiry: #{credential.reload.token_expires_at}"
      rescue StandardError => e
        Rails.logger.error "[TokenRefresh] Failed to refresh SharePoint token: #{e.message}"
      end
    end
  end

  def refresh_xero_tokens
    # Use XeroTokenManager for proactive token refresh
    # Refreshes tokens 15 minutes BEFORE expiry (proactive, not reactive)
    credentials_needing_refresh = XeroTokenManager.credentials_needing_refresh

    if credentials_needing_refresh.none?
      Rails.logger.debug "[TokenRefresh] No Xero tokens need refresh"
      return
    end

    Rails.logger.info "[TokenRefresh] Refreshing #{credentials_needing_refresh.count} Xero tokens"

    credentials_needing_refresh.find_each do |credential|
      Rails.logger.info "[TokenRefresh] Refreshing Xero token for #{credential.tenant_name} (expires: #{credential.expires_at})"

      # Create sync event for tracking
      event = XeroSyncEvent.start!(
        credential: credential,
        sync_type: "token_refresh",
        trigger: "scheduled"
      )

      begin
        result = XeroTokenManager.refresh_credential(credential)

        if result[:success]
          event.complete!(records_processed: 1)
          Rails.logger.info "[TokenRefresh] Xero token refreshed for #{credential.tenant_name}, new expiry: #{result[:expires_at]}"
        else
          event.fail!(error: result[:error])
          Rails.logger.warn "[TokenRefresh] Xero token refresh failed for #{credential.tenant_name}: #{result[:error]}"
        end
      rescue StandardError => e
        event.fail!(error: e.message, error_class: e.class.name)
        Rails.logger.error "[TokenRefresh] Xero token refresh error for #{credential.tenant_name}: #{e.message}"
      end
    end

    # Log health summary after refresh
    summary = XeroTokenManager.health_summary
    Rails.logger.info "[TokenRefresh] Xero health: #{summary[:connected]} connected, #{summary[:degraded]} degraded, #{summary[:disconnected]} disconnected"
  end

  # SSoT: Refresh tokens via MicrosoftTokenManager (centralized with locking)
  # Uses PostgreSQL advisory locks to prevent race conditions
  def refresh_unified_microsoft_credentials
    # Skip if MicrosoftCredential table doesn't exist yet (migration not run)
    unless ActiveRecord::Base.connection.table_exists?(:microsoft_credentials)
      Rails.logger.debug "[TokenRefresh] MicrosoftCredential table not yet created, skipping"
      return
    end

    credentials_to_refresh = MicrosoftTokenManager.credentials_needing_refresh
    if credentials_to_refresh.none?
      Rails.logger.debug "[TokenRefresh] No Microsoft credentials need refresh"
      return
    end

    Rails.logger.info "[TokenRefresh] Refreshing #{credentials_to_refresh.count} Microsoft credential(s) via MicrosoftTokenManager"
    delayed_mode = Thread.current[:token_refresh_delayed_mode]

    credentials_to_refresh.find_each do |credential|
      # Add delay if connection pool is critical
      sleep(1) if delayed_mode

      Rails.logger.info "[TokenRefresh] Refreshing MicrosoftCredential #{credential.id} (#{credential.credential_type}) via TokenManager"

      begin
        # Use MicrosoftTokenManager - handles locking, circuit breaker, error detection
        result = MicrosoftTokenManager.refresh_credential(credential)

        if result[:success]
          Rails.logger.info "[TokenRefresh] MicrosoftCredential #{credential.id} refreshed, expires: #{result[:expires_at]}"
        else
          if credential.refresh_token_dead?
            Rails.logger.error "[TokenRefresh] MicrosoftCredential #{credential.id} DEAD: #{result[:error]}"
          else
            Rails.logger.warn "[TokenRefresh] MicrosoftCredential #{credential.id} failed: #{result[:error]}"
          end
        end
      rescue StandardError => e
        MicrosoftTokenManager.record_api_failure(credential, e.message)
        Rails.logger.error "[TokenRefresh] MicrosoftCredential #{credential.id} error: #{e.message}"
      end
    end

    # Log health summary
    summary = MicrosoftTokenManager.health_summary
    Rails.logger.info "[TokenRefresh] Microsoft health: #{summary[:connected]}/#{summary[:total]} connected, #{summary[:dead]} dead, #{summary[:error]} error"
  end

  # SELF-HEALING: Auto-reconnect app credentials that are in error/pending/disconnected state
  # App credentials (client credentials flow) can reconnect without user interaction
  # because they use client_id + client_secret + tenant_id (all stored in DB)
  def heal_disconnected_app_credentials
    healed_count = 0
    failed_count = 0

    # SSoT: Heal MicrosoftCredential (app type) records via MicrosoftTokenManager
    MicrosoftCredential.app_credentials.active
      .where.not(status: "connected")
      .where.not(refresh_token_dead: true) # Don't try to heal dead tokens
      .where.not(client_id: nil)
      .where.not(client_secret: nil)
      .where.not(azure_tenant_id: nil)
      .find_each do |credential|
        Rails.logger.info "[TokenRefresh] HEALING MicrosoftCredential (app) #{credential.name || credential.id} (status: #{credential.status})"

        begin
          # Use MicrosoftTokenManager for consistent locking and error handling
          result = MicrosoftTokenManager.refresh_credential(credential)

          if result[:success]
            Rails.logger.info "[TokenRefresh] HEALED MicrosoftCredential (app) #{credential.name || credential.id} - now connected"
            healed_count += 1
          else
            Rails.logger.warn "[TokenRefresh] HEAL FAILED for MicrosoftCredential #{credential.id}: #{result[:error]}"
            failed_count += 1
          end
        rescue StandardError => e
          MicrosoftTokenManager.record_api_failure(credential, e.message)
          Rails.logger.error "[TokenRefresh] HEAL ERROR for MicrosoftCredential #{credential.id}: #{e.message}"
          failed_count += 1
        end
      end

    if healed_count > 0 || failed_count > 0
      Rails.logger.info "[TokenRefresh] SELF-HEALING complete: #{healed_count} healed, #{failed_count} failed"
    end
  end
end

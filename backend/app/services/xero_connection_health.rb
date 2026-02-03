# SSoT (Single Source of Truth) for computing Xero connection health.
#
# This service eliminates the SSoT violation where:
# - XeroCredential.effectively_connected? shows one status
# - CorporateXeroConnection.connected? shows a different status
#
# Instead of storing status in multiple places that can get out of sync,
# we COMPUTE status from the actual token state every time.
#
# Usage:
#   health = XeroConnectionHealth.for_credential(credential)
#   health.connected         # => true/false
#   health.display_status    # => 'connected', 'warning', 'error', 'disconnected'
#   health.message           # => "Connected to Tekna Homes"
#   health.needs_attention   # => true/false
#   health.action_required   # => 'reconnect', 'wait', nil
#
#   health = XeroConnectionHealth.for_company(company)
#   # Same interface, but includes company-specific data
#
class XeroConnectionHealth
  # Immutable struct for health status - THE ONE format for all consumers
  HealthStatus = Struct.new(
    :connected,        # Boolean - can we make API calls right now?
    :display_status,   # String - 'connected', 'warning', 'error', 'disconnected'
    :message,          # String - Human-readable status message
    :expires_at,       # DateTime - When token expires
    :needs_attention,  # Boolean - Does user need to take action?
    :action_required,  # String - What action is needed (nil if none)
    :tenant_name,      # String - Xero organization name
    :tenant_id,        # String - Xero tenant ID
    :last_sync_at,     # DateTime - Last successful sync
    :days_since_sync,  # Integer - Days since last sync
    keyword_init: true
  ) do
    def to_json_hash
      {
        connected: connected,
        display_status: display_status,
        message: message,
        expires_at: expires_at&.iso8601,
        needs_attention: needs_attention,
        action_required: action_required,
        xero_tenant_name: tenant_name,
        xero_tenant_id: tenant_id,
        last_sync_at: last_sync_at&.iso8601,
        days_since_sync: days_since_sync
      }
    end
  end

  class << self
    # Compute health for an XeroCredential
    # This is THE SSoT for credential health - all other code should call this
    def for_credential(credential)
      return disconnected_status("No credential") unless credential

      # Check token poisoning first (fatal - requires re-auth)
      if credential.poisoned?
        return HealthStatus.new(
          connected: false,
          display_status: "disconnected",
          message: credential.poisoned_reason || "Token revoked. Please reconnect to Xero.",
          expires_at: nil,
          needs_attention: true,
          action_required: "reconnect",
          tenant_name: credential.tenant_name,
          tenant_id: credential.tenant_id
        )
      end

      # Check hard disconnect
      if credential.status == "disconnected"
        return HealthStatus.new(
          connected: false,
          display_status: "disconnected",
          message: credential.last_refresh_error || "Connection requires re-authentication.",
          expires_at: nil,
          needs_attention: true,
          action_required: "reconnect",
          tenant_name: credential.tenant_name,
          tenant_id: credential.tenant_id
        )
      end

      # Check circuit breaker (temporary block due to too many failures)
      if credential.circuit_open?
        return HealthStatus.new(
          connected: false,
          display_status: "error",
          message: "Too many API failures. Pausing requests temporarily.",
          expires_at: credential.expires_at,
          needs_attention: false, # Self-heals via circuit reset
          action_required: "wait",
          tenant_name: credential.tenant_name,
          tenant_id: credential.tenant_id
        )
      end

      # Check token expiry
      if credential.expired?
        return HealthStatus.new(
          connected: false,
          display_status: "error",
          message: "Token expired. Attempting refresh...",
          expires_at: credential.expires_at,
          needs_attention: false, # Auto-heal in progress
          action_required: nil,
          tenant_name: credential.tenant_name,
          tenant_id: credential.tenant_id
        )
      end

      # Check degraded state (refresh failures but still retrying)
      if credential.status == "degraded" || credential.needs_refresh?
        return HealthStatus.new(
          connected: true, # Still working, just needs attention
          display_status: "warning",
          message: "Connection experiencing issues. Refreshing...",
          expires_at: credential.expires_at,
          needs_attention: false, # Auto-heal in progress
          action_required: nil,
          tenant_name: credential.tenant_name,
          tenant_id: credential.tenant_id
        )
      end

      # FRC: Check rate limits before declaring healthy
      # This integrates rate limit status into connection health (SSoT consistency)
      if credential.tenant_id.present?
        usage = XeroRateLimitTracker.usage_for(credential.tenant_id)
        if usage && !usage[:can_make_request]
          return HealthStatus.new(
            connected: true,  # Still connected, just throttled
            display_status: "rate_limited",
            message: usage[:locked_out] ? "Rate limit enforced by Xero. Syncing paused." : "Daily limit reached (#{usage.dig(:daily, :used)}/5000). Resets 10:00 AM Brisbane.",
            expires_at: credential.expires_at,
            needs_attention: false,  # Self-heals at rate limit reset
            action_required: "wait",
            tenant_name: credential.tenant_name,
            tenant_id: credential.tenant_id
          )
        end
      end

      # Healthy!
      HealthStatus.new(
        connected: true,
        display_status: "connected",
        message: "Connected to #{credential.tenant_name}",
        expires_at: credential.expires_at,
        needs_attention: false,
        action_required: nil,
        tenant_name: credential.tenant_name,
        tenant_id: credential.tenant_id
      )
    end

    # Compute health for a company's Xero connection
    # This is THE SSoT for company Xero health - replaces connection.connected?
    def for_company(company)
      connection = company.corporate_xero_connection
      return disconnected_status("Not connected to Xero") unless connection

      credential = connection.xero_credential
      return disconnected_status("No credential linked") unless credential

      # Delegate to credential health (THE SSoT)
      health = for_credential(credential)

      # Enhance with company-specific info
      HealthStatus.new(
        connected: health.connected,
        display_status: health.display_status,
        message: health.message,
        expires_at: health.expires_at,
        needs_attention: health.needs_attention,
        action_required: health.action_required,
        tenant_name: credential.tenant_name,
        tenant_id: credential.tenant_id,
        last_sync_at: connection.last_synced_at,
        days_since_sync: connection.days_since_last_sync
      )
    end

    # Compute health for all credentials (for admin dashboard)
    def all_credentials_health
      XeroCredential.all.map do |credential|
        {
          credential_id: credential.id,
          health: for_credential(credential)
        }
      end
    end

    # Check overall Xero health (any credential connected?)
    def any_connected?
      XeroCredential.find_each do |credential|
        return true if for_credential(credential).connected
      end
      false
    end

    # Run health check on all credentials and log results
    # Called by XeroHealthMonitorJob
    def run_health_check
      results = {
        total: 0,
        connected_count: 0,
        warning_count: 0,
        error_count: 0,
        disconnected_count: 0,
        rate_limited_count: 0,  # FRC: Track rate-limited orgs separately
        credentials: []
      }

      XeroCredential.find_each do |credential|
        health = for_credential(credential)
        results[:total] += 1

        case health.display_status
        when "connected" then results[:connected_count] += 1
        when "warning" then results[:warning_count] += 1
        when "error" then results[:error_count] += 1
        when "disconnected" then results[:disconnected_count] += 1
        when "rate_limited" then results[:rate_limited_count] += 1
        end

        results[:credentials] << {
          id: credential.id,
          tenant_name: credential.tenant_name,
          display_status: health.display_status,
          needs_attention: health.needs_attention
        }

        # Log status change if different from last known status
        check_for_status_change(credential, health)
      end

      # Log the health check
      XeroHealthEvent.log_health_check(results: results)

      results
    end

    # Check if credential status changed and log if so
    def check_for_status_change(credential, current_health)
      # Get last status from most recent event
      last_event = XeroHealthEvent
        .for_credential(credential)
        .status_changes
        .order(created_at: :desc)
        .first

      last_status = last_event&.to_status || "unknown"
      current_status = current_health.display_status

      return if last_status == current_status

      XeroHealthEvent.log_status_change(
        credential,
        from: last_status,
        to: current_status,
        trigger: "health_check",
        message: current_health.message
      )
    end

    # Public helper to create a disconnected status - useful for models that delegate
    def disconnected_status(message)
      HealthStatus.new(
        connected: false,
        display_status: "disconnected",
        message: message,
        expires_at: nil,
        needs_attention: true,
        action_required: "connect",
        tenant_name: nil,
        tenant_id: nil
      )
    end
  end
end

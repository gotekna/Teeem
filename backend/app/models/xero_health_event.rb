# Tracks all Xero connection health state transitions for observability.
#
# Event Types:
#   - status_change: Health status changed (connected → warning → error → disconnected)
#   - token_refresh: Token refresh attempted
#   - token_expired: Token expired
#   - token_poisoned: Token permanently invalidated
#   - circuit_opened: Circuit breaker opened (too many failures)
#   - circuit_closed: Circuit breaker closed (recovered)
#   - self_heal_started: Self-healing process started
#   - self_heal_completed: Self-healing succeeded
#   - self_heal_failed: Self-healing failed
#   - health_check: Periodic health check ran
#
class XeroHealthEvent < ApplicationRecord
  belongs_to :xero_credential, optional: true

  # Event types
  STATUS_CHANGE = "status_change"
  TOKEN_REFRESH = "token_refresh"
  TOKEN_EXPIRED = "token_expired"
  TOKEN_POISONED = "token_poisoned"
  CIRCUIT_OPENED = "circuit_opened"
  CIRCUIT_CLOSED = "circuit_closed"
  SELF_HEAL_STARTED = "self_heal_started"
  SELF_HEAL_COMPLETED = "self_heal_completed"
  SELF_HEAL_FAILED = "self_heal_failed"
  HEALTH_CHECK = "health_check"

  EVENT_TYPES = [
    STATUS_CHANGE, TOKEN_REFRESH, TOKEN_EXPIRED, TOKEN_POISONED,
    CIRCUIT_OPENED, CIRCUIT_CLOSED, SELF_HEAL_STARTED,
    SELF_HEAL_COMPLETED, SELF_HEAL_FAILED, HEALTH_CHECK
  ].freeze

  # Validations
  validates :event_type, presence: true, inclusion: { in: EVENT_TYPES }

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :for_credential, ->(credential) { where(xero_credential: credential) }
  scope :status_changes, -> { where(event_type: STATUS_CHANGE) }
  scope :failures, -> { where(event_type: [TOKEN_EXPIRED, TOKEN_POISONED, CIRCUIT_OPENED, SELF_HEAL_FAILED]) }
  scope :recoveries, -> { where(event_type: [CIRCUIT_CLOSED, SELF_HEAL_COMPLETED]) }
  scope :in_last, ->(duration) { where("created_at > ?", duration.ago) }

  class << self
    # Log a status change event
    def log_status_change(credential, from:, to:, trigger: nil, message: nil)
      create!(
        xero_credential: credential,
        event_type: STATUS_CHANGE,
        from_status: from,
        to_status: to,
        trigger: trigger,
        message: message || "Status changed from #{from} to #{to}",
        metadata: {
          tenant_name: credential&.tenant_name,
          tenant_id: credential&.tenant_id
        }
      )
    end

    # Log a token refresh event
    def log_token_refresh(credential, success:, error: nil)
      create!(
        xero_credential: credential,
        event_type: TOKEN_REFRESH,
        message: success ? "Token refreshed successfully" : "Token refresh failed: #{error}",
        metadata: {
          success: success,
          error: error,
          tenant_name: credential&.tenant_name
        }
      )
    end

    # Log token expired event
    def log_token_expired(credential)
      create!(
        xero_credential: credential,
        event_type: TOKEN_EXPIRED,
        message: "Token expired for #{credential&.tenant_name}",
        metadata: {
          tenant_name: credential&.tenant_name,
          expired_at: credential&.expires_at
        }
      )
    end

    # Log token poisoned (permanent failure)
    def log_token_poisoned(credential, reason:)
      create!(
        xero_credential: credential,
        event_type: TOKEN_POISONED,
        message: "Token poisoned: #{reason}",
        metadata: {
          tenant_name: credential&.tenant_name,
          reason: reason
        }
      )
    end

    # Log circuit breaker events
    def log_circuit_opened(credential, failures:)
      create!(
        xero_credential: credential,
        event_type: CIRCUIT_OPENED,
        message: "Circuit breaker opened after #{failures} failures",
        metadata: { failure_count: failures }
      )
    end

    def log_circuit_closed(credential)
      create!(
        xero_credential: credential,
        event_type: CIRCUIT_CLOSED,
        message: "Circuit breaker closed - connection recovered"
      )
    end

    # Log self-healing events
    def log_self_heal_started(credential, strategy:)
      create!(
        xero_credential: credential,
        event_type: SELF_HEAL_STARTED,
        message: "Self-healing started with strategy: #{strategy}",
        metadata: { strategy: strategy }
      )
    end

    def log_self_heal_completed(credential, strategy:, duration_ms:)
      create!(
        xero_credential: credential,
        event_type: SELF_HEAL_COMPLETED,
        message: "Self-healing completed in #{duration_ms}ms",
        metadata: { strategy: strategy, duration_ms: duration_ms }
      )
    end

    def log_self_heal_failed(credential, strategy:, error:)
      create!(
        xero_credential: credential,
        event_type: SELF_HEAL_FAILED,
        message: "Self-healing failed: #{error}",
        metadata: { strategy: strategy, error: error }
      )
    end

    # Log health check
    def log_health_check(results:)
      create!(
        event_type: HEALTH_CHECK,
        message: "Health check completed: #{results[:connected_count]}/#{results[:total]} connected",
        metadata: results
      )
    end

    # Analytics helpers
    def failure_rate_last_24h
      total = in_last(24.hours).count
      return 0 if total.zero?
      failures.in_last(24.hours).count.to_f / total
    end

    def mean_time_to_recovery
      # Find pairs of failure -> recovery events and calculate average duration
      recoveries_with_failures = recoveries.in_last(7.days).map do |recovery|
        prior_failure = failures
          .for_credential(recovery.xero_credential)
          .where("created_at < ?", recovery.created_at)
          .order(created_at: :desc)
          .first

        next unless prior_failure
        recovery.created_at - prior_failure.created_at
      end.compact

      return nil if recoveries_with_failures.empty?
      recoveries_with_failures.sum / recoveries_with_failures.size
    end
  end
end

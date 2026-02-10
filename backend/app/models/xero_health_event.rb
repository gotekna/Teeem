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

    # ============================================
    # PHASE 5: PREDICTIVE HEALTH ANALYSIS
    # ============================================

    # Calculate risk score for a credential (0-100)
    # Higher score = higher risk of failure
    def risk_score_for(credential)
      return 100 unless credential

      score = 0
      events = for_credential(credential).in_last(7.days)

      # Factor 1: Recent failures (30 points max)
      failure_count = events.failures.count
      score += [ failure_count * 10, 30 ].min

      # Factor 2: Circuit breaker opened recently (20 points)
      if events.where(event_type: CIRCUIT_OPENED).exists?
        score += 20
      end

      # Factor 3: Token poisoned (50 points - critical)
      if events.where(event_type: TOKEN_POISONED).exists?
        score += 50
      end

      # Factor 4: Failed self-heal attempts (15 points max)
      failed_heals = events.where(event_type: SELF_HEAL_FAILED).count
      score += [ failed_heals * 5, 15 ].min

      # Factor 5: Token age (10 points)
      if credential.expires_at.present?
        hours_until_expiry = (credential.expires_at - Time.current) / 1.hour
        if hours_until_expiry < 1
          score += 10
        elsif hours_until_expiry < 6
          score += 5
        end
      end

      # Factor 6: Pattern detection - frequent status changes (10 points)
      status_changes = events.status_changes.count
      if status_changes > 5
        score += 10
      end

      [ score, 100 ].min
    end

    # Get early warnings for credentials
    # FRC (Feb 2026): Must be tenant-scoped - accepts optional tenant parameter
    def early_warnings(tenant: nil)
      warnings = []

      cred_scope = if tenant.nil? || tenant.master_tenant?
                     XeroCredential.all
                   else
                     XeroCredential.for_teeem_tenant(tenant)
                   end
      cred_scope.find_each do |credential|
        score = risk_score_for(credential)
        events = for_credential(credential).in_last(24.hours)

        # High risk score
        if score >= 70
          warnings << {
            credential_id: credential.id,
            tenant_name: credential.tenant_name,
            warning_type: "high_risk",
            severity: "critical",
            message: "Connection at high risk (score: #{score}/100)",
            risk_score: score
          }
        elsif score >= 40
          warnings << {
            credential_id: credential.id,
            tenant_name: credential.tenant_name,
            warning_type: "elevated_risk",
            severity: "warning",
            message: "Connection showing warning signs (score: #{score}/100)",
            risk_score: score
          }
        end

        # Token expiring soon
        if credential.expires_at.present? && credential.expires_at < 2.hours.from_now
          warnings << {
            credential_id: credential.id,
            tenant_name: credential.tenant_name,
            warning_type: "token_expiring",
            severity: credential.expires_at < 30.minutes.from_now ? "critical" : "warning",
            message: "Token expires in #{((credential.expires_at - Time.current) / 60).round} minutes",
            expires_at: credential.expires_at.iso8601
          }
        end

        # Repeated failures pattern
        recent_failures = events.failures.count
        if recent_failures >= 3
          warnings << {
            credential_id: credential.id,
            tenant_name: credential.tenant_name,
            warning_type: "repeated_failures",
            severity: "warning",
            message: "#{recent_failures} failures in last 24 hours",
            failure_count: recent_failures
          }
        end
      end

      warnings.sort_by { |w| w[:severity] == "critical" ? 0 : 1 }
    end

    # Detect failure patterns
    def failure_patterns(credential = nil)
      scope = credential ? for_credential(credential) : all
      events = scope.in_last(30.days).order(:created_at)

      patterns = {
        daily_failure_counts: {},
        hourly_failure_distribution: Hash.new(0),
        common_triggers: Hash.new(0),
        recovery_success_rate: 0,
        avg_time_to_failure: nil
      }

      # Daily failure counts
      events.failures.group_by { |e| e.created_at.to_date }.each do |date, daily_events|
        patterns[:daily_failure_counts][date.iso8601] = daily_events.count
      end

      # Hourly distribution
      events.failures.each do |event|
        patterns[:hourly_failure_distribution][event.created_at.hour] += 1
      end

      # Common triggers
      events.failures.each do |event|
        trigger = event.trigger || event.metadata["strategy"] || "unknown"
        patterns[:common_triggers][trigger] += 1
      end

      # Recovery success rate
      heal_started = events.where(event_type: SELF_HEAL_STARTED).count
      heal_completed = events.where(event_type: SELF_HEAL_COMPLETED).count
      if heal_started > 0
        patterns[:recovery_success_rate] = (heal_completed.to_f / heal_started * 100).round(1)
      end

      patterns
    end

    # Get trend analysis
    # FRC (Feb 2026): Must be tenant-scoped - accepts optional tenant parameter
    def trend_analysis(tenant: nil)
      {
        failure_rate_trend: failure_rate_trend,
        health_score_trend: health_score_trend(tenant: tenant),
        mttr_trend: mttr_trend
      }
    end

    private

    def failure_rate_trend
      last_7_days = (0..6).map do |days_ago|
        date = days_ago.days.ago.to_date
        day_events = where("DATE(created_at) = ?", date)
        total = day_events.count
        failures_count = day_events.failures.count

        {
          date: date.iso8601,
          total_events: total,
          failures: failures_count,
          failure_rate: total > 0 ? (failures_count.to_f / total * 100).round(1) : 0
        }
      end.reverse

      last_7_days
    end

    def health_score_trend(tenant: nil)
      # FRC (Feb 2026): Must be tenant-scoped
      cred_scope = if tenant.nil? || tenant.master_tenant?
                     XeroCredential.all
                   else
                     XeroCredential.for_teeem_tenant(tenant)
                   end
      cred_scope.map do |credential|
        {
          credential_id: credential.id,
          tenant_name: credential.tenant_name,
          current_risk_score: risk_score_for(credential),
          health_score: 100 - risk_score_for(credential)
        }
      end
    end

    def mttr_trend
      last_7_days = (0..6).map do |days_ago|
        date = days_ago.days.ago.to_date
        day_recoveries = recoveries.where("DATE(created_at) = ?", date)

        recovery_times = day_recoveries.map do |recovery|
          prior_failure = failures
            .for_credential(recovery.xero_credential)
            .where("created_at < ?", recovery.created_at)
            .order(created_at: :desc)
            .first

          next unless prior_failure
          (recovery.created_at - prior_failure.created_at).to_i
        end.compact

        avg_mttr = recovery_times.any? ? (recovery_times.sum / recovery_times.size) : nil

        {
          date: date.iso8601,
          recoveries: day_recoveries.count,
          avg_mttr_seconds: avg_mttr
        }
      end.reverse

      last_7_days
    end
  end
end

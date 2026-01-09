# SSoT (Single Source of Truth) for Xero OAuth tokens and connection health.
#
# SSoT Architecture:
# - OAuth tokens: This model (access_token, refresh_token, expires_at)
# - Connection health: This model (status: connected/degraded/disconnected)
# - Sync timing: XeroSyncStatus (NOT this model)
# - Company mapping: CorporateCompanyXeroConnection
#
# Key status values:
# - connected: Healthy, tokens valid and working
# - degraded: Refresh failed but still retrying (1-2 failures)
# - disconnected: Requires user re-authentication (3+ failures or fatal error)
#
class XeroCredential < ApplicationRecord
  # Associations - SSoT for OAuth tokens
  has_many :corporate_company_xero_connections, dependent: :nullify, foreign_key: :xero_credential_id
  has_many :xero_alerts, dependent: :destroy
  has_many :xero_sync_events, dependent: :destroy

  # Encrypt sensitive OAuth tokens
  encrypts :access_token
  encrypts :refresh_token

  validates :access_token, :refresh_token, :expires_at, :tenant_id, presence: true

  # Status values for state machine
  # connected: Healthy, tokens valid and working
  # degraded: Refresh failed but still retrying (1-2 failures)
  # disconnected: Requires user re-authentication (3+ failures or fatal error)
  STATUSES = %w[connected degraded disconnected].freeze
  validates :status, inclusion: { in: STATUSES }, allow_nil: true

  # Circuit breaker states
  # closed: Healthy, all requests go through
  # open: Too many failures, blocking requests temporarily
  # half_open: Testing if service has recovered
  CIRCUIT_STATES = %w[closed open half_open].freeze
  validates :circuit_state, inclusion: { in: CIRCUIT_STATES }, allow_nil: true

  # Scopes
  scope :primary, -> { where(is_primary: true) }
  scope :connected, -> { where(status: "connected") }
  scope :healthy, -> { where(status: %w[connected degraded]) }
  scope :disconnected, -> { where(status: "disconnected") }
  scope :circuit_open, -> { where(circuit_state: "open") }
  scope :needs_refresh, -> { where("expires_at < ?", XeroTokenManager::REFRESH_BUFFER.from_now) }

  # Callbacks
  after_create :set_as_primary_if_none_exists

  # Get the current (primary or latest) active credential
  # Priority: 1) Primary connected credential, 2) Any primary, 3) Most recent connected
  def self.current
    primary.connected.first || primary.first || connected.order(created_at: :desc).first || order(created_at: :desc).first
  end

  # Set this credential as the primary one (and unset others)
  def set_as_primary!
    transaction do
      XeroCredential.update_all(is_primary: false)
      update!(is_primary: true)
    end
  end

  # Check if the access token is expired or about to expire (within 5 minutes)
  def expired?
    return true if expires_at.nil?
    expires_at <= 5.minutes.from_now
  end

  # Check if effectively connected (both token valid AND status not disconnected)
  # This is the method to use for UI display - returns true only when actually usable
  def effectively_connected?
    !expired? && status != "disconnected" && status != "degraded"
  end

  # Check if in a degraded state (token refresh failed but not fully disconnected)
  def degraded?
    status == "degraded"
  end

  # Check if token needs refresh (within 15 minutes of expiry)
  def needs_refresh?
    return true if expires_at.nil?
    expires_at <= XeroTokenManager::REFRESH_BUFFER.from_now
  end

  # Check if this credential can be used for API calls
  def usable?
    status != "disconnected" && circuit_state != "open" && !poisoned?
  end

  # Check if the token is poisoned (burned and will never work again)
  # A token becomes poisoned when:
  # - The refresh token was used outside the 30-minute grace period
  # - The user revoked consent in Xero
  # - The refresh token expired from 60 days of inactivity
  def poisoned?
    token_poisoned_at.present? ||
      (last_refresh_error.present? && last_refresh_error.include?("POISONED"))
  end

  # Clear poisoned state (called after successful reconnection)
  def clear_poisoned_state!
    update!(
      token_poisoned_at: nil,
      poisoned_reason: nil,
      status: "connected",
      last_refresh_error: nil,
      refresh_failure_count: 0
    )
  end

  # State transition helpers
  def mark_degraded!
    return if status == "disconnected"
    update!(status: "degraded")
  end

  def mark_disconnected!
    update!(status: "disconnected")
  end

  def reconnect!
    update!(
      status: "connected",
      refresh_failure_count: 0,
      last_refresh_error: nil,
      circuit_state: "closed",
      circuit_failure_count: 0,
      token_poisoned_at: nil,
      poisoned_reason: nil
    )
    # Auto-resolve any active alerts
    xero_alerts.where(dismissed: false, auto_resolved: false)
               .update_all(auto_resolved: true, auto_resolved_at: Time.current)
  end

  # Circuit breaker helpers
  def circuit_open?
    circuit_state == "open" && circuit_opened_at.present? &&
      circuit_opened_at > XeroTokenManager::CIRCUIT_RESET_TIMEOUT.ago
  end

  def open_circuit!
    update!(circuit_state: "open", circuit_opened_at: Time.current)
  end

  def close_circuit!
    update!(circuit_state: "closed", circuit_failure_count: 0)
  end

  # Health check helpers
  def health_status
    return :poisoned if poisoned?
    return :disconnected if status == "disconnected"
    return :circuit_open if circuit_open?
    return :degraded if status == "degraded"
    return :expiring if needs_refresh?
    :healthy
  end

  # ============================================
  # SSoT: Computed status for frontend display
  # ============================================
  # These methods eliminate client-side token status calculation.
  # Frontend should use these values directly instead of computing from expires_at.
  #
  # Why SSoT matters here:
  # - Backend uses 5-min expired threshold + 25-min refresh buffer
  # - Frontend was calculating with browser's Date.now() - could mismatch
  # - Now backend is THE source of truth for token status
  #

  # Computed status for frontend display
  # Returns: 'connected', 'warning', 'expired', 'disconnected'
  def status_for_display
    return "disconnected" if status == "disconnected" || poisoned?
    return "expired" if expired?
    return "warning" if needs_refresh? || status == "degraded"
    "connected"
  end

  # Human-readable time until token expires
  # Returns: "28m", "1h 15m", "Expired", or date string
  def time_until_expiry_human
    return nil if expires_at.blank?
    return "Expired" if expired?

    diff = expires_at - Time.current
    minutes = (diff / 60).round

    if minutes < 60
      "#{minutes}m"
    elsif minutes < 1440 # Less than 24 hours
      hours = minutes / 60
      mins = minutes % 60
      "#{hours}h #{mins}m"
    else
      expires_at.strftime("%d %b %H:%M")
    end
  end

  # Whether this credential needs user attention
  def needs_attention?
    status != "connected" || expired? || poisoned?
  end

  def days_since_last_api_call
    return nil if last_successful_api_call_at.nil?
    ((Time.current - last_successful_api_call_at) / 1.day).to_i
  end

  def at_risk_of_inactivity_expiry?
    days = days_since_last_api_call
    days.present? && days >= XeroTokenManager::INACTIVITY_WARNING_DAYS
  end

  # Check if Xero is currently connected
  def self.connected?
    connected.any?
  end

  # Health summary for all credentials
  def self.health_summary
    XeroTokenManager.health_summary
  end

  private

  # Automatically set as primary if no other primary exists
  def set_as_primary_if_none_exists
    if XeroCredential.where.not(id: id).primary.none?
      update_column(:is_primary, true)
    end
  end
end

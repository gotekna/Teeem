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
  scope :connected, -> { where(status: 'connected') }
  scope :healthy, -> { where(status: %w[connected degraded]) }
  scope :disconnected, -> { where(status: 'disconnected') }
  scope :circuit_open, -> { where(circuit_state: 'open') }
  scope :needs_refresh, -> { where('expires_at < ?', XeroTokenManager::REFRESH_BUFFER.from_now) }

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

  # Check if token needs refresh (within 15 minutes of expiry)
  def needs_refresh?
    return true if expires_at.nil?
    expires_at <= XeroTokenManager::REFRESH_BUFFER.from_now
  end

  # Check if this credential can be used for API calls
  def usable?
    status != 'disconnected' && circuit_state != 'open'
  end

  # State transition helpers
  def mark_degraded!
    return if status == 'disconnected'
    update!(status: 'degraded')
  end

  def mark_disconnected!
    update!(status: 'disconnected')
  end

  def reconnect!
    update!(
      status: 'connected',
      refresh_failure_count: 0,
      last_refresh_error: nil,
      circuit_state: 'closed',
      circuit_failure_count: 0
    )
    # Auto-resolve any active alerts
    xero_alerts.where(dismissed: false, auto_resolved: false)
               .update_all(auto_resolved: true, auto_resolved_at: Time.current)
  end

  # Circuit breaker helpers
  def circuit_open?
    circuit_state == 'open' && circuit_opened_at.present? &&
      circuit_opened_at > XeroTokenManager::CIRCUIT_RESET_TIMEOUT.ago
  end

  def open_circuit!
    update!(circuit_state: 'open', circuit_opened_at: Time.current)
  end

  def close_circuit!
    update!(circuit_state: 'closed', circuit_failure_count: 0)
  end

  # Health check helpers
  def health_status
    return :disconnected if status == 'disconnected'
    return :circuit_open if circuit_open?
    return :degraded if status == 'degraded'
    return :expiring if needs_refresh?
    :healthy
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

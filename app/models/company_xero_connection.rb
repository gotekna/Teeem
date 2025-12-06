class CompanyXeroConnection < ApplicationRecord
  # Associations
  belongs_to :company
  has_many :company_xero_accounts, dependent: :destroy

  # Encrypted attributes - Rails 7+ attribute encryption
  encrypts :encrypted_access_token
  encrypts :encrypted_refresh_token

  # Validations
  validates :xero_tenant_id, presence: true, uniqueness: true
  validates :connection_status, inclusion: { in: %w[connected disconnected error pending] }

  # Scopes
  scope :connected, -> { where(connection_status: "connected") }
  scope :disconnected, -> { where(connection_status: "disconnected") }
  scope :with_errors, -> { where(connection_status: "error") }
  scope :needs_sync, -> { where("last_sync_at IS NULL OR last_sync_at < ?", 7.days.ago) }

  # Callbacks
  after_create :create_connection_activity, if: :connected?

  # Instance methods
  def connected?
    connection_status == "connected"
  end

  def token_expired?
    token_expires_at.present? && token_expires_at <= 5.minutes.from_now
  end

  def needs_refresh?
    connected? && token_expired?
  end

  def expired?
    token_expired?
  end

  # Virtual accessors for tokens (stored in encrypted columns)
  def access_token
    encrypted_access_token
  end

  def access_token=(value)
    self.encrypted_access_token = value
  end

  def refresh_token
    encrypted_refresh_token
  end

  def refresh_token=(value)
    self.encrypted_refresh_token = value
  end

  # Mark as connected with tokens
  def connect!(access_token:, refresh_token:, expires_at:, tenant_id: nil, tenant_name: nil)
    update!(
      encrypted_access_token: access_token,
      encrypted_refresh_token: refresh_token,
      token_expires_at: expires_at,
      xero_tenant_id: tenant_id || xero_tenant_id,
      xero_tenant_name: tenant_name || xero_tenant_name,
      connection_status: "connected",
      last_sync_error: nil
    )

    create_connection_activity
  end

  def mark_disconnected!(error_message = nil)
    update!(
      connection_status: "disconnected",
      last_sync_error: error_message
    )

    company.company_activities.create!(
      activity_type: "xero_disconnected",
      description: "Xero connection disconnected#{error_message.present? ? ": #{error_message}" : ''}",
      metadata: { xero_tenant_id: xero_tenant_id },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  end

  def mark_error!(error_message)
    update!(
      connection_status: "error",
      last_sync_error: error_message
    )
  end

  def sync_successful!
    update!(
      connection_status: "connected",
      last_sync_at: Time.current,
      last_sync_error: nil
    )
  end

  def days_since_last_sync
    return nil unless last_sync_at.present?
    ((Time.current - last_sync_at) / 1.day).to_i
  end

  # Refresh tokens using XeroApiClient
  def refresh_tokens!
    return false unless refresh_token.present?

    client = XeroApiClient.new
    result = client.refresh_access_token_for_connection(self)

    if result[:success]
      update!(
        encrypted_access_token: result[:access_token],
        encrypted_refresh_token: result[:refresh_token],
        token_expires_at: result[:expires_at],
        connection_status: "connected"
      )
      true
    else
      mark_error!(result[:error])
      false
    end
  rescue StandardError => e
    mark_error!(e.message)
    false
  end

  private

  def create_connection_activity
    return unless company.present?

    company.company_activities.create!(
      activity_type: "xero_connected",
      description: "Xero organization connected: #{xero_tenant_name}",
      metadata: { xero_tenant_id: xero_tenant_id, xero_tenant_name: xero_tenant_name },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  rescue StandardError => e
    Rails.logger.error("Failed to create xero connection activity: #{e.message}")
  end
end

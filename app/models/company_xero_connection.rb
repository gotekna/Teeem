class CompanyXeroConnection < ApplicationRecord
  # Associations
  belongs_to :company
  has_many :company_xero_accounts, dependent: :destroy

  # Encrypted attributes
  encrypts :encrypted_access_token
  encrypts :encrypted_refresh_token

  # Validations
  validates :xero_tenant_id, presence: true, uniqueness: true
  validates :connection_status, inclusion: { in: %w[connected disconnected error] }

  # Scopes
  scope :connected, -> { where(connection_status: 'connected') }
  scope :disconnected, -> { where(connection_status: 'disconnected') }
  scope :with_errors, -> { where(connection_status: 'error') }
  scope :needs_sync, -> { where('last_sync_at IS NULL OR last_sync_at < ?', 7.days.ago) }

  # Callbacks
  after_create :create_connection_activity

  # Instance methods
  def connected?
    connection_status == 'connected'
  end

  def token_expired?
    token_expires_at.present? && token_expires_at <= 5.minutes.from_now
  end

  def needs_refresh?
    token_expired?
  end

  def access_token
    # Decrypt and return access token
    encrypted_access_token
  end

  def access_token=(value)
    self.encrypted_access_token = value
  end

  def refresh_token
    # Decrypt and return refresh token
    encrypted_refresh_token
  end

  def refresh_token=(value)
    self.encrypted_refresh_token = value
  end

  def mark_disconnected!(error_message = nil)
    update!(
      connection_status: 'disconnected',
      last_sync_error: error_message
    )

    company.company_activities.create!(
      activity_type: 'xero_disconnected',
      description: "Xero connection disconnected#{error_message.present? ? ": #{error_message}" : ''}",
      metadata: { xero_tenant_id: xero_tenant_id },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  end

  def mark_error!(error_message)
    update!(
      connection_status: 'error',
      last_sync_error: error_message
    )
  end

  def sync_successful!
    update!(
      connection_status: 'connected',
      last_sync_at: Time.current,
      last_sync_error: nil
    )
  end

  def days_since_last_sync
    return nil unless last_sync_at.present?
    ((Time.current - last_sync_at) / 1.day).to_i
  end

  private

  def create_connection_activity
    company.company_activities.create!(
      activity_type: 'xero_connected',
      description: "Xero organization connected: #{xero_tenant_name}",
      metadata: { xero_tenant_id: xero_tenant_id, xero_tenant_name: xero_tenant_name },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  end
end

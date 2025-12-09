class XeroCredential < ApplicationRecord
  # Associations - SSoT for OAuth tokens
  has_many :corporate_company_xero_connections, dependent: :nullify, foreign_key: :xero_credential_id

  # Encrypt sensitive OAuth tokens
  encrypts :access_token
  encrypts :refresh_token

  validates :access_token, :refresh_token, :expires_at, :tenant_id, presence: true

  # Scopes
  scope :primary, -> { where(is_primary: true) }

  # Callbacks
  after_create :set_as_primary_if_none_exists

  # Get the current (primary or latest) active credential
  # Priority: 1) Primary credential, 2) Most recent credential
  def self.current
    primary.first || order(created_at: :desc).first
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
    expires_at <= 5.minutes.from_now
  end

  # Check if Xero is currently connected
  def self.connected?
    current.present?
  end

  private

  # Automatically set as primary if no other primary exists
  def set_as_primary_if_none_exists
    if XeroCredential.where.not(id: id).primary.none?
      update_column(:is_primary, true)
    end
  end
end

# frozen_string_literal: true

# CloudflareCredential - Stores Cloudflare API credentials for DNS management
#
# Used by the email reseller feature to auto-provision DNS records when
# new email subscriptions are created.
#
# SSoT: Single Tekna Cloudflare account manages all client domains.
# Only one active credential per organization.
#
class CloudflareCredential < ApplicationRecord
  belongs_to :organization

  # Encrypt sensitive API token
  encrypts :api_token

  # Validations
  validates :api_token, presence: true
  validates :account_id, presence: true
  validates :organization_id, uniqueness: { conditions: -> { where(is_active: true) },
                                             message: "already has an active Cloudflare credential" }

  # Status enum
  enum :status, {
    pending: 0,
    connected: 1,
    error: 2
  }, prefix: true

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :connected, -> { active.where(status: :connected) }

  # Callbacks
  before_create :set_default_status

  # Class methods
  class << self
    # Get the active credential for an organization
    # @param organization [Organization] Organization to get credential for (optional)
    # @return [CloudflareCredential, nil]
    def active_credential(organization = nil)
      scope = active
      scope = scope.where(organization: organization) if organization
      scope.first
    end

    # Check if Cloudflare is configured
    def configured?
      active.connected.exists?
    end
  end

  # Instance methods

  # Mark as connected after successful API test
  def mark_connected!
    update!(
      status: :connected,
      last_connected_at: Time.current,
      error_message: nil
    )
  end

  # Mark as error with message
  def mark_error!(message)
    update!(
      status: :error,
      last_error_at: Time.current,
      error_message: message
    )
  end

  # Deactivate this credential
  def deactivate!
    update!(is_active: false)
  end

  private

  def set_default_status
    self.status ||= :pending
  end
end

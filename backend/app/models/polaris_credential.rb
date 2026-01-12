# frozen_string_literal: true

# PolarisCredential - API credentials for PolarisMail reseller integration
#
# Stores encrypted API keys for communicating with PolarisMail's reseller API.
# Pattern follows MicrosoftCredential for consistency.
#
# Usage:
#   credential = PolarisCredential.active_for_org(organization)
#   service = PolarisMailService.new(credential)
#   service.create_account(domain: "example.com", ...)
#
class PolarisCredential < ApplicationRecord
  belongs_to :organization

  # Encrypt API credentials
  encrypts :api_key
  encrypts :api_secret

  # Constants
  STATUSES = %w[pending connected error disconnected].freeze

  # Validations
  validates :api_key, :api_secret, presence: true
  validates :organization_id, uniqueness: { conditions: -> { where(is_active: true) } }
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :connected, -> { active.where(status: "connected") }
  scope :for_org, ->(org) { where(organization: org) }

  # SSoT: Organization-scoped lookup
  def self.active_for_org(organization)
    for_org(organization).active.connected.first
  end

  # Connection testing
  def test_connection!
    service = PolarisMailService.new(self)
    if service.test_connection
      update!(
        status: "connected",
        error_message: nil,
        last_connected_at: Time.current
      )
      true
    else
      mark_error!("Connection test failed")
      false
    end
  rescue StandardError => e
    mark_error!(e.message)
    false
  end

  def mark_error!(message)
    update!(
      status: "error",
      error_message: message[0..500],
      last_error_at: Time.current
    )
  end

  def connected?
    status == "connected" && is_active
  end
end

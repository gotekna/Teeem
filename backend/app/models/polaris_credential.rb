# frozen_string_literal: true

# PolarisCredential - API credentials for PolarisMail reseller integration
#
# Stores encrypted admin credentials for PolarisMail session-based API.
# API endpoint: https://cfcp.emailarray.com/admin/json.php
#
# Usage:
#   credential = PolarisCredential.active_for_tenant(tenant)
#   service = PolarisMailService.new(credential)
#   service.create_mailbox(domain: "example.com", username: "john", ...)
#
# SSoT (Feb 2026): Uses Tenant for isolation, Organization deprecated.
#
class PolarisCredential < ApplicationRecord
  # SSoT (Feb 2026): Tenant is THE ONE for multi-tenancy isolation
  belongs_to :tenant
  # DEPRECATED: Organization - kept for backwards compatibility
  belongs_to :organization, optional: true

  # Encrypt credentials (stored as api_key/api_secret for DB compatibility)
  encrypts :api_key      # Admin username
  encrypts :api_secret   # Admin password

  # Alias methods for clarity
  alias_attribute :admin_username, :api_key
  alias_attribute :admin_password, :api_secret

  # Constants
  STATUSES = %w[pending connected error disconnected].freeze

  # Validations
  validates :api_key, :api_secret, presence: true
  validates :tenant_id, uniqueness: { conditions: -> { where(is_active: true) } }
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :connected, -> { active.where(status: "connected") }
  # SSoT (Feb 2026): Tenant-scoped lookup
  scope :for_tenant, ->(tenant) { where(tenant: tenant) }
  # DEPRECATED: Use for_tenant instead
  scope :for_org, ->(org) { where(tenant_id: org.respond_to?(:tenant_id) ? org.tenant_id : org.id) }

  # SSoT (Feb 2026): Tenant-scoped lookup
  def self.active_for_tenant(tenant)
    for_tenant(tenant).active.connected.first
  end

  # DEPRECATED: Use active_for_tenant instead
  def self.active_for_org(organization)
    active_for_tenant(organization)
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

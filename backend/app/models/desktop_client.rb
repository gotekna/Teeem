# frozen_string_literal: true

# DesktopClient - Tracks registered TEEEM Sync desktop clients
#
# Each user can have multiple desktop clients (e.g., work Mac, home Windows)
# Uses device code flow for authentication (no browser redirect needed)
#
# SSoT (Feb 2026): Uses Tenant for isolation, Organization deprecated.
#
class DesktopClient < ApplicationRecord
  belongs_to :user
  # SSoT (Feb 2026): Tenant is THE ONE for multi-tenancy isolation
  belongs_to :tenant

  has_many :sync_subscriptions, dependent: :destroy
  has_many :sync_file_states, dependent: :destroy

  # TODO: Enable encryption when AR encryption is configured
  # encrypts :refresh_token

  # Validations
  validates :device_id, presence: true, uniqueness: { scope: :user_id }
  validates :device_name, presence: true
  validates :platform, inclusion: { in: %w[macos windows], allow_nil: true }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :inactive, -> { where(is_active: false) }
  scope :for_user, ->(user) { where(user: user) }
  # SSoT (Feb 2026): Tenant-scoped lookup
  scope :for_tenant, ->(tenant) { where(tenant: tenant) }
  scope :recently_seen, -> { where("last_seen_at > ?", 7.days.ago) }
  scope :stale, -> { where("last_seen_at < ? OR last_seen_at IS NULL", 30.days.ago) }

  # Device code authentication flow
  DEVICE_CODE_EXPIRY = 15.minutes
  DEVICE_CODE_LENGTH = 8

  # Generate a device code for authentication
  def self.generate_device_code
    # User-friendly code: 8 uppercase letters/numbers, no ambiguous chars (0, O, I, l)
    chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    Array.new(DEVICE_CODE_LENGTH) { chars[SecureRandom.random_number(chars.length)] }.join
  end

  # Start device code auth flow
  # SSoT (Feb 2026): Uses tenant for multi-tenancy isolation
  def self.initiate_device_auth(user:, tenant:, device_name:, platform:)
    device_id = SecureRandom.uuid
    device_code = generate_device_code

    client = create!(
      user: user,
      tenant: tenant,
      device_id: device_id,
      device_name: device_name,
      platform: platform,
      device_code: device_code,
      device_code_expires_at: DEVICE_CODE_EXPIRY.from_now,
      is_active: false  # Not active until code is verified
    )

    {
      device_code: device_code,
      device_id: device_id,
      expires_in: DEVICE_CODE_EXPIRY.to_i,
      verification_url: "#{Rails.application.config.frontend_url}/device"
    }
  end

  # Find client by device code (for verification)
  def self.find_by_device_code(code)
    where(device_code: code.upcase)
      .where("device_code_expires_at > ?", Time.current)
      .where(is_active: false)
      .first
  end

  # Complete device code auth and activate client
  def activate_with_token!
    refresh_token = SecureRandom.urlsafe_base64(64)

    update!(
      refresh_token: refresh_token,
      token_expires_at: 90.days.from_now,
      device_code: nil,
      device_code_expires_at: nil,
      is_active: true,
      last_seen_at: Time.current
    )

    {
      access_token: generate_access_token,
      refresh_token: refresh_token,
      expires_in: 3600,  # 1 hour
      device_id: device_id
    }
  end

  # Generate short-lived access token (JWT)
  def generate_access_token
    payload = {
      sub: user_id,
      ten: tenant_id,  # SSoT (Feb 2026): tenant_id is THE ONE
      dev: device_id,
      exp: 1.hour.from_now.to_i,
      iat: Time.current.to_i,
      scopes: ["sync:read", "sync:write"]
    }

    JWT.encode(payload, Rails.application.secret_key_base, "HS256")
  end

  # Refresh access token using refresh token
  def refresh_access_token!(provided_refresh_token)
    return nil unless is_active?
    return nil unless refresh_token == provided_refresh_token
    return nil if token_expires_at && token_expires_at < Time.current

    # Extend refresh token expiry
    update!(
      token_expires_at: 90.days.from_now,
      last_seen_at: Time.current
    )

    {
      access_token: generate_access_token,
      expires_in: 3600
    }
  end

  # Record sync activity
  def record_sync!(status:)
    update!(
      last_sync_at: Time.current,
      last_sync_status: status,
      last_seen_at: Time.current
    )
  end

  # Deactivate client (logout)
  def deactivate!
    update!(
      is_active: false,
      refresh_token: nil,
      token_expires_at: nil
    )
  end

  # Check if client needs attention
  def needs_reauth?
    return true unless is_active?
    return true if token_expires_at.nil?
    token_expires_at < 7.days.from_now
  end
end

# frozen_string_literal: true

module Gl
  class ProviderCredential < ApplicationRecord
    self.table_name = 'gl_provider_credentials'

    # ═══════════════════════════════════════════════════════════════
    # ENCRYPTION
    # ═══════════════════════════════════════════════════════════════
    # Use Rails encrypted attributes
    encrypts :access_token_encrypted
    encrypts :refresh_token_encrypted

    # Alias for cleaner access
    alias_attribute :access_token, :access_token_encrypted
    alias_attribute :refresh_token, :refresh_token_encrypted

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company, class_name: "Corporate"

    has_many :sync_logs, class_name: 'Gl::SyncLog', foreign_key: 'gl_provider_credential_id', dependent: :destroy

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    PROVIDERS = %w[xero quickbooks myob].freeze
    STATUSES = %w[pending connected expired error disconnected].freeze
    SYNC_STATUSES = %w[success partial failed].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :provider, presence: true, inclusion: { in: PROVIDERS }
    validates :tenant_id, presence: true
    validates :status, inclusion: { in: STATUSES }
    validates :last_sync_status, inclusion: { in: SYNC_STATUSES }, allow_blank: true
    validates :tenant_id, uniqueness: {
      scope: [:corporate_company_id, :provider],
      message: 'already connected for this provider'
    }

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :active, -> { where(status: 'connected') }
    scope :connected, -> { where(status: 'connected') }
    scope :pending, -> { where(status: 'pending') }
    scope :expired, -> { where(status: 'expired') }
    scope :with_error, -> { where(status: 'error') }
    scope :disconnected, -> { where(status: 'disconnected') }
    scope :sync_enabled, -> { where(sync_enabled: true) }
    scope :two_way_enabled, -> { where(two_way_sync: true) }
    scope :for_provider, ->(provider) { where(provider: provider) }
    scope :xero, -> { where(provider: 'xero') }
    scope :quickbooks, -> { where(provider: 'quickbooks') }
    scope :myob, -> { where(provider: 'myob') }
    scope :needs_refresh, -> {
      where('token_expires_at < ?', 5.minutes.from_now)
        .where(status: 'connected')
    }
    scope :stale_sync, ->(hours = 24) {
      where('last_sync_at < ? OR last_sync_at IS NULL', hours.hours.ago)
        .connected
        .sync_enabled
    }

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Status checks
    def pending?
      status == 'pending'
    end

    def connected?
      status == 'connected'
    end

    def expired?
      status == 'expired'
    end

    def error?
      status == 'error'
    end

    def disconnected?
      status == 'disconnected'
    end

    # Token management
    def token_expired?
      return true unless token_expires_at

      token_expires_at < Time.current
    end

    def token_expiring_soon?
      return true unless token_expires_at

      token_expires_at < 5.minutes.from_now
    end

    def refresh_if_needed!
      return unless token_expiring_soon?

      refresh_token!
    end

    def refresh_token!
      # This would be implemented by the adapter
      # For now, just mark as expired
      update!(status: 'expired') if token_expired?
    end

    # Connection management
    def connect!(access_token:, refresh_token:, expires_at:)
      update!(
        access_token_encrypted: access_token,
        refresh_token_encrypted: refresh_token,
        token_expires_at: expires_at,
        status: 'connected',
        connected_at: Time.current,
        error_message: nil
      )
    end

    def disconnect!
      update!(
        status: 'disconnected',
        disconnected_at: Time.current,
        access_token_encrypted: nil,
        refresh_token_encrypted: nil
      )
    end

    def mark_error!(message)
      update!(
        status: 'error',
        error_message: message
      )
    end

    def mark_expired!
      update!(status: 'expired')
    end

    # Sync tracking
    def record_sync!(status:, sync_type: 'incremental')
      update!(
        last_sync_at: Time.current,
        last_sync_status: status
      )
      update!(last_full_sync_at: Time.current) if sync_type == 'full'
    end

    def needs_sync?(hours = 1)
      return true unless last_sync_at

      last_sync_at < hours.hours.ago
    end

    def needs_full_sync?(days = 7)
      return true unless last_full_sync_at

      last_full_sync_at < days.days.ago
    end

    # Settings helpers
    def sync_setting(key, default: nil)
      sync_settings.dig(key.to_s) || default
    end

    def set_sync_setting(key, value)
      self.sync_settings = sync_settings.merge(key.to_s => value)
      save!
    end

    # Provider-specific helpers
    def xero?
      provider == 'xero'
    end

    def quickbooks?
      provider == 'quickbooks'
    end

    def myob?
      provider == 'myob'
    end

    # Display helpers
    def display_name
      tenant_name.presence || "#{provider.titleize} - #{tenant_id}"
    end

    def status_badge
      case status
      when 'connected' then { text: 'Connected', color: 'green' }
      when 'pending' then { text: 'Pending', color: 'yellow' }
      when 'expired' then { text: 'Expired', color: 'orange' }
      when 'error' then { text: 'Error', color: 'red' }
      when 'disconnected' then { text: 'Disconnected', color: 'gray' }
      else { text: status.titleize, color: 'gray' }
      end
    end

    def provider_icon
      case provider
      when 'xero' then 'xero'
      when 'quickbooks' then 'quickbooks'
      when 'myob' then 'myob'
      else 'default'
      end
    end
  end
end

# SSoT Architecture:
# - OAuth tokens: XeroCredential (access_token, refresh_token, expires_at, status)
# - Sync timing: XeroSyncStatus (last_synced_at, next_sync_at per sync_type)
# - Company mapping: This model (which company links to which Xero tenant)
# - Connection health: XeroConnectionHealth service (THE SSoT for status computation)
#
# DEPRECATED columns on this model (kept for backwards compatibility):
# - connection_status -> Use XeroConnectionHealth.for_company(company) instead
# - last_sync_at -> Use XeroSyncStatus.last_synced_at instead
# - last_sync_error -> Use XeroSyncStatus.last_error instead
#
class CorporateCompanyXeroConnection < ApplicationRecord
  # Associations
  belongs_to :corporate_company, foreign_key: "company_id"
  belongs_to :xero_credential, optional: true  # SSoT for OAuth tokens
  has_many :corporate_company_xero_accounts, foreign_key: "company_xero_connection_id", dependent: :destroy

  # Validations
  validates :xero_tenant_id, presence: true, uniqueness: { scope: :company_id }
  validates :connection_status, inclusion: { in: %w[connected disconnected error pending] }

  # Scopes
  scope :connected, -> { where(connection_status: "connected") }
  scope :disconnected, -> { where(connection_status: "disconnected") }
  scope :with_errors, -> { where(connection_status: "error") }
  # DEPRECATED: Use XeroSyncStatus for sync timing checks instead
  scope :needs_sync, -> { where("last_sync_at IS NULL OR last_sync_at < ?", 7.days.ago) }

  # Callbacks
  after_create :create_connection_activity, if: :connected?
  after_commit :sync_bank_accounts_from_xero, if: :just_connected?

  # Instance methods
  # SSoT: Delegate to XeroConnectionHealth service for unified status
  def connected?
    return false unless xero_credential.present?
    XeroConnectionHealth.for_credential(xero_credential).connected
  end

  # SSoT: Get full health status from XeroConnectionHealth
  def health_status
    return XeroConnectionHealth.disconnected_status("No Xero credential linked") unless xero_credential.present?
    XeroConnectionHealth.for_credential(xero_credential)
  end

  # SSoT: Get display status from unified health
  def display_status
    health_status.display_status
  end

  def token_expired?
    return true unless xero_credential.present?
    xero_credential.expired?
  end

  def needs_refresh?
    xero_credential.present? && token_expired?
  end

  def expired?
    token_expired?
  end

  # Delegate token access to xero_credential (SSoT)
  def access_token
    xero_credential&.access_token
  end

  def refresh_token
    xero_credential&.refresh_token
  end

  def token_expires_at
    xero_credential&.expires_at
  end

  # Link this company to a Xero credential
  def link_to_credential!(credential)
    update!(
      xero_credential: credential,
      xero_tenant_id: credential.tenant_id,
      xero_tenant_name: credential.tenant_name,
      connection_status: "connected",
      last_sync_error: nil
    )

    create_connection_activity
  end

  # For backwards compatibility during migration
  def connect!(access_token:, refresh_token:, expires_at:, tenant_id: nil, tenant_name: nil)
    # Find or create xero_credential (SSoT)
    credential = XeroCredential.find_or_initialize_by(tenant_id: tenant_id || xero_tenant_id)
    credential.assign_attributes(
      access_token: access_token,
      refresh_token: refresh_token,
      expires_at: expires_at,
      tenant_name: tenant_name || xero_tenant_name
    )
    credential.save!

    link_to_credential!(credential)
  end

  def mark_disconnected!(error_message = nil)
    update!(
      connection_status: "disconnected",
      last_sync_error: error_message
    )

    corporate_company.corporate_company_activities.create!(
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

  # SSoT: Delegates sync tracking to XeroSyncStatus
  # The last_sync_at column on this model is DEPRECATED - use XeroSyncStatus instead
  def sync_successful!(sync_type: "invoices")
    # Update local status for connection health only
    update!(
      connection_status: "connected",
      last_sync_at: Time.current,  # DEPRECATED: kept for backwards compatibility
      last_sync_error: nil
    )

    # SSoT: Update the authoritative sync status record
    XeroSyncStatus.complete_sync!(
      sync_type,
      tenant_id: xero_tenant_id,
      records_synced: 0,  # Caller should use XeroSyncStatus.complete_sync! directly with actual count
      next_sync_at: 30.minutes.from_now
    )
  end

  # SSoT: Read from XeroSyncStatus, fallback to deprecated local column
  def days_since_last_sync
    # Try SSoT first
    sync_status = XeroSyncStatus.for_tenant(xero_tenant_id).successful.order(last_synced_at: :desc).first
    last_sync = sync_status&.last_synced_at || last_sync_at  # Fallback to deprecated column
    return nil unless last_sync.present?
    ((Time.current - last_sync) / 1.day).to_i
  end

  # SSoT: Get the actual last sync time from XeroSyncStatus
  def last_synced_at
    sync_status = XeroSyncStatus.for_tenant(xero_tenant_id).successful.order(last_synced_at: :desc).first
    sync_status&.last_synced_at || last_sync_at  # Fallback to deprecated column
  end

  # Refresh tokens using XeroTokenManager - Single Source of Truth
  # XeroTokenManager handles:
  # - 30-minute grace period retry for transient failures
  # - Poisoned token detection
  # - Proactive refresh buffer (15 min before expiry)
  # - PostgreSQL advisory locks for concurrent safety
  def refresh_tokens!
    return false unless xero_credential.present?

    # Delegate directly to XeroTokenManager
    result = XeroTokenManager.refresh_credential(xero_credential)

    if result[:success]
      update!(connection_status: "connected", last_sync_error: nil)
      true
    elsif result[:poisoned]
      # Token is permanently dead - user must reconnect
      mark_error!("Token poisoned - reconnection required: #{result[:error]}")
      false
    else
      mark_error!(result[:error])
      false
    end
  rescue StandardError => e
    mark_error!(e.message)
    false
  end

  private

  # Check if this connection was just connected (status changed to connected)
  def just_connected?
    connected? && saved_change_to_connection_status? && connection_status_before_last_save != "connected"
  end

  # SSoT: Auto-sync bank accounts when Xero connection is established
  def sync_bank_accounts_from_xero
    return unless corporate_company.present? && connected?

    Rails.logger.info("[XeroConnection] Auto-syncing bank accounts for company #{corporate_company.id} after Xero connection")

    begin
      sync_service = XeroBankSyncService.new(corporate_company)
      result = sync_service.sync_bank_accounts(auto_create: true)

      if result[:success]
        Rails.logger.info("[XeroConnection] Auto-synced #{result[:auto_created_count]} bank accounts from Xero for company #{corporate_company.id}")

        # Create activity if any accounts were created
        if result[:auto_created_count] > 0
          corporate_company.corporate_company_activities.create!(
            activity_type: "bank_accounts_synced",
            description: "#{result[:auto_created_count]} bank account(s) auto-synced from Xero",
            metadata: { created_count: result[:auto_created_count], linked_count: result[:auto_linked_count] },
            performed_by: Current.user || User.first,
            occurred_at: Time.current
          )
        end
      else
        Rails.logger.error("[XeroConnection] Failed to sync bank accounts: #{result[:error]}")
      end
    rescue StandardError => e
      Rails.logger.error("[XeroConnection] Error syncing bank accounts from Xero: #{e.message}")
    end
  end

  def create_connection_activity
    return unless corporate_company.present?

    corporate_company.corporate_company_activities.create!(
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

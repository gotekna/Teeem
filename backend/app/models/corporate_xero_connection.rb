# SSoT Architecture:
# - OAuth tokens: XeroCredential (access_token, refresh_token, expires_at, status)
# - Sync timing: XeroSyncStatus (last_synced_at, next_sync_at per sync_type)
# - Company mapping: This model (which company links to which Xero tenant)
# - Connection health: XeroConnectionHealth service (THE SSoT for status computation)
# - Health events: XeroHealthEvent (tracks all state transitions)
#
# REMOVED columns (Phase 4 of SSoT migration):
# - connection_status -> Now computed by XeroConnectionHealth.for_company()
# - last_sync_error -> Now tracked in XeroHealthEvent
#
class CorporateXeroConnection < ApplicationRecord
  acts_as_tenant :tenant  # Multi-tenancy: Auto-scope queries to current tenant

  # Explicit table name since we renamed from corporate_company_xero_connections
  self.table_name = "corporate_xero_connections"

  # Associations
  belongs_to :tenant
  belongs_to :corporate, foreign_key: "company_id"
  belongs_to :xero_credential, optional: true  # SSoT for OAuth tokens
  has_many :corporate_xero_accounts, foreign_key: "corporate_xero_connection_id", dependent: :destroy
  alias_method :company, :corporate

  # Validations
  validates :xero_tenant_id, presence: true, uniqueness: { scope: :company_id }

  # Scopes - SSoT: Use health service for status filtering
  scope :with_credential, -> { where.not(xero_credential_id: nil) }
  # DEPRECATED: Use XeroSyncStatus for sync timing checks instead
  scope :needs_sync, -> { where("last_sync_at IS NULL OR last_sync_at < ?", 7.days.ago) }

  # Callbacks
  after_create :create_connection_activity, if: :connected?
  after_commit :sync_bank_accounts_from_xero, if: :just_linked?

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
    was_unlinked = xero_credential_id.nil?

    update!(
      xero_credential: credential,
      xero_tenant_id: credential.tenant_id,
      xero_tenant_name: credential.tenant_name
    )

    # Log the connection event
    XeroHealthEvent.log_status_change(
      credential,
      from: "disconnected",
      to: "connected",
      trigger: "link_to_credential",
      message: "Company #{corporate&.name} linked to Xero org #{credential.tenant_name}"
    )

    create_connection_activity if was_unlinked
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
    # Log the disconnect event
    if xero_credential.present?
      XeroHealthEvent.log_status_change(
        xero_credential,
        from: display_status,
        to: "disconnected",
        trigger: "mark_disconnected",
        message: error_message || "Connection disconnected"
      )
    end

    corporate.corporate_activities.create!(
      activity_type: "xero_disconnected",
      description: "Xero connection disconnected#{error_message.present? ? ": #{error_message}" : ''}",
      metadata: { xero_tenant_id: xero_tenant_id },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  end

  def mark_error!(error_message)
    # Log the error event
    if xero_credential.present?
      XeroHealthEvent.log_self_heal_failed(
        xero_credential,
        strategy: "mark_error",
        error: error_message
      )
    end
  end

  # SSoT: Delegates sync tracking to XeroSyncStatus
  def sync_successful!(sync_type: "invoices")
    # Update local timestamp for backwards compatibility
    update!(last_sync_at: Time.current)

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
  def refresh_tokens!
    return false unless xero_credential.present?

    start_time = Time.current

    # Log self-heal started
    XeroHealthEvent.log_self_heal_started(xero_credential, strategy: "token_refresh")

    # Delegate directly to XeroTokenManager
    result = XeroTokenManager.refresh_credential(xero_credential)

    duration_ms = ((Time.current - start_time) * 1000).to_i

    if result[:success]
      XeroHealthEvent.log_self_heal_completed(
        xero_credential,
        strategy: "token_refresh",
        duration_ms: duration_ms
      )
      true
    elsif result[:poisoned]
      # Token is permanently dead - user must reconnect
      XeroHealthEvent.log_token_poisoned(xero_credential, reason: result[:error])
      false
    else
      XeroHealthEvent.log_self_heal_failed(
        xero_credential,
        strategy: "token_refresh",
        error: result[:error]
      )
      false
    end
  rescue StandardError => e
    XeroHealthEvent.log_self_heal_failed(
      xero_credential,
      strategy: "token_refresh",
      error: e.message
    )
    false
  end

  private

  # Check if this connection just got a credential linked
  def just_linked?
    saved_change_to_xero_credential_id? && xero_credential_id_before_last_save.nil? && xero_credential_id.present?
  end

  # SSoT: Auto-sync bank accounts when Xero connection is established
  def sync_bank_accounts_from_xero
    return unless corporate.present? && connected?

    Rails.logger.info("[XeroConnection] Auto-syncing bank accounts for company #{corporate.id} after Xero connection")

    begin
      sync_service = XeroBankSyncService.new(corporate)
      result = sync_service.sync_bank_accounts(auto_create: true)

      if result[:success]
        Rails.logger.info("[XeroConnection] Auto-synced #{result[:auto_created_count]} bank accounts from Xero for company #{corporate.id}")

        # Create activity if any accounts were created
        if result[:auto_created_count] > 0
          corporate.corporate_activities.create!(
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
    return unless corporate.present?

    corporate.corporate_activities.create!(
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

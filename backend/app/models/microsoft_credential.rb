# frozen_string_literal: true

# MicrosoftCredential - Unified Single Source of Truth for all Microsoft/SharePoint credentials
#
# Replaces legacy credential models (all removed as of Jan 2026):
# - OrganizationMicrosoftAppCredential (app credentials - client credentials flow)
# - OrganizationSharePointCredential (org-level delegated)
# - OrganizationOutlookCredential (org-level delegated)
# - UserMicrosoftToken (user-level delegated)
# - UserOutlookCredential (user-level delegated, removed Dec 2024)
# - OneDriveCredential (per-job delegated, removed Jan 2026 - 0 records in prod)
#
# NAMING POLICY (SSoT):
# - Internal (code): MicrosoftCredential, MicrosoftGraphClient
# - External (UI/messages): Always say "SharePoint" to users, never "OneDrive"
#
# SSoT (Feb 2026): Uses Tenant for isolation, Organization deprecated.
#
class MicrosoftCredential < ApplicationRecord
  include CacheConstants

  # SSoT (Feb 2026): Tenant is THE ONE for multi-tenancy isolation
  belongs_to :tenant
  # DEPRECATED: Organization - kept for backwards compatibility during migration
  belongs_to :organization, optional: true

  # Polymorphic ownership - optional for org-level credentials
  belongs_to :owner, polymorphic: true, optional: true
  belongs_to :setup_by, class_name: "User", optional: true
  belongs_to :connected_by, class_name: "User", optional: true

  # Allowed polymorphic types for owner (security: prevents arbitrary type injection)
  ALLOWED_OWNER_TYPES = %w[User Construction].freeze

  # Encrypt ALL tokens and secrets (SSoT - fixes UserMicrosoftToken security gap)
  encrypts :client_secret
  encrypts :access_token
  encrypts :refresh_token

  # Constants
  CREDENTIAL_TYPES = %w[app delegated].freeze
  STATUSES = %w[pending connected error dead disconnected].freeze

  # SSoT: Get organization names dynamically from database (Jan 2026)
  # No hardcoded org names - reads from configured app credentials
  def self.known_org_names
    app_credentials.distinct.pluck(:name).compact.reject(&:blank?)
  end

  # DEPRECATED: Use known_org_names method instead
  # Kept for backwards compatibility during transition
  KNOWN_ORG_NAMES = [].freeze

  # UNIFIED refresh buffer - 20 minutes (SSoT - same everywhere)
  # Microsoft access tokens typically expire after 60 minutes
  # Buffer MUST be larger than job interval (15 min) to prevent timing gaps
  REFRESH_BUFFER = 20.minutes

  # Required scopes for delegated credentials
  REQUIRED_SCOPES = %w[
    openid
    profile
    email
    offline_access
    Mail.Read
    Files.ReadWrite.All
    Sites.ReadWrite.All
  ].freeze

  # AADSTS error codes indicating refresh token is permanently dead
  # Requires user to re-authenticate via OAuth flow
  DEAD_TOKEN_ERROR_CODES = %w[
    AADSTS65001
    AADSTS70000
    AADSTS70008
    AADSTS54005
    invalid_grant
  ].freeze

  # Validations
  validates :credential_type, presence: true, inclusion: { in: CREDENTIAL_TYPES }
  validates :status, inclusion: { in: STATUSES }
  validates :name, uniqueness: { scope: :is_active, conditions: -> { where(is_active: true) } },
                   allow_nil: true
  # Note: azure_tenant_id is the Microsoft/Azure tenant ID (string), not our internal tenant_id (bigint)
  validates :client_id, :client_secret, :azure_tenant_id, presence: true, if: :app_credential?
  validates :owner_type, inclusion: { in: ALLOWED_OWNER_TYPES }, allow_nil: true

  # Callbacks
  # Auto-set is_primary on first app credential for a tenant so users' own
  # mailboxes are auto-included without manual configuration
  before_create :auto_set_primary

  # Scopes
  scope :active, -> { where(is_active: true) }
  # SSoT: "configured" = has been connected (status field only)
  # Use this when you just need to know if credential was ever set up
  scope :configured, -> { active.where(status: "connected") }
  # SSoT: "connected" = actually usable RIGHT NOW (status + valid token)
  # This matches the connected? instance method - both check token expiry
  # All code using .connected scope now correctly filters out expired tokens
  scope :connected, -> { configured.where("token_expires_at > ?", Time.current) }
  scope :app_credentials, -> { where(credential_type: "app") }
  scope :delegated_credentials, -> { where(credential_type: "delegated") }
  scope :for_user, ->(user) { where(owner_type: "User", owner_id: user.id) }
  scope :for_construction, ->(construction) { where(owner_type: "Construction", owner_id: construction.id) }
  scope :org_level, -> { where(owner_type: nil) }
  scope :needs_refresh, -> { where("token_expires_at < ?", REFRESH_BUFFER.from_now) }
  scope :alive, -> { where(refresh_token_dead: false) }
  scope :dead, -> { where(refresh_token_dead: true) }
  # REMOVED: with_sharepoint scope - columns removed in Phase 5
  # Use WarehouseProvider.instance.connected? instead to check if SharePoint is configured
  # The scope was: where.not(sharepoint_site_id: nil).where.not(sharepoint_drive_id: nil)

  # SSoT (Feb 2026): Tenant-scoped credential lookup - ALWAYS use these instead of .first
  scope :for_tenant, ->(tenant) { where(tenant: tenant) }
  # DEPRECATED: Use for_tenant instead
  scope :for_org, ->(org) { where(tenant_id: org.respond_to?(:tenant_id) ? org.tenant_id : org.id) }

  # Filter scopes (extracted from controllers)
  scope :for_organization, ->(org_ids) { where(organization_id: Array(org_ids)) if org_ids.present? }
  scope :with_status, ->(status) { where(status: status) if status.present? }

  # Refreshable = can get a valid token (even if current token is expired)
  # - App credentials: always refreshable (just need client_id/secret)
  # - Delegated credentials: refreshable if refresh_token not dead
  # FRC (Feb 2026): Using .connected scope here caused 24/7 email failure - tokens that
  # expired overnight were not found, even though they could be refreshed on-demand.
  scope :refreshable_app, -> { active.app_credentials.where.not(status: %w[dead disconnected]) }
  scope :refreshable_delegated, -> { active.delegated_credentials.alive.where.not(status: %w[dead disconnected]) }

  # Get active app credential for a specific organization
  # FRC (Feb 2026): Changed from .connected to .refreshable_app - app credentials can
  # ALWAYS get a new token via fetch_app_token!, so expired token != unusable credential
  def self.active_for_org(organization)
    for_org(organization).refreshable_app.first
  end

  # Get active delegated credential for a specific organization
  # FRC (Feb 2026): Changed from .connected to .refreshable_delegated - delegated credentials
  # can refresh if refresh_token is not dead, even if access_token expired
  def self.delegated_for_org(organization)
    for_org(organization).refreshable_delegated.first
  end

  # Type predicates
  def app_credential?
    credential_type == "app"
  end

  def delegated_credential?
    credential_type == "delegated"
  end

  # Token management - unified across both types
  def token_expired?
    return true if token_expires_at.nil?
    token_expires_at <= REFRESH_BUFFER.from_now
  end

  alias_method :needs_refresh?, :token_expired?

  def valid_credential?
    access_token.present? && !token_expired? && status == "connected"
  end

  def connected?
    status == "connected" && access_token.present? && !token_expired?
  end

  # Get a valid access token, refreshing/fetching if needed
  def valid_access_token
    if app_credential?
      fetch_app_token! if token_expired?
    else
      refresh_delegated_token! if token_expired? && !refresh_token_dead?
    end
    access_token
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error "[MicrosoftCredential] Decryption error: #{e.message}"
    mark_error!("Token decryption failed - reconnection required")
    nil
  end

  # App credential: fetch new token (client credentials flow)
  # Wrapped in transaction to ensure atomic update of all token fields
  def fetch_app_token!
    return false unless app_credential?

    response = HTTP.post(
      "https://login.microsoftonline.com/#{azure_tenant_id}/oauth2/v2.0/token",
      form: {
        client_id: client_id,
        client_secret: client_secret,
        scope: MicrosoftGraphBase::GRAPH_DEFAULT_SCOPE,
        grant_type: "client_credentials"
      }
    )

    if response.status.success?
      data = response.parse
      # Transaction ensures all token fields are updated atomically
      # FRC (Feb 2026): MUST reset refresh_token_dead on success!
      # Root cause: fetch_app_token! was setting status="connected" but leaving
      # refresh_token_dead=true, causing MicrosoftAppGraphClient to raise DeadTokenError
      # while UI showed green "Connected". This silently broke email sync for 5 days.
      transaction do
        update!(
          access_token: data["access_token"],
          token_expires_at: Time.current + data["expires_in"].to_i.seconds,
          status: "connected",
          error_code: nil,
          error_message: nil,
          consecutive_failures: 0,
          refresh_token_dead: false,
          last_refresh_attempt_at: Time.current
        )
      end
      Rails.logger.info "[MicrosoftCredential] App token fetched for #{name || id}"
      true
    else
      error_msg = "Token fetch failed: #{response.status} - #{response.body}"
      record_refresh_failure!(error_msg)
      false
    end
  rescue ActiveRecord::StaleObjectError
    # FRC (Jan 2026): Another process refreshed the token concurrently
    # Reload to get the fresh token - don't record as failure
    reload
    if valid_credential?
      Rails.logger.info "[MicrosoftCredential] Token already refreshed by another process for #{name || id}"
      true
    else
      # Token still invalid after reload - actual failure
      record_refresh_failure!("Concurrent token refresh failed")
      false
    end
  rescue StandardError => e
    record_refresh_failure!(e.message)
    false
  end

  # Delegated credential: refresh token
  # Wrapped in transaction to ensure atomic update of all token fields
  def refresh_delegated_token!
    return false unless delegated_credential?
    return false if refresh_token.blank?
    return false if refresh_token_dead?

    response = HTTP.post(
      "https://login.microsoftonline.com/#{azure_tenant_id.presence || MicrosoftGraphBase::AZURE_DEFAULT_TENANT}/oauth2/v2.0/token",
      form: {
        client_id: ENV["OUTLOOK_CLIENT_ID"],
        client_secret: ENV["OUTLOOK_CLIENT_SECRET"],
        refresh_token: refresh_token,
        grant_type: "refresh_token",
        scope: scopes.presence || REQUIRED_SCOPES.join(" ")
      }
    )

    if response.status.success?
      data = response.parse
      # Transaction ensures all token fields are updated atomically
      # Prevents partial updates that could leave credential in unusable state
      transaction do
        update!(
          access_token: data["access_token"],
          refresh_token: data["refresh_token"] || refresh_token,
          token_expires_at: Time.current + data["expires_in"].to_i.seconds,
          scopes: data["scope"],
          status: "connected",
          error_code: nil,
          error_message: nil,
          consecutive_failures: 0,
          refresh_token_dead: false,
          last_refresh_attempt_at: Time.current
        )
      end
      Rails.logger.info "[MicrosoftCredential] Token refreshed for #{owner_type}##{owner_id || name}"
      true
    else
      error_data = response.parse rescue {}
      error_msg = error_data["error_description"] || error_data["error"] || "Token refresh failed"
      record_refresh_failure!(error_msg)
      false
    end
  rescue ActiveRecord::StaleObjectError
    # FRC (Jan 2026): Another process refreshed the token concurrently
    # Reload to get the fresh token - don't record as failure
    reload
    if valid_credential?
      Rails.logger.info "[MicrosoftCredential] Token already refreshed by another process for #{owner_type}##{owner_id || name}"
      true
    else
      record_refresh_failure!("Concurrent token refresh failed")
      false
    end
  rescue StandardError => e
    record_refresh_failure!(e.message)
    false
  end

  # Alias for backward compatibility with UserMicrosoftToken
  alias_method :refresh_access_token!, :refresh_delegated_token!

  # Dead token detection
  def dead_token_error?(error_message)
    return false if error_message.blank?
    DEAD_TOKEN_ERROR_CODES.any? { |code| error_message.to_s.include?(code) }
  end

  # Error tracking
  def mark_error!(message)
    update!(
      status: "error",
      error_message: message,
      last_error_at: Time.current
    )
  end

  def mark_dead!(error_message = nil)
    update!(
      refresh_token_dead: true,
      status: "dead",
      error_code: extract_error_code(error_message),
      error_message: error_message,
      last_error_at: Time.current,
      last_refresh_attempt_at: Time.current
    )
    Rails.logger.warn "[MicrosoftCredential] Marked as dead: #{owner_type}##{owner_id || name} - #{error_message}"
  end

  def record_refresh_failure!(error_message)
    new_count = (consecutive_failures || 0) + 1

    if dead_token_error?(error_message)
      mark_dead!(error_message)
    else
      update!(
        consecutive_failures: new_count,
        error_message: error_message,
        last_error_at: Time.current,
        last_refresh_attempt_at: Time.current,
        status: "error"
      )
    end
  end

  def record_refresh_success!
    update!(
      consecutive_failures: 0,
      refresh_token_dead: false,
      error_code: nil,
      error_message: nil,
      last_refresh_attempt_at: Time.current,
      status: "connected"
    )
  end

  # Reconnection helpers (for frontend display)
  def reconnect_reason
    return nil unless refresh_token_dead? || status.in?(%w[error dead])

    case
    when error_message&.include?("AADSTS65001") then "consent_revoked"
    when error_message&.include?("AADSTS70008") then "token_expired"
    when error_message&.include?("AADSTS70000") then "grant_revoked"
    when refresh_token_dead? then "refresh_token_dead"
    else "unknown_error"
    end
  end

  # Mark as connected after successful OAuth
  def mark_connected!(tokens)
    update!(
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      token_expires_at: Time.current + tokens[:expires_in].to_i.seconds,
      scopes: tokens[:scope],
      email: tokens[:email],
      status: "connected",
      error_code: nil,
      error_message: nil,
      refresh_token_dead: false,
      consecutive_failures: 0,
      connected_by_id: tokens[:connected_by_id]
    )
  end

  # Mark as having admin consent (for app credentials)
  def mark_admin_consent!(admin_email)
    update!(
      admin_consent_granted_at: Time.current,
      admin_consent_granted_by: admin_email,
      status: "connected"
    )
  end

  # Disconnect
  def disconnect!
    update!(
      access_token: nil,
      refresh_token: nil,
      token_expires_at: nil,
      status: "disconnected",
      is_active: false,
      error_code: nil,
      error_message: nil
    )
  end

  # Deactivate (soft delete)
  def deactivate!
    update!(is_active: false)
  end

  # Find by name (for multi-org support)
  def self.find_by_name(name)
    active.find_by(name: name)
  end

  # Backward compatibility with OrganizationMicrosoftAppCredential
  # WARNING: Prefer active_for_org(org) for proper org isolation
  # FRC (Feb 2026): Changed from .connected to .refreshable_app for 24/7 availability
  def self.active_credential
    refreshable_app.first
  end

  # Get all active app credentials (for admin lists)
  def self.active_credentials
    app_credentials.active.order(:name)
  end

  # SSoT: SharePoint credential lookup (replaces OrganizationSharePointCredential.active_credential)
  # Tries delegated credentials first (user OAuth), then app credentials (client credentials)
  # FRC (Feb 2026): Changed from .connected to .refreshable_* for 24/7 availability
  # FRC (Feb 2026): Must be tenant-scoped to prevent cross-tenant credential leaks
  def self.sharepoint_credential
    scope = if ActsAsTenant.current_tenant
              for_tenant(ActsAsTenant.current_tenant)
            else
              all
            end
    scope.refreshable_delegated.org_level.first || scope.refreshable_app.first
  end

  # SharePoint configuration helpers
  # SSoT: Now uses WarehouseProvider for site_id/drive_id (Jan 2026)
  # MicrosoftCredential only provides the authentication credential
  # No hardcoded org names - configuration is tenant-specific
  def self.sharepoint_config
    storage_config = WarehouseProvider.instance
    return nil unless storage_config&.connected?

    {
      site_id: storage_config.site_id,
      drive_id: storage_config.drive_id,
      drive_name: storage_config.drive_name,
      credential: sharepoint_credential
    }
  end

  # DEPRECATED: Use sharepoint_config instead (Jan 2026)
  def self.teeem_sharepoint_config
    sharepoint_config
  end

  # Check if SharePoint is configured (SSoT: WarehouseProvider)
  def self.sharepoint_configured?
    WarehouseProvider.instance&.connected? && sharepoint_credential.present?
  end

  # ╔════════════════════════════════════════════════════════════════════════╗
  # ║  DEPRECATED: Storage Delegation Methods (Jan 2026)                      ║
  # ║                                                                         ║
  # ║  These methods delegate to WarehouseProvider for backward compat.   ║
  # ║  NEW CODE SHOULD USE WarehouseProvider.instance.* DIRECTLY!          ║
  # ║                                                                         ║
  # ║  Example:                                                               ║
  # ║    ❌ credential.drive_id                                               ║
  # ║    ✅ WarehouseProvider.instance.drive_id                            ║
  # ╚════════════════════════════════════════════════════════════════════════╝

  # @deprecated Use WarehouseProvider.instance.drive_id instead
  def drive_id
    ActiveSupport::Deprecation.warn(
      "MicrosoftCredential#drive_id is deprecated. Use WarehouseProvider.instance.drive_id instead.",
      caller(1)
    )
    WarehouseProvider.instance&.drive_id
  end

  # @deprecated Use WarehouseProvider.instance.site_id instead
  def site_id
    ActiveSupport::Deprecation.warn(
      "MicrosoftCredential#site_id is deprecated. Use WarehouseProvider.instance.site_id instead.",
      caller(1)
    )
    WarehouseProvider.instance&.site_id
  end

  # @deprecated Use WarehouseProvider.instance.root_folder_id instead
  def root_folder_id
    ActiveSupport::Deprecation.warn(
      "MicrosoftCredential#root_folder_id is deprecated. Use WarehouseProvider.instance.root_folder_id instead.",
      caller(1)
    )
    WarehouseProvider.instance&.root_folder_id
  end

  # @deprecated Use WarehouseProvider.instance.root_folder_path instead
  def root_folder_path
    ActiveSupport::Deprecation.warn(
      "MicrosoftCredential#root_folder_path is deprecated. Use WarehouseProvider.instance.root_folder_path instead.",
      caller(1)
    )
    WarehouseProvider.instance&.root_folder_path
  end

  # Test the connection by making a simple API call
  # IMPORTANT: App credentials (client_credentials) cannot call /me - no user context
  # Use different endpoints based on credential type
  def test_connection!
    if app_credential?
      return false unless fetch_app_token!
      # App credentials: test with /organization endpoint (works without user context)
      test_url = "#{MicrosoftGraphBase::GRAPH_API_BASE}/organization"
    else
      return false unless valid_access_token
      # Delegated credentials: test with /me endpoint (requires user context)
      test_url = "#{MicrosoftGraphBase::GRAPH_API_BASE}/me"
    end

    response = HTTP.auth("Bearer #{access_token}").get(test_url)

    if response.status.success?
      update!(status: "connected", error_message: nil)
      true
    else
      error_body = response.body.to_s rescue ""
      mark_error!("API test failed: #{response.status} - #{error_body.truncate(200)}")
      false
    end
  rescue StandardError => e
    mark_error!(e.message)
    false
  end

  # Get list of users in the tenant (for sync configuration and mailbox access)
  # Returns array of { id:, name:, email:, account_enabled:, has_license:, license_names:, mailbox_type: } hashes
  # PERFORMANCE: Cached for 1 hour to avoid slow Graph API calls on every navigation request
  # Tenant user lists rarely change, and cache is cleared when tenant is modified
  def list_tenant_users
    return [] unless status == "connected"

    # Cache tenant users for 1 hour - tenant user list rarely changes
    # This fixes slow navigation requests (was 2-4 seconds due to Graph API latency)
    # P95 was 3.8s when cache expired every 10 min; 1 hour reduces cache miss frequency 6x
    cache_key = "microsoft_credential:#{id}:tenant_users:v5"
    Rails.cache.fetch(cache_key, expires_in: CACHE_TTL_HOURLY) do
      fetch_tenant_users_from_api
    end
  end

  # Clear the cached tenant users (call when tenant changes)
  def clear_tenant_users_cache
    Rails.cache.delete("microsoft_credential:#{id}:tenant_users:v5")
  end

  private

  # Common Microsoft 365 license SKU GUIDs → friendly names
  MICROSOFT_LICENSE_SKUS = {
    "6fd2c87f-b296-42f0-b197-1e91e994b900" => "E3",
    "c7df2760-2c81-4ef7-b578-5b5392b571df" => "E5",
    "18181a46-0d4e-45cd-891e-60aabd171b4e" => "E1",
    "3b555118-da6a-4418-894f-7df1e2096870" => "Business Basic",
    "f245ecc8-75af-4f8e-b61f-27d8114de5f3" => "Business Standard",
    "cbdc14ab-d96c-4c30-b9f4-6ada7cdc1d46" => "Business Premium",
    "4b585984-651b-4235-8c1f-00b8f0e4c18d" => "Exchange Online Plan 2",
    "19ec0d23-8335-4cbd-94ac-6050e30712fa" => "Exchange Online Plan 1",
    "05e9a617-0261-4cee-bb44-138d3ef5d965" => "E3 (no Teams)",
    "1f2f344a-700d-42c9-9427-5cea45d7c179" => "Business Basic (Teams)",
    "4ef96642-f096-40de-a3e9-d83fb2f90211" => "Defender for Office 365 P1",
    "a403ebcc-fae0-4ca2-8c8c-7a907fd6c235" => "Power BI Free",
    "dcb1a3ae-b33f-4487-846a-a640262fadf4" => "Power BI Pro",
  }.freeze

  def fetch_tenant_users_from_api
    token = valid_access_token
    return [] if token.blank?

    response = HTTP.auth("Bearer #{token}")
                   .get("#{MicrosoftGraphBase::GRAPH_API_BASE}/users?$select=id,displayName,mail,userPrincipalName,assignedLicenses,accountEnabled&$top=999")

    if response.status.success?
      data = response.parse
      data["value"].map do |user|
        raw_licenses = user["assignedLicenses"] || []
        license_names = resolve_license_names(raw_licenses)
        account_enabled = user["accountEnabled"] == true

        {
          id: user["id"],
          name: user["displayName"],
          email: user["mail"] || user["userPrincipalName"],
          account_enabled: account_enabled,
          has_license: raw_licenses.any?,
          license_names: license_names,
          mailbox_type: detect_mailbox_type(user, raw_licenses)
        }
      end
    else
      Rails.logger.error "[MicrosoftCredential] Failed to list users for #{name}: #{response.body}"
      []
    end
  rescue StandardError => e
    Rails.logger.error "[MicrosoftCredential] Error listing users for #{name}: #{e.message}"
    []
  end

  def resolve_license_names(assigned_licenses)
    return [] if assigned_licenses.blank?

    assigned_licenses.filter_map do |lic|
      MICROSOFT_LICENSE_SKUS[lic["skuId"]]
    end.uniq
  end

  def detect_mailbox_type(user, raw_licenses)
    # Shared mailboxes in M365: no licenses + accountEnabled=false + has mail.
    # They can't be signed into directly, so Azure AD disables them.
    # Active users with no licenses (e.g. Riyan) keep accountEnabled=true → "user".
    account_disabled = user["accountEnabled"] == false
    has_mail = user["mail"].present?

    if raw_licenses.empty? && account_disabled && has_mail
      "shared"
    else
      "user"
    end
  end

  def extract_error_code(error_message)
    return nil if error_message.blank?
    DEAD_TOKEN_ERROR_CODES.find { |code| error_message.include?(code) }
  end

  # Auto-set is_primary if this is the first app credential for the tenant.
  # This ensures new tenants auto-include users' own mailboxes (domain match)
  # without requiring manual is_primary configuration.
  def auto_set_primary
    return unless app_credential?
    return if is_primary # Already explicitly set

    existing_primary = MicrosoftCredential.app_credentials
                                          .active
                                          .where(tenant_id: tenant_id)
                                          .where(is_primary: true)
                                          .exists?
    self.is_primary = true unless existing_primary
  end
end

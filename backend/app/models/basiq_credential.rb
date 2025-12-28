# BasiqCredential - Stores Basiq Open Banking connection per organization
#
# SSoT: This is THE SINGLE SOURCE OF TRUTH for Basiq bank feed connections.
#
# Status values:
#   - pending: Basiq user created, awaiting bank consent
#   - connected: Bank successfully connected, ready for transaction sync
#   - error: Connection has an error (see last_error)
#   - disconnected: User revoked consent or connection expired
#
class BasiqCredential < ApplicationRecord
  # Associations
  belongs_to :owner, polymorphic: true

  # Allowed polymorphic types for owner (security: prevents arbitrary type injection)
  ALLOWED_OWNER_TYPES = %w[Organization].freeze

  # Validations
  validates :basiq_user_id, presence: true, uniqueness: true
  validates :status, presence: true, inclusion: { in: %w[pending connected error disconnected] }
  validates :owner_type, inclusion: { in: ALLOWED_OWNER_TYPES }

  # Scopes
  scope :active, -> { where(status: %w[pending connected]) }
  scope :connected, -> { where(status: "connected") }
  scope :pending, -> { where(status: "pending") }
  scope :with_errors, -> { where(status: "error") }

  # For a specific organization
  scope :for_organization, ->(org) { where(owner: org) }

  # ============================================
  # CLASS METHODS
  # ============================================

  # Get or create credential for an organization
  def self.for_org(organization)
    where(owner: organization).first
  end

  # Create a new Basiq connection for an organization
  # @param organization [Organization] - The organization to connect
  # @return [Hash] { success: true, credential: ..., consent_url: ... }
  def self.create_for_org(organization)
    # Check if already exists
    existing = for_org(organization)
    if existing&.connected?
      return { success: false, error: "Organization already has a connected bank feed" }
    end

    client = BasiqClient.new

    # Create Basiq user
    user_result = client.create_user(
      email: "bank-feed-#{organization.id}@teeem.app",
      first_name: organization.name.truncate(50)
    )

    unless user_result[:success]
      return { success: false, error: user_result[:error] }
    end

    # Create or update credential
    credential = existing || new(owner: organization)
    credential.basiq_user_id = user_result[:user_id]
    credential.status = "pending"
    credential.last_error = nil
    credential.save!

    # Create consent request
    redirect_url = Rails.application.routes.url_helpers.api_v1_basiq_callback_url(
      host: ENV["APP_HOST"] || "teeemlive-ce8e2660a615.herokuapp.com",
      protocol: "https"
    )

    consent_result = client.create_consent(user_result[:user_id], redirect_url: redirect_url)

    unless consent_result[:success]
      credential.update!(status: "error", last_error: consent_result[:error])
      return { success: false, error: consent_result[:error] }
    end

    {
      success: true,
      credential: credential,
      consent_url: consent_result[:consent_url],
      consent_id: consent_result[:consent_id]
    }
  rescue StandardError => e
    Rails.logger.error("[BasiqCredential] Failed to create: #{e.message}")
    { success: false, error: e.message }
  end

  # ============================================
  # INSTANCE METHODS
  # ============================================

  def connected?
    status == "connected"
  end

  def pending?
    status == "pending"
  end

  def errored?
    status == "error"
  end

  def disconnected?
    status == "disconnected"
  end

  # Mark as connected after successful bank connection
  def mark_connected!(institution_name: nil, institution_id: nil)
    update!(
      status: "connected",
      connected_institution_name: institution_name,
      connected_institution_id: institution_id,
      last_error: nil,
      last_error_at: nil
    )
  end

  # Mark as error
  def mark_error!(error_message)
    update!(
      status: "error",
      last_error: error_message,
      last_error_at: Time.current
    )
  end

  # Mark as disconnected
  def disconnect!
    update!(
      status: "disconnected",
      last_error: nil
    )
  end

  # Update last sync time
  def record_sync!
    update!(last_sync_at: Time.current)
  end

  # Get Basiq client
  def client
    @client ||= BasiqClient.new
  end

  # Fetch accounts from Basiq
  def fetch_accounts
    return { success: false, error: "Not connected" } unless connected?

    client.list_accounts(basiq_user_id)
  end

  # Fetch transactions from Basiq
  # @param options [Hash] - Filter options (:from, :to, :account_id, :limit)
  def fetch_transactions(options = {})
    return { success: false, error: "Not connected" } unless connected?

    client.list_transactions(basiq_user_id, options)
  end

  # Refresh all connections
  def refresh_connections
    return { success: false, error: "Not connected" } unless connected?

    connections = client.list_connections(basiq_user_id)
    return connections unless connections[:success]

    results = connections[:connections].map do |conn|
      client.refresh_connection(basiq_user_id, conn[:id])
    end

    record_sync!

    { success: true, refreshed: results.count(&:success?) }
  end

  # Revoke consent and disconnect
  def revoke!
    client.delete_user(basiq_user_id)
    disconnect!
    { success: true }
  rescue StandardError => e
    Rails.logger.error("[BasiqCredential] Failed to revoke: #{e.message}")
    disconnect!  # Still mark as disconnected locally
    { success: false, error: e.message }
  end
end

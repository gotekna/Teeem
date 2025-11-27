class AccountingIntegration < ApplicationRecord
  # Associations
  belongs_to :contact
  has_many :subcontractor_invoices, dependent: :nullify
  has_many :account_mappings, dependent: :destroy

  # Enums (Rails 8 syntax)
  enum :system_type, {
    xero: 'xero',
    myob: 'myob',
    quickbooks: 'quickbooks',
    reckon: 'reckon'
  }

  enum :sync_status, {
    active: 'active',
    error: 'error',
    expired: 'expired',
    disconnected: 'disconnected'
  }, prefix: true

  # Validations
  validates :contact_id, presence: true
  validates :system_type, presence: true
  validates :contact_id, uniqueness: { scope: :system_type, message: 'already has an integration for this accounting system' }

  # Callbacks
  before_save :encrypt_tokens
  after_find :decrypt_tokens

  # Scopes
  scope :active, -> { where(sync_status: 'active') }
  scope :needs_refresh, -> { where('token_expires_at < ?', 1.day.from_now) }
  scope :expired, -> { where('token_expires_at < ?', Time.current) }

  # Instance Methods
  def connected?
    oauth_token.present? && !token_expired?
  end

  def token_expired?
    return true unless token_expires_at
    token_expires_at < Time.current
  end

  def needs_refresh?
    return false unless token_expires_at
    token_expires_at < 1.day.from_now
  end

  def refresh_token!
    adapter = AccountingSyncService.adapter_for(self)
    result = adapter.refresh_access_token

    if result[:success]
      update!(
        oauth_token: result[:access_token],
        refresh_token: result[:refresh_token],
        token_expires_at: result[:expires_at],
        sync_status: 'active',
        last_sync_at: Time.current
      )
    else
      update!(sync_status: 'error')
      raise "Token refresh failed: #{result[:error]}"
    end
  end

  def sync_company_profile!
    return unless connected?

    adapter = AccountingSyncService.adapter_for(self)
    profile_data = adapter.fetch_company_profile

    contact.update!(
      metadata: contact.metadata.merge(
        accounting_profile: profile_data
      )
    )

    update!(last_sync_at: Time.current)
  end

  def create_invoice!(invoice)
    return unless connected?

    adapter = AccountingSyncService.adapter_for(self)
    result = adapter.create_invoice(invoice)

    if result[:success]
      invoice.update!(
        external_invoice_id: result[:invoice_id],
        synced_at: Time.current
      )
    else
      raise "Invoice creation failed: #{result[:error]}"
    end
  end

  def fetch_payment_status(external_invoice_id)
    return unless connected?

    adapter = AccountingSyncService.adapter_for(self)
    adapter.get_payment_status(external_invoice_id)
  end

  # Financial Transaction Methods
  def auto_sync_enabled?
    sync_settings.dig('auto_sync') == true
  end

  def sync_frequency
    sync_settings.dig('frequency') || 'manual'
  end

  def has_account_mapping?(keepr_account_id)
    account_mappings.active.exists?(keepr_account_id: keepr_account_id)
  end

  def get_external_account_id(keepr_account_id)
    mapping = account_mappings.active.find_by(keepr_account_id: keepr_account_id)
    mapping&.external_account_id
  end

  def sync_chart_of_accounts!
    return unless connected?

    # To be implemented by integration service
    # Will fetch chart of accounts from external system
    # and create/update account_mappings
  end

  private

  def encrypt_tokens
    # In production, implement proper encryption
    # For now, storing as-is (tokens are already sensitive)
    # TODO: Add encryption with Rails encrypted credentials
  end

  def decrypt_tokens
    # In production, implement proper decryption
    # For now, reading as-is
  end
end

class SyncConfiguration < ApplicationRecord
  ACCOUNTING_SYSTEMS = %w[xero quickbooks myob].freeze

  # Default field mappings - direction can be: import, export, bidirectional, none
  DEFAULT_FIELD_MAPPINGS = {
    'name' => { 'direction' => 'bidirectional', 'xero_field' => 'Name' },
    'first_name' => { 'direction' => 'bidirectional', 'xero_field' => 'FirstName' },
    'last_name' => { 'direction' => 'bidirectional', 'xero_field' => 'LastName' },
    'email' => { 'direction' => 'bidirectional', 'xero_field' => 'EmailAddress' },
    'mobile_phone' => { 'direction' => 'bidirectional', 'xero_field' => 'Phones.MOBILE' },
    'office_phone' => { 'direction' => 'bidirectional', 'xero_field' => 'Phones.DEFAULT' },
    'tax_number' => { 'direction' => 'bidirectional', 'xero_field' => 'TaxNumber' },
    'bank_bsb' => { 'direction' => 'export', 'xero_field' => 'BankAccountDetails.BSB' },
    'bank_account_number' => { 'direction' => 'export', 'xero_field' => 'BankAccountDetails.AccountNumber' },
    'bank_account_name' => { 'direction' => 'export', 'xero_field' => 'BankAccountDetails.AccountName' },
    'bill_due_day' => { 'direction' => 'bidirectional', 'xero_field' => 'PaymentTerms.Bills.Day' },
    'bill_due_type' => { 'direction' => 'bidirectional', 'xero_field' => 'PaymentTerms.Bills.Type' },
    'sales_due_day' => { 'direction' => 'bidirectional', 'xero_field' => 'PaymentTerms.Sales.Day' },
    'sales_due_type' => { 'direction' => 'bidirectional', 'xero_field' => 'PaymentTerms.Sales.Type' },
    'contact_persons' => { 'direction' => 'import', 'xero_field' => 'ContactPersons' }
  }.freeze

  DEFAULT_CLEANUP_OPTIONS = {
    'delete_primary_person_after_import' => false,
    'archive_duplicates' => false,
    'standardize_abn_format' => true
  }.freeze

  validates :xero_tenant_id, presence: true, uniqueness: true
  validates :accounting_system, inclusion: { in: ACCOUNTING_SYSTEMS }

  scope :for_tenant, ->(tenant_id) { find_by(xero_tenant_id: tenant_id) }
  scope :enabled, -> { where(sync_enabled: true) }
  scope :with_webhooks, -> { where(webhooks_enabled: true) }

  # Get or create config for a tenant
  def self.for_tenant!(tenant_id, tenant_name = nil)
    find_or_create_by!(xero_tenant_id: tenant_id) do |config|
      config.xero_tenant_name = tenant_name
      config.field_mappings = DEFAULT_FIELD_MAPPINGS
      config.cleanup_options = DEFAULT_CLEANUP_OPTIONS
    end
  end

  # Get field mapping direction for a specific field
  def field_direction(field_name)
    mappings = field_mappings.presence || DEFAULT_FIELD_MAPPINGS
    mapping = mappings[field_name]
    mapping ? mapping['direction'] : 'none'
  end

  # Should import this field from Xero?
  def should_import?(field_name)
    direction = field_direction(field_name)
    %w[import bidirectional].include?(direction)
  end

  # Should export this field to Xero?
  def should_export?(field_name)
    direction = field_direction(field_name)
    %w[export bidirectional].include?(direction)
  end

  # Get cleanup option
  def cleanup_option(option_name)
    options = cleanup_options.presence || DEFAULT_CLEANUP_OPTIONS
    options[option_name] || false
  end

  # Should delete primary person from Xero after import?
  def delete_primary_person_after_import?
    cleanup_option('delete_primary_person_after_import')
  end

  # Should archive duplicates in Xero?
  def archive_duplicates?
    cleanup_option('archive_duplicates')
  end

  # Should standardize ABN format?
  def standardize_abn_format?
    cleanup_option('standardize_abn_format')
  end

  # Generate a webhook key if not set
  def ensure_webhook_key!
    update!(webhook_key: SecureRandom.hex(32)) if webhook_key.blank?
    webhook_key
  end

  # Mark webhooks as registered
  def mark_webhooks_registered!
    update!(
      webhooks_enabled: true,
      webhooks_registered_at: Time.current
    )
  end

  # Mark full sync completed
  def mark_full_sync_completed!
    update!(last_full_sync_at: Time.current)
  end

  # Badge color for this accounting system
  def badge_color
    case accounting_system
    when 'xero' then 'blue'
    when 'quickbooks' then 'green'
    when 'myob' then 'purple'
    else 'gray'
    end
  end
end

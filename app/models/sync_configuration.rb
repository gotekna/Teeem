class SyncConfiguration < ApplicationRecord
  ACCOUNTING_SYSTEMS = %w[xero quickbooks myob].freeze

  # Default field mappings - direction can be: import, export, bidirectional, none
  DEFAULT_FIELD_MAPPINGS = {
    "name" => { "direction" => "bidirectional", "xero_field" => "Name" },
    "first_name" => { "direction" => "bidirectional", "xero_field" => "FirstName" },
    "last_name" => { "direction" => "bidirectional", "xero_field" => "LastName" },
    "email" => { "direction" => "bidirectional", "xero_field" => "EmailAddress" },
    "mobile_phone" => { "direction" => "bidirectional", "xero_field" => "Phones.MOBILE" },
    "office_phone" => { "direction" => "bidirectional", "xero_field" => "Phones.DEFAULT" },
    "tax_number" => { "direction" => "bidirectional", "xero_field" => "TaxNumber" },
    "bank_bsb" => { "direction" => "export", "xero_field" => "BankAccountDetails.BSB" },
    "bank_account_number" => { "direction" => "export", "xero_field" => "BankAccountDetails.AccountNumber" },
    "bank_account_name" => { "direction" => "export", "xero_field" => "BankAccountDetails.AccountName" },
    "bill_due_day" => { "direction" => "bidirectional", "xero_field" => "PaymentTerms.Bills.Day" },
    "bill_due_type" => { "direction" => "bidirectional", "xero_field" => "PaymentTerms.Bills.Type" },
    "sales_due_day" => { "direction" => "bidirectional", "xero_field" => "PaymentTerms.Sales.Day" },
    "sales_due_type" => { "direction" => "bidirectional", "xero_field" => "PaymentTerms.Sales.Type" },
    "contact_persons" => { "direction" => "import", "xero_field" => "ContactPersons" }
  }.freeze

  DEFAULT_CLEANUP_OPTIONS = {
    "delete_primary_person_after_import" => false,
    "archive_duplicates" => false,
    "standardize_abn_format" => true,
    "skip_sync_employees" => false,
    "skip_sync_default_suppliers" => false
  }.freeze

  # Valid sync directions for the overall sync configuration
  # - import_only: Only pull data from Xero to TEEEM (Xero is source of truth)
  # - export_only: Only push data from TEEEM to Xero (TEEEM is source of truth)
  # - bidirectional: Sync both ways (most recent change wins)
  # - disabled: No syncing
  SYNC_DIRECTIONS = %w[import_only export_only bidirectional disabled].freeze
  DEFAULT_SYNC_DIRECTION = "import_only".freeze

  validates :xero_tenant_id, presence: true, uniqueness: true
  validates :accounting_system, inclusion: { in: ACCOUNTING_SYSTEMS }
  validates :default_sync_direction, inclusion: { in: SYNC_DIRECTIONS }, allow_nil: true

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
    mapping ? mapping["direction"] : "none"
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
    cleanup_option("delete_primary_person_after_import")
  end

  # Should archive duplicates in Xero?
  def archive_duplicates?
    cleanup_option("archive_duplicates")
  end

  # Should standardize ABN format?
  def standardize_abn_format?
    cleanup_option("standardize_abn_format")
  end

  # Should skip syncing employees to Xero?
  def skip_sync_employees?
    cleanup_option("skip_sync_employees")
  end

  # Should skip syncing suppliers to Xero?
  # Note: Suppliers are identified by the is_supplier? virtual method, NOT entity_type
  def skip_sync_default_suppliers?
    cleanup_option("skip_sync_default_suppliers")
  end

  # Should this contact be synced based on validation rules?
  def should_sync_contact?(contact)
    return false if skip_sync_employees? && contact.is_employee?

    # Skip price_only entity types (cannot sync to Xero - they're not real companies/persons)
    # price_only contacts can have POs and pricebook items, but cannot be synced to accounting systems
    return false if contact.entity_type == "price_only"

    if skip_sync_default_suppliers?
      # SSoT: Use is_supplier? virtual method (checks purchase_orders, pricebook_items, bills)
      # NOT entity_type - suppliers can be any entity_type (person, company, trust, sole_trader)
      return false if contact.is_supplier?
    end

    true
  end

  # Get the skip reason for a contact (returns nil if should sync)
  def skip_reason(contact)
    return "employee" if skip_sync_employees? && contact.is_employee?
    return "price_only" if contact.entity_type == "price_only"

    if skip_sync_default_suppliers?
      # SSoT: Use is_supplier? virtual method (checks purchase_orders, pricebook_items, bills)
      # NOT entity_type - suppliers can be any entity_type (person, company, trust, sole_trader)
      return "supplier" if contact.is_supplier?
    end

    nil
  end

  # Get the effective sync direction (uses default if not set)
  def effective_sync_direction
    default_sync_direction.presence || DEFAULT_SYNC_DIRECTION
  end

  # Set the default sync direction for this tenant
  def set_sync_direction!(direction)
    raise ArgumentError, "Invalid sync direction: #{direction}" unless SYNC_DIRECTIONS.include?(direction)
    update!(default_sync_direction: direction)
  end

  # Should import from Xero? (based on overall sync direction)
  def import_enabled?
    %w[import_only bidirectional].include?(effective_sync_direction)
  end

  # Should export to Xero? (based on overall sync direction)
  def export_enabled?
    %w[export_only bidirectional].include?(effective_sync_direction)
  end

  # Is sync disabled entirely?
  def sync_disabled?
    effective_sync_direction == "disabled"
  end

  # Set all field mappings to a specific direction
  def set_all_fields_direction!(direction)
    valid_directions = %w[import export bidirectional none]
    raise ArgumentError, "Invalid field direction: #{direction}" unless valid_directions.include?(direction)

    new_mappings = (field_mappings.presence || DEFAULT_FIELD_MAPPINGS).deep_dup
    new_mappings.each do |field, config|
      config["direction"] = direction
    end
    update!(field_mappings: new_mappings)
  end

  # Reset field mappings to defaults
  def reset_field_mappings!
    update!(field_mappings: DEFAULT_FIELD_MAPPINGS)
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
    when "xero" then "blue"
    when "quickbooks" then "green"
    when "myob" then "purple"
    else "gray"
    end
  end
end

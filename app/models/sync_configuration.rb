class SyncConfiguration < ApplicationRecord
  ACCOUNTING_SYSTEMS = %w[xero quickbooks myob].freeze

  # Default field mappings - direction can be: import, export, bidirectional, none
  # Based on Xero API Contact object: https://developer.xero.com/documentation/api/accounting/contacts
  DEFAULT_FIELD_MAPPINGS = {
    # Basic Information (Name and core details)
    "name" => { "direction" => "bidirectional", "xero_field" => "Name", "group" => "basic", "label" => "Name", "description" => "Full name of contact/organisation (max 255 chars)" },
    "first_name" => { "direction" => "bidirectional", "xero_field" => "FirstName", "group" => "basic", "label" => "First Name", "description" => "First name of contact person (max 255 chars)" },
    "last_name" => { "direction" => "bidirectional", "xero_field" => "LastName", "group" => "basic", "label" => "Last Name", "description" => "Last name of contact person (max 255 chars)" },
    "email" => { "direction" => "bidirectional", "xero_field" => "EmailAddress", "group" => "basic", "label" => "Email", "description" => "Email address of contact person (max 255 chars)" },
    "tax_number" => { "direction" => "bidirectional", "xero_field" => "TaxNumber", "group" => "basic", "label" => "ABN/Tax Number", "description" => "Tax number (ABN in Australia)" },
    "company_number" => { "direction" => "bidirectional", "xero_field" => "CompanyNumber", "group" => "basic", "label" => "Company Number", "description" => "Company registration number (ACN in Australia)" },

    # Contact Numbers (Xero-specific identifiers)
    "xero_contact_number" => { "direction" => "import", "xero_field" => "ContactNumber", "group" => "xero_ids", "label" => "Contact Number", "description" => "External identifier for contacts (read-only in Xero UI)" },
    "xero_account_number" => { "direction" => "import", "xero_field" => "AccountNumber", "group" => "xero_ids", "label" => "Account Number", "description" => "Unique account number for identification" },
    "xero_contact_status" => { "direction" => "import", "xero_field" => "ContactStatus", "group" => "xero_ids", "label" => "Status", "description" => "ACTIVE, ARCHIVED, or GDPRREQUEST" },

    # Phone Numbers
    "mobile_phone" => { "direction" => "bidirectional", "xero_field" => "Phones.MOBILE", "group" => "phones", "label" => "Mobile Phone", "description" => "Mobile phone number" },
    "office_phone" => { "direction" => "bidirectional", "xero_field" => "Phones.DEFAULT", "group" => "phones", "label" => "Office Phone", "description" => "Default/office phone number" },
    "fax_phone" => { "direction" => "bidirectional", "xero_field" => "Phones.FAX", "group" => "phones", "label" => "Fax", "description" => "Fax number" },
    "direct_dial" => { "direction" => "bidirectional", "xero_field" => "Phones.DDI", "group" => "phones", "label" => "Direct Dial", "description" => "Direct dial number" },

    # Address (Street address)
    "address_street" => { "direction" => "bidirectional", "xero_field" => "Addresses.STREET", "group" => "address", "label" => "Street Address", "description" => "Physical/street address" },
    "address_pobox" => { "direction" => "bidirectional", "xero_field" => "Addresses.POBOX", "group" => "address", "label" => "Postal Address", "description" => "PO Box/postal address" },

    # Banking & Payment
    "bank_bsb" => { "direction" => "export", "xero_field" => "BankAccountDetails.BSB", "group" => "banking", "label" => "Bank BSB", "description" => "Bank BSB number (export only - security)" },
    "bank_account_number" => { "direction" => "export", "xero_field" => "BankAccountDetails.AccountNumber", "group" => "banking", "label" => "Account Number", "description" => "Bank account number (export only - security)" },
    "bank_account_name" => { "direction" => "export", "xero_field" => "BankAccountDetails.AccountName", "group" => "banking", "label" => "Account Name", "description" => "Bank account name (export only - security)" },

    # Payment Terms - Bills (Payables)
    "bill_due_day" => { "direction" => "bidirectional", "xero_field" => "PaymentTerms.Bills.Day", "group" => "payment_terms", "label" => "Bill Due Day", "description" => "Day of month for bill payments" },
    "bill_due_type" => { "direction" => "bidirectional", "xero_field" => "PaymentTerms.Bills.Type", "group" => "payment_terms", "label" => "Bill Due Type", "description" => "DAYSAFTERBILLDATE, DAYSAFTERBILLMONTH, OFCURRENTMONTH, OFFOLLOWINGMONTH" },

    # Payment Terms - Sales (Receivables)
    "sales_due_day" => { "direction" => "bidirectional", "xero_field" => "PaymentTerms.Sales.Day", "group" => "payment_terms", "label" => "Sales Due Day", "description" => "Day of month for sales invoices" },
    "sales_due_type" => { "direction" => "bidirectional", "xero_field" => "PaymentTerms.Sales.Type", "group" => "payment_terms", "label" => "Sales Due Type", "description" => "DAYSAFTERBILLDATE, DAYSAFTERBILLMONTH, OFCURRENTMONTH, OFFOLLOWINGMONTH" },

    # Default Accounts
    "default_purchase_account" => { "direction" => "bidirectional", "xero_field" => "PurchasesDefaultAccountCode", "group" => "accounts", "label" => "Purchases Account", "description" => "Default account code for purchases" },
    "default_sales_account" => { "direction" => "bidirectional", "xero_field" => "SalesDefaultAccountCode", "group" => "accounts", "label" => "Sales Account", "description" => "Default account code for sales" },

    # Tracking Categories
    "sales_tracking" => { "direction" => "import", "xero_field" => "SalesTrackingCategories", "group" => "tracking", "label" => "Sales Tracking", "description" => "Default tracking categories for sales" },
    "purchases_tracking" => { "direction" => "import", "xero_field" => "PurchasesTrackingCategories", "group" => "tracking", "label" => "Purchases Tracking", "description" => "Default tracking categories for purchases" },

    # Currency & Discount
    "default_currency" => { "direction" => "import", "xero_field" => "DefaultCurrency", "group" => "finance", "label" => "Currency", "description" => "Default currency for invoices" },
    "default_discount" => { "direction" => "bidirectional", "xero_field" => "Discount", "group" => "finance", "label" => "Discount %", "description" => "Default discount percentage for the contact" },

    # Balances (Read-only from Xero)
    "accounts_receivable_outstanding" => { "direction" => "import", "xero_field" => "Balances.AccountsReceivable.Outstanding", "group" => "balances", "label" => "AR Outstanding", "description" => "Outstanding receivables balance" },
    "accounts_receivable_overdue" => { "direction" => "import", "xero_field" => "Balances.AccountsReceivable.Overdue", "group" => "balances", "label" => "AR Overdue", "description" => "Overdue receivables balance" },
    "accounts_payable_outstanding" => { "direction" => "import", "xero_field" => "Balances.AccountsPayable.Outstanding", "group" => "balances", "label" => "AP Outstanding", "description" => "Outstanding payables balance" },
    "accounts_payable_overdue" => { "direction" => "import", "xero_field" => "Balances.AccountsPayable.Overdue", "group" => "balances", "label" => "AP Overdue", "description" => "Overdue payables balance" },

    # Contact Persons
    "contact_persons" => { "direction" => "import", "xero_field" => "ContactPersons", "group" => "people", "label" => "Contact Persons", "description" => "Additional contact people (max 5)" },

    # Contact Groups
    "contact_groups" => { "direction" => "import", "xero_field" => "ContactGroups", "group" => "groups", "label" => "Contact Groups", "description" => "Groups this contact belongs to" },

    # Customer/Supplier Flags
    "is_customer" => { "direction" => "import", "xero_field" => "IsCustomer", "group" => "type", "label" => "Is Customer", "description" => "Boolean - contact is a customer" },
    "is_supplier" => { "direction" => "import", "xero_field" => "IsSupplier", "group" => "type", "label" => "Is Supplier", "description" => "Boolean - contact is a supplier" },

    # Branding
    "branding_theme" => { "direction" => "import", "xero_field" => "BrandingTheme", "group" => "branding", "label" => "Branding Theme", "description" => "Default branding theme for documents" },

    # Batches (Payment services)
    "batch_payments" => { "direction" => "import", "xero_field" => "BatchPayments", "group" => "payments", "label" => "Batch Payments", "description" => "Bank details for batch payments" },

    # Other
    "website" => { "direction" => "import", "xero_field" => "Website", "group" => "basic", "label" => "Website", "description" => "Website URL (read-only via API)" },
    "skype" => { "direction" => "import", "xero_field" => "SkypeUserName", "group" => "basic", "label" => "Skype", "description" => "Skype username" },

    # Attachments (Read-only)
    "has_attachments" => { "direction" => "import", "xero_field" => "HasAttachments", "group" => "meta", "label" => "Has Attachments", "description" => "Boolean - contact has file attachments" },

    # Validation Status
    "has_validation_errors" => { "direction" => "import", "xero_field" => "HasValidationErrors", "group" => "meta", "label" => "Validation Errors", "description" => "Boolean - contact has validation errors in Xero" }
  }.freeze

  # Field groups for UI organization
  FIELD_GROUPS = {
    "basic" => { "label" => "Basic Information", "description" => "Name and core details", "order" => 1 },
    "xero_ids" => { "label" => "Xero Identifiers", "description" => "Xero-specific identification fields", "order" => 2 },
    "phones" => { "label" => "Phone Numbers", "description" => "Contact phone numbers", "order" => 3 },
    "address" => { "label" => "Addresses", "description" => "Physical and postal addresses", "order" => 4 },
    "banking" => { "label" => "Banking Details", "description" => "Bank account information", "order" => 5 },
    "payment_terms" => { "label" => "Payment Terms", "description" => "Default payment terms for bills and invoices", "order" => 6 },
    "accounts" => { "label" => "Default Accounts", "description" => "Default ledger accounts", "order" => 7 },
    "tracking" => { "label" => "Tracking Categories", "description" => "Default tracking for reporting", "order" => 8 },
    "finance" => { "label" => "Financial Settings", "description" => "Currency and discount settings", "order" => 9 },
    "balances" => { "label" => "Account Balances", "description" => "Outstanding and overdue amounts (read-only)", "order" => 10 },
    "people" => { "label" => "Contact Persons", "description" => "Additional people linked to contact", "order" => 11 },
    "groups" => { "label" => "Contact Groups", "description" => "Xero contact groups membership", "order" => 12 },
    "type" => { "label" => "Contact Type", "description" => "Customer/Supplier classification", "order" => 13 },
    "branding" => { "label" => "Branding", "description" => "Default branding themes", "order" => 14 },
    "payments" => { "label" => "Payment Services", "description" => "Batch payment settings", "order" => 15 },
    "meta" => { "label" => "Metadata", "description" => "System status fields", "order" => 16 }
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

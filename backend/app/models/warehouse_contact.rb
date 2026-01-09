# frozen_string_literal: true

# WarehouseContact - Raw contact data from Xero
# Following the warehouse pattern established by WarehouseBankTransaction
#
# This is the SSoT for Xero contact data. TEEEM Contact is a business entity
# that may optionally link to warehouse records for Xero integration.
class WarehouseContact < ApplicationRecord
  belongs_to :contact, optional: true

  # Linked warehouse records
  has_many :warehouse_bank_transactions, dependent: :nullify
  has_many :external_invoices, dependent: :nullify

  # Sources (for future multi-accounting support)
  SOURCES = %w[xero myob quickbooks].freeze

  # Contact statuses from Xero
  STATUSES = %w[ACTIVE ARCHIVED GDPRREQUEST].freeze

  # Sync directions (for TEEEM Contact linking)
  SYNC_DIRECTIONS = %w[import_only export_only bidirectional].freeze

  # Match types for auto-linking to TEEEM Contact
  MATCH_TYPES = %w[exact_abn exact_email fuzzy_name manual auto_created].freeze

  validates :xero_id, presence: true, uniqueness: { scope: :tenant_id }
  validates :tenant_id, presence: true
  validates :source, inclusion: { in: SOURCES }
  validates :sync_direction, inclusion: { in: SYNC_DIRECTIONS }, allow_nil: true

  # Scopes by source
  scope :xero, -> { where(source: "xero") }
  scope :for_tenant, ->(tenant_id) { where(tenant_id: tenant_id) }

  # Scopes by sync status
  scope :enabled, -> { where(sync_enabled: true) }
  scope :with_errors, -> { where.not(sync_error: nil) }
  scope :with_conflicts, -> { where("conflict_fields != '{}'") }
  scope :pending_review, -> { where(needs_review: true) }
  scope :reviewed, -> { where(needs_review: false).where.not(reviewed_at: nil) }

  # Scopes by type
  scope :customers, -> { where(is_customer: true) }
  scope :suppliers, -> { where(is_supplier: true) }
  scope :both, -> { where(is_customer: true, is_supplier: true) }

  # Scopes by status
  scope :active, -> { where(contact_status: "ACTIVE") }
  scope :archived, -> { where(contact_status: "ARCHIVED") }

  # Scopes by linking status
  scope :linked, -> { where.not(contact_id: nil) }
  scope :unlinked, -> { where(contact_id: nil) }

  # Search scope
  scope :search, ->(query) {
    return all if query.blank?
    where(
      "name ILIKE :q OR email_address ILIKE :q OR phone_number ILIKE :q OR abn ILIKE :q",
      q: "%#{query}%"
    )
  }

  # Display name (prefer name, fall back to email)
  def display_name
    name.presence || email_address.presence || "Contact #{id}"
  end

  # Primary phone number
  def primary_phone
    phone_number.presence || phones&.dig(0, "PhoneNumber")
  end

  # Primary address
  def primary_address
    addresses&.find { |a| a["AddressType"] == "POBOX" } ||
      addresses&.find { |a| a["AddressType"] == "STREET" } ||
      addresses&.first
  end

  # Format address for display
  def formatted_address
    addr = primary_address
    return nil unless addr

    [
      addr["AddressLine1"],
      addr["AddressLine2"],
      [addr["City"], addr["Region"], addr["PostalCode"]].compact.join(" "),
      addr["Country"]
    ].compact.join(", ")
  end

  # Class method to get distinct tenants
  def self.tenants
    distinct.pluck(:tenant_id)
  end

  # Class method to get summary stats
  def self.summary_stats
    {
      total: count,
      customers: customers.count,
      suppliers: suppliers.count,
      linked: linked.count,
      unlinked: unlinked.count,
      active: active.count,
      archived: archived.count
    }
  end

  # ========== Sync Metadata Methods ==========
  # These methods mirror ContactExternalLink for migration compatibility

  # Check if this contact has sync conflicts
  def has_conflicts?
    conflict_fields.present? && conflict_fields.any?
  end

  # Clear sync error
  def clear_error!
    update!(sync_error: nil)
  end

  # Record sync error
  def record_error!(message)
    update!(sync_error: message)
  end

  # Mark as synced
  def mark_synced!(external_modified_at = nil)
    update!(
      last_synced_at: Time.current,
      xero_updated_at: external_modified_at,
      sync_error: nil
    )
  end

  # Add a conflict field
  def add_conflict(field_name, teeem_value, external_value)
    conflicts = conflict_fields || {}
    conflicts[field_name] = {
      "teeem_value" => teeem_value,
      "external_value" => external_value,
      "detected_at" => Time.current.iso8601
    }
    update!(conflict_fields: conflicts)
  end

  # Resolve a conflict (choose which value to keep)
  def resolve_conflict(field_name, _keep_source)
    conflicts = conflict_fields || {}
    conflicts.delete(field_name)
    update!(conflict_fields: conflicts)
  end

  # Sync direction helpers
  def import_only?
    sync_direction == "import_only"
  end

  def export_only?
    sync_direction == "export_only"
  end

  def bidirectional?
    sync_direction == "bidirectional"
  end

  def can_import?
    sync_enabled? && (import_only? || bidirectional?)
  end

  def can_export?
    sync_enabled? && (export_only? || bidirectional?)
  end

  # Source helpers
  def xero?
    source == "xero"
  end

  def myob?
    source == "myob"
  end

  def quickbooks?
    source == "quickbooks"
  end

  # Review workflow
  def approve_review!(reviewer_email = nil)
    update!(
      needs_review: false,
      sync_enabled: true,
      reviewed_at: Time.current,
      reviewed_by: reviewer_email
    )
  end

  # Match helpers
  def auto_matched?
    match_type.present? && match_type != "manual"
  end

  def high_confidence?
    match_confidence.present? && match_confidence >= 0.95
  end

  def fuzzy_match?
    match_type == "fuzzy_name"
  end

  # Link to TEEEM Contact with match metadata
  def link_to_contact!(teeem_contact, match_type: "manual", confidence: 1.0)
    update!(
      contact_id: teeem_contact.id,
      match_type: match_type,
      match_confidence: confidence,
      needs_review: match_type == "fuzzy_name" && confidence < 0.95
    )
  end

  # Upsert from Xero contact data
  def self.upsert_from_xero(contact_data, tenant_id)
    xero_id = contact_data["ContactID"]
    return nil unless xero_id.present?

    record = find_or_initialize_by(xero_id: xero_id, tenant_id: tenant_id)

    record.assign_attributes(
      source: "xero",
      name: contact_data["Name"],
      first_name: contact_data["FirstName"],
      last_name: contact_data["LastName"],
      email_address: contact_data["EmailAddress"],
      abn: contact_data["TaxNumber"],
      tax_number: contact_data["TaxNumber"],
      account_number: contact_data["AccountNumber"],
      contact_status: contact_data["ContactStatus"],
      currency_code: contact_data["DefaultCurrency"],
      is_customer: contact_data["IsCustomer"] || false,
      is_supplier: contact_data["IsSupplier"] || false,
      addresses: contact_data["Addresses"] || [],
      phones: contact_data["Phones"] || [],
      bank_account_details: contact_data["BankAccountDetails"],
      batch_payments_bank_account_name: contact_data.dig("BatchPayments", "BankAccountName"),
      batch_payments_bank_account_number: contact_data.dig("BatchPayments", "BankAccountNumber"),
      batch_payments_bank_bsb: contact_data.dig("BatchPayments", "BankAccountBSB"),
      xero_updated_at: parse_xero_date(contact_data["UpdatedDateUTC"]),
      last_synced_at: Time.current,
      raw_data: contact_data
    )

    # Extract phone number from phones array
    if record.phone_number.blank? && contact_data["Phones"].present?
      default_phone = contact_data["Phones"].find { |p| p["PhoneType"] == "DEFAULT" } ||
                      contact_data["Phones"].first
      record.phone_number = default_phone["PhoneNumber"] if default_phone
    end

    record.save!
    record
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error("Failed to upsert WarehouseContact #{xero_id}: #{e.message}")
    nil
  end

  # Parse Xero date format
  def self.parse_xero_date(date_input)
    return nil unless date_input.present?

    if date_input.is_a?(String)
      if date_input.start_with?("/Date(")
        timestamp = date_input.match(/\/Date\((\d+)/)&.captures&.first
        return Time.at(timestamp.to_i / 1000) if timestamp
      else
        return DateTime.parse(date_input) rescue nil
      end
    end

    nil
  end
end

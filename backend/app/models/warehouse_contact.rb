# frozen_string_literal: true

# WarehouseContact - Raw contact data from Xero
# Following the warehouse pattern established by WarehouseBankTransaction
#
# This is the SSoT for Xero contact data. TEEEM Contact is a business entity
# that may optionally link to warehouse records for Xero integration.
class WarehouseContact < ApplicationRecord
  belongs_to :contact, optional: true

  # Sources (for future multi-accounting support)
  SOURCES = %w[xero myob quickbooks].freeze

  # Contact statuses from Xero
  STATUSES = %w[ACTIVE ARCHIVED GDPRREQUEST].freeze

  validates :xero_id, presence: true, uniqueness: { scope: :tenant_id }
  validates :tenant_id, presence: true
  validates :source, inclusion: { in: SOURCES }

  # Scopes by source
  scope :xero, -> { where(source: "xero") }
  scope :for_tenant, ->(tenant_id) { where(tenant_id: tenant_id) }

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

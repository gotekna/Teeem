# Renamed from WarehouseBankTransaction (Jan 2026)
# Part of the "Warehouse" table rename initiative - this is Xero bank feed data,
# not actually part of the File Warehouse system.
class XeroBankTransaction < ApplicationRecord
  # Keep table name explicit during transition (after migration, this can be removed)
  self.table_name = "xero_bank_transactions"
  include ExternalSyncConstants

  belongs_to :contact, optional: true
  # LIM (Jan 2026): xero_contact association removed - ContactExternalLink is THE ONE SSoT
  # XeroContact table had 0 records, ContactExternalLink has 1,018 records

  # SSoT: ACCOUNTING_SYSTEMS defined in ExternalSyncConstants concern

  # Transaction types
  TRANSACTION_TYPES = %w[RECEIVE SPEND].freeze

  # Statuses
  STATUSES = %w[AUTHORISED DELETED].freeze

  validates :xero_id, presence: true, uniqueness: true
  validates :transaction_date, presence: true
  validates :source, inclusion: { in: ACCOUNTING_SYSTEMS }

  # SSoT: source scopes (xero, myob, quickbooks, for_source) defined in ExternalSyncConstants
  scope :for_tenant, ->(tenant_id) { where(tenant_id: tenant_id) }

  # Scopes by type
  scope :receives, -> { where(transaction_type: "RECEIVE") }
  scope :spends, -> { where(transaction_type: "SPEND") }
  scope :money_in, -> { receives }
  scope :money_out, -> { spends }

  # Scopes by status
  scope :authorised, -> { where(status: "AUTHORISED") }
  scope :active, -> { where.not(status: "DELETED") }
  scope :reconciled, -> { where(is_reconciled: true) }
  scope :unreconciled, -> { where(is_reconciled: false) }

  # Scopes by bank account
  scope :for_bank_account, ->(account_id) { where(bank_account_id: account_id) }
  scope :for_bank_account_name, ->(name) { where(bank_account_name: name) }

  # Scopes by date
  scope :for_month, ->(year, month) { where(transaction_year: year, transaction_month: month) }
  scope :for_year, ->(year) { where(transaction_year: year) }
  scope :for_financial_year, ->(fy) { where(financial_year: fy) }
  scope :in_date_range, ->(start_date, end_date) { where(transaction_date: start_date..end_date) }

  # Search scope
  scope :search, ->(query) {
    return all if query.blank?
    where("description ILIKE :q OR contact_name ILIKE :q OR reference ILIKE :q", q: "%#{query}%")
  }

  # Calculate financial year from date (Australian FY: July-June)
  def self.calculate_financial_year(date)
    year = date.month >= 7 ? date.year + 1 : date.year
    "FY#{year.to_s[-2..]}"
  end

  # Set derived fields before save
  before_save :set_derived_fields

  def set_derived_fields
    if transaction_date.present?
      self.transaction_month = transaction_date.month
      self.transaction_year = transaction_date.year
      self.financial_year = self.class.calculate_financial_year(transaction_date)
    end

    # Concatenate line item descriptions for search
    if line_items.present? && line_items.is_a?(Array)
      self.description = line_items.map { |li| li["Description"] }.compact.join(" | ")
    end
  end

  # Money in?
  def receive?
    transaction_type == "RECEIVE"
  end

  # Money out?
  def spend?
    transaction_type == "SPEND"
  end

  # Formatted total (positive for receives, negative for spends)
  def signed_total
    spend? ? -total : total
  end

  # Display type
  def type_display
    receive? ? "Money In" : "Money Out"
  end

  # Class method to get distinct bank accounts
  def self.bank_accounts
    distinct.pluck(:bank_account_id, :bank_account_code, :bank_account_name)
      .map { |id, code, name| { id: id, code: code, name: name } }
      .uniq { |a| a[:id] }
  end

  # Class method to get available financial years
  def self.available_financial_years
    distinct.pluck(:financial_year).compact.sort.reverse
  end

  # Class method to get monthly summary
  def self.monthly_summary
    active
      .group(:transaction_year, :transaction_month, :transaction_type)
      .select(
        :transaction_year,
        :transaction_month,
        :transaction_type,
        "SUM(total) as total_amount",
        "COUNT(*) as transaction_count"
      )
  end
end

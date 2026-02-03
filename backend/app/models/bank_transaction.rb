class BankTransaction < ApplicationRecord
  # ⚠️ CRITICAL SECURITY FIX (Feb 2026): Multi-tenancy scoping
  # FRC: BankTransaction was leaking data across tenants
  # Root cause: Legacy indirect relationship (transaction → bank_account → corporate_company → tenant)
  # Fix: Direct tenant_id column + acts_as_tenant for automatic scoping
  acts_as_tenant :tenant

  # Associations
  belongs_to :tenant
  belongs_to :corporate, foreign_key: "company_id"
  belongs_to :bank_account, optional: true

  # Validations
  validates :xero_transaction_id, presence: true, uniqueness: true
  validates :transaction_date, presence: true
  validates :amount, presence: true
  validates :transaction_type, inclusion: { in: %w[SPEND RECEIVE TRANSFER], allow_blank: true }
  validates :status, inclusion: { in: %w[AUTHORISED DELETED VOIDED], allow_blank: true }

  # Scopes
  scope :authorized, -> { where(status: "AUTHORISED") }
  scope :reconciled, -> { where(is_reconciled: true) }
  scope :unreconciled, -> { where(is_reconciled: false) }
  scope :by_date_range, ->(start_date, end_date) { where(transaction_date: start_date..end_date) }
  scope :by_type, ->(type) { where(transaction_type: type) }
  scope :credits, -> { where(transaction_type: "RECEIVE") }
  scope :debits, -> { where(transaction_type: "SPEND") }

  # Instance methods
  def credit?
    transaction_type == "RECEIVE"
  end

  def debit?
    transaction_type == "SPEND"
  end

  def transfer?
    transaction_type == "TRANSFER"
  end

  def signed_amount
    debit? ? -amount : amount
  end

  def formatted_amount
    ActionController::Base.helpers.number_to_currency(amount, unit: "$")
  end

  def formatted_signed_amount
    prefix = debit? ? "-" : "+"
    "#{prefix}#{formatted_amount}"
  end

  # Class methods for syncing from Xero
  def self.upsert_from_xero(company:, xero_transaction:, bank_account: nil)
    transaction = find_or_initialize_by(xero_transaction_id: xero_transaction["BankTransactionID"])

    transaction.assign_attributes(
      company: company,
      bank_account: bank_account,
      transaction_type: xero_transaction["Type"],
      transaction_date: Date.parse(xero_transaction["Date"]),
      amount: xero_transaction["Total"].to_d.abs,
      reference: xero_transaction["Reference"],
      description: extract_description(xero_transaction),
      contact_name: xero_transaction.dig("Contact", "Name"),
      xero_contact_id: xero_transaction.dig("Contact", "ContactID"),
      status: xero_transaction["Status"],
      line_amount_types: xero_transaction["LineAmountTypes"],
      is_reconciled: xero_transaction["IsReconciled"] == true,
      currency_code: xero_transaction["CurrencyCode"] || "AUD",
      metadata: {
        bank_account_id: xero_transaction.dig("BankAccount", "AccountID"),
        bank_account_name: xero_transaction.dig("BankAccount", "Name"),
        line_items: xero_transaction["LineItems"],
        updated_at_utc: xero_transaction["UpdatedDateUTC"]
      }
    )

    transaction.save!
    transaction
  end

  private

  def self.extract_description(xero_transaction)
    # Try to get a meaningful description from line items or use reference
    line_items = xero_transaction["LineItems"] || []
    if line_items.any?
      line_items.map { |li| li["Description"] }.compact.join("; ")
    else
      xero_transaction["Reference"]
    end
  end
end

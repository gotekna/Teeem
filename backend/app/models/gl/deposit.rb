# frozen_string_literal: true

module Gl
  # Customer deposits, prepayments, and retainers
  class Deposit < ApplicationRecord
    self.table_name = "gl_deposits"

    DEPOSIT_TYPES = %w[deposit prepayment retainer].freeze
    STATUSES = %w[received partially_applied fully_applied refunded].freeze
    PAYMENT_METHODS = %w[cash check eft credit_card other].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :contact
    belongs_to :job, optional: true
    belongs_to :received_by, class_name: "User", optional: true
    belongs_to :bank_account, class_name: "Gl::Account", optional: true

    has_many :allocations, class_name: "Gl::DepositAllocation", foreign_key: "deposit_id", dependent: :destroy
    has_many :invoices, through: :allocations

    validates :reference, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :received_date, presence: true
    validates :amount, presence: true, numericality: { greater_than: 0 }
    validates :deposit_type, presence: true, inclusion: { in: DEPOSIT_TYPES }
    validates :status, presence: true, inclusion: { in: STATUSES }

    before_save :calculate_balance
    before_create :generate_reference

    scope :with_balance, -> { where("balance > 0") }
    scope :for_contact, ->(contact_id) { where(contact_id: contact_id) }
    scope :for_job, ->(job_id) { where(job_id: job_id) }
    scope :received, -> { where(status: "received") }
    scope :available, -> { where(status: %w[received partially_applied]) }

    # Get available deposits for a contact
    def self.available_for_invoice(invoice)
      available.for_contact(invoice.contact_id)
               .where("balance > 0")
               .order(:received_date)
    end

    # Apply deposit to an invoice
    def apply_to_invoice!(invoice, amount: nil, user: nil)
      amount ||= [balance, invoice.balance_due].min

      raise "Insufficient deposit balance" if amount > balance
      raise "Amount exceeds invoice balance" if amount > invoice.balance_due

      transaction do
        allocation = allocations.create!(
          invoice: invoice,
          amount: amount,
          allocated_by: user,
          allocated_at: Time.current
        )

        # Update deposit totals
        self.applied_amount = (applied_amount || 0) + amount
        calculate_balance
        save!

        # Apply payment to invoice
        invoice.apply_payment!(amount, payment_reference: "Deposit #{reference}")

        allocation
      end
    end

    # Refund remaining balance
    def refund!(amount: nil, user: nil, reason: nil)
      amount ||= balance

      raise "Refund amount exceeds balance" if amount > balance

      transaction do
        self.refunded_amount = (refunded_amount || 0) + amount
        calculate_balance
        self.status = balance.zero? ? "refunded" : status
        self.notes = [notes, "Refund: $#{amount} - #{reason}"].compact.join("\n")
        save!
      end
    end

    # Unapply from invoice (reversal)
    def unapply_from_invoice!(invoice, user: nil)
      allocation = allocations.find_by!(invoice: invoice)

      transaction do
        amount = allocation.amount

        # Reverse the payment on the invoice
        invoice.reverse_payment!(amount)

        # Update deposit totals
        self.applied_amount = (applied_amount || 0) - amount
        calculate_balance
        save!

        # Delete the allocation
        allocation.destroy!
      end
    end

    def type_label
      case deposit_type
      when "deposit" then "Deposit"
      when "prepayment" then "Prepayment"
      when "retainer" then "Retainer"
      end
    end

    private

    def calculate_balance
      self.balance = amount - (applied_amount || 0) - (refunded_amount || 0)
      self.status = calculate_status
    end

    def calculate_status
      return "refunded" if refunded_amount.to_d > 0 && balance.to_d.zero?
      return "fully_applied" if applied_amount.to_d >= amount && balance.to_d.zero?
      return "partially_applied" if applied_amount.to_d > 0

      "received"
    end

    def generate_reference
      return if reference.present?

      prefix = case deposit_type
               when "prepayment" then "PP"
               when "retainer" then "RT"
               else "DEP"
               end

      year = Date.current.year.to_s[-2..]
      sequence = self.class.where(corporate_company_id: corporate_company_id)
                           .where("reference LIKE ?", "#{prefix}#{year}%")
                           .count + 1

      self.reference = "#{prefix}#{year}#{sequence.to_s.rjust(4, '0')}"
    end
  end
end

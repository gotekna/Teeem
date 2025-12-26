# frozen_string_literal: true

module Gl
  # Direct debit mandate for automatic payments
  class DirectDebitMandate < ApplicationRecord
    self.table_name = "gl_direct_debit_mandates"

    STATUSES = %w[pending active cancelled expired].freeze
    FREQUENCIES = %w[one_time weekly monthly per_invoice].freeze
    AUTHORIZATION_METHODS = %w[online paper verbal].freeze

    belongs_to :corporate_company
    belongs_to :contact

    validates :mandate_reference, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :status, inclusion: { in: STATUSES }
    validates :bsb, presence: true, if: :active?
    validates :account_number, presence: true, if: :active?
    validates :account_name, presence: true, if: :active?

    before_create :generate_reference

    scope :active, -> { where(status: "active") }
    scope :for_contact, ->(contact) { where(contact_id: contact.id) }

    # Create mandate from online authorization
    def self.authorize_online!(contact, bank_details:, ip_address:, frequency: "per_invoice")
      create!(
        corporate_company: contact.corporate_company,
        contact: contact,
        bsb: bank_details[:bsb],
        account_number: bank_details[:account_number],
        account_name: bank_details[:account_name],
        authorization_method: "online",
        authorized_at: Time.current,
        ip_address: ip_address,
        frequency: frequency,
        start_date: Date.current,
        status: "active"
      )
    end

    # Activate pending mandate
    def activate!
      return false unless status == "pending"
      return false if bsb.blank? || account_number.blank?

      update!(
        status: "active",
        authorized_at: Time.current
      )
    end

    # Cancel mandate
    def cancel!(reason = nil)
      update!(
        status: "cancelled",
        cancelled_at: Time.current,
        cancellation_reason: reason
      )
    end

    # Check if mandate allows this debit
    def allows_debit?(amount)
      return false unless active?
      return false if end_date && Date.current > end_date
      return true if max_amount.nil?

      amount <= max_amount
    end

    # Format for ABA file
    def formatted_bsb
      bsb&.gsub("-", "")&.rjust(6, "0")
    end

    def formatted_account_number
      account_number&.gsub(/\D/, "")&.rjust(9, "0")&.first(9)
    end

    private

    def generate_reference
      return if mandate_reference.present?

      year = Date.current.year.to_s[-2..]
      sequence = self.class.where(corporate_company_id: corporate_company_id).count + 1

      self.mandate_reference = "DDM#{year}#{sequence.to_s.rjust(5, '0')}"
    end
  end
end

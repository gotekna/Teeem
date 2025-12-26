# frozen_string_literal: true

module Gl
  # Individual payment in a batch
  class PaymentBatchItem < ApplicationRecord
    self.table_name = "gl_payment_batch_items"

    STATUSES = %w[pending processing processed failed].freeze

    belongs_to :payment_batch, class_name: "Gl::PaymentBatch"
    belongs_to :contact
    belongs_to :invoice, class_name: "Gl::Invoice", optional: true

    validates :amount, presence: true, numericality: { greater_than: 0 }
    validates :status, inclusion: { in: STATUSES }

    scope :pending, -> { where(status: "pending") }
    scope :processed, -> { where(status: "processed") }
    scope :failed, -> { where(status: "failed") }

    # Validate bank details present
    def valid_bank_details?
      bsb.present? && account_number.present? && account_name.present?
    end

    # Format BSB for ABA (remove dash if present)
    def formatted_bsb
      bsb&.gsub("-", "")&.rjust(6, "0")
    end

    # Format account number for ABA
    def formatted_account_number
      account_number&.gsub(/\D/, "")&.rjust(9, "0")&.first(9)
    end

    # Format account name for ABA (max 32 chars, uppercase)
    def formatted_account_name
      account_name&.upcase&.first(32)&.ljust(32)
    end

    # Mark as processed
    def mark_processed!
      update!(status: "processed")
    end

    # Mark as failed
    def mark_failed!(message)
      update!(status: "failed", error_message: message)
    end
  end
end

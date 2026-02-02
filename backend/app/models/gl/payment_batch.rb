# frozen_string_literal: true

module Gl
  # Batch of payments for processing together
  class PaymentBatch < ApplicationRecord
    self.table_name = "gl_payment_batches"

    STATUSES = %w[draft pending_approval approved processing completed failed].freeze

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :bank_account, class_name: "Gl::Account", optional: true
    belongs_to :created_by, class_name: "User", optional: true
    belongs_to :approved_by, class_name: "User", optional: true

    has_many :items, class_name: "Gl::PaymentBatchItem", foreign_key: "payment_batch_id", dependent: :destroy

    validates :reference, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :payment_date, presence: true
    validates :status, inclusion: { in: STATUSES }

    before_create :generate_reference

    scope :draft, -> { where(status: "draft") }
    scope :pending, -> { where(status: "pending_approval") }
    scope :approved, -> { where(status: "approved") }
    scope :completed, -> { where(status: "completed") }

    # Add bills to batch
    def add_bills!(bills)
      bills.each do |bill|
        next if items.exists?(invoice: bill)

        items.create!(
          contact: bill.contact,
          invoice: bill,
          amount: bill.amount_due,
          reference: bill.reference,
          bsb: bill.contact.bank_bsb,
          account_number: bill.contact.bank_account_number,
          account_name: bill.contact.bank_account_name&.first(32)
        )
      end

      update_totals!
    end

    # Add single payment (not linked to invoice)
    def add_payment!(contact:, amount:, reference: nil)
      items.create!(
        contact: contact,
        amount: amount,
        reference: reference || "Payment",
        bsb: contact.bank_bsb,
        account_number: contact.bank_account_number,
        account_name: contact.bank_account_name&.first(32)
      )

      update_totals!
    end

    # Remove item
    def remove_item!(item)
      item.destroy
      update_totals!
    end

    # Update totals
    def update_totals!
      update!(
        payment_count: items.count,
        total_amount: items.sum(:amount)
      )
    end

    # Submit for approval
    def submit_for_approval!
      return false unless status == "draft"
      return false if items.empty?

      # Validate all items have bank details
      invalid_items = items.select { |i| i.bsb.blank? || i.account_number.blank? }
      if invalid_items.any?
        errors.add(:base, "#{invalid_items.count} items missing bank details")
        return false
      end

      update!(status: "pending_approval")
    end

    # Approve batch
    def approve!(approver)
      return false unless status == "pending_approval"

      update!(
        status: "approved",
        approved_by: approver,
        approved_at: Time.current
      )
    end

    # Reject batch
    def reject!(reason = nil)
      return false unless status == "pending_approval"

      update!(
        status: "draft",
        processing_notes: reason
      )
    end

    # Generate ABA file
    def generate_aba!
      return nil unless status == "approved"
      return nil if items.empty?

      generator = AbaFileGenerator.new(self)
      content = generator.generate

      update!(
        aba_file_content: content,
        aba_file_name: "#{reference}_#{payment_date.strftime('%Y%m%d')}.aba",
        aba_generated_at: Time.current
      )

      content
    end

    # Mark as processing
    def mark_processing!
      return false unless status == "approved"

      update!(status: "processing", processed_at: Time.current)
      items.update_all(status: "processing")
    end

    # Complete the batch
    def complete!
      return false unless status == "processing"

      update!(status: "completed", completed_at: Time.current)
      items.update_all(status: "processed")

      # Mark invoices as paid
      items.includes(:invoice).find_each do |item|
        next unless item.invoice

        item.invoice.update!(status: "paid", paid_date: payment_date)
      end
    end

    # Mark as failed
    def mark_failed!(message = nil)
      update!(status: "failed", processing_notes: message)
    end

    private

    def generate_reference
      return if reference.present?

      year = Date.current.year.to_s[-2..]
      month = Date.current.strftime("%m")
      day = Date.current.strftime("%d")
      sequence = self.class.where(corporate_company_id: corporate_company_id)
                           .where("reference LIKE ?", "PAY#{year}#{month}#{day}%")
                           .count + 1

      self.reference = "PAY#{year}#{month}#{day}#{sequence.to_s.rjust(2, '0')}"
    end
  end
end

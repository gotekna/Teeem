# frozen_string_literal: true

module Gl
  class PaymentAllocation < ApplicationRecord
    self.table_name = 'gl_payment_allocations'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :gl_payment, class_name: 'Gl::Payment'
    belongs_to :gl_invoice, class_name: 'Gl::Invoice'

    # Delegates
    delegate :corporate_company, to: :gl_payment
    delegate :payment_date, to: :gl_payment
    delegate :invoice_number, to: :gl_invoice

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :amount, presence: true, numericality: { greater_than: 0 }
    validate :payment_and_invoice_same_contact
    validate :amount_not_exceeding_invoice_due

    # ═══════════════════════════════════════════════════════════════
    # CALLBACKS
    # ═══════════════════════════════════════════════════════════════
    after_save :update_invoice_amount_due
    after_destroy :update_invoice_amount_due

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :for_invoice, ->(invoice_id) { where(gl_invoice_id: invoice_id) }
    scope :for_payment, ->(payment_id) { where(gl_payment_id: payment_id) }

    private

    def payment_and_invoice_same_contact
      return unless gl_payment.present? && gl_invoice.present?
      return if gl_payment.contact_id == gl_invoice.contact_id

      errors.add(:base, 'Payment and invoice must be for the same contact')
    end

    def amount_not_exceeding_invoice_due
      return unless gl_invoice.present?

      # Get amount due before this allocation
      current_due = gl_invoice.total - gl_invoice.payment_allocations.where.not(id: id).sum(:amount)

      if amount > current_due
        errors.add(:amount, "cannot exceed invoice amount due (#{current_due})")
      end
    end

    def update_invoice_amount_due
      gl_invoice.recalculate_amount_due! if gl_invoice.present?
    end
  end
end

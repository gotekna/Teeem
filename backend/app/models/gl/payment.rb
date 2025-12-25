# frozen_string_literal: true

module Gl
  class Payment < ApplicationRecord
    self.table_name = 'gl_payments'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company
    belongs_to :contact, optional: true
    belongs_to :gl_account, class_name: 'Gl::Account', optional: true  # Bank account
    belongs_to :gl_journal_entry, class_name: 'Gl::JournalEntry', optional: true

    has_many :allocations, class_name: 'Gl::PaymentAllocation', foreign_key: 'gl_payment_id', dependent: :destroy
    has_many :invoices, through: :allocations, source: :gl_invoice

    accepts_nested_attributes_for :allocations, allow_destroy: true

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    PAYMENT_TYPES = %w[customer_payment supplier_payment refund].freeze
    STATUSES = %w[pending completed voided].freeze
    PROVIDERS = %w[xero quickbooks myob].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :payment_type, presence: true, inclusion: { in: PAYMENT_TYPES }
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :payment_date, presence: true
    validates :amount, presence: true, numericality: { greater_than: 0 }
    validates :external_provider, inclusion: { in: PROVIDERS }, allow_blank: true

    # ═══════════════════════════════════════════════════════════════
    # CALLBACKS
    # ═══════════════════════════════════════════════════════════════
    after_save :update_invoice_amounts
    after_destroy :update_invoice_amounts

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    # By type
    scope :customer_payments, -> { where(payment_type: 'customer_payment') }
    scope :supplier_payments, -> { where(payment_type: 'supplier_payment') }
    scope :refunds, -> { where(payment_type: 'refund') }

    # By status
    scope :pending, -> { where(status: 'pending') }
    scope :completed, -> { where(status: 'completed') }
    scope :voided, -> { where(status: 'voided') }
    scope :active, -> { where.not(status: 'voided') }

    # By provider
    scope :standalone, -> { where(external_provider: nil) }
    scope :for_provider, ->(provider, tenant_id) {
      where(external_provider: provider, external_tenant_id: tenant_id)
    }

    # Sync scopes
    scope :pending_push, -> { where(pending_push: true) }
    scope :sync_enabled, -> { where(sync_enabled: true) }
    scope :created_in_teeem, -> { where(created_in_teeem: true) }

    # Date scopes
    scope :in_period, ->(from_date, to_date) {
      where(payment_date: from_date..to_date)
    }
    scope :recent, -> { order(payment_date: :desc) }

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Type Checks
    # ═══════════════════════════════════════════════════════════════
    def customer_payment?
      payment_type == 'customer_payment'
    end

    def supplier_payment?
      payment_type == 'supplier_payment'
    end

    def refund?
      payment_type == 'refund'
    end

    def standalone?
      external_provider.blank?
    end

    def linked?
      external_payment_id.present?
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Status
    # ═══════════════════════════════════════════════════════════════
    def pending?
      status == 'pending'
    end

    def completed?
      status == 'completed'
    end

    def voided?
      status == 'voided'
    end

    def can_void?
      !voided?
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Actions
    # ═══════════════════════════════════════════════════════════════
    def complete!
      return if completed?

      transaction do
        update!(status: 'completed')
        journalize! unless journalized?
      end
    end

    def void!
      return unless can_void?

      transaction do
        # Void the journal entry if exists
        gl_journal_entry&.void!

        update!(
          status: 'voided',
          journalized: false
        )

        # Clear allocations to update invoice amounts
        allocations.destroy_all
      end

      true
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Allocation
    # ═══════════════════════════════════════════════════════════════
    def allocated_amount
      allocations.sum(:amount)
    end

    def unallocated_amount
      amount - allocated_amount
    end

    def fully_allocated?
      unallocated_amount <= 0
    end

    def allocate_to!(invoice, allocation_amount = nil)
      allocation_amount ||= [ unallocated_amount, invoice.amount_due ].min

      return if allocation_amount <= 0

      allocations.create!(
        gl_invoice: invoice,
        amount: allocation_amount
      )

      invoice.recalculate_amount_due!
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Journalization
    # ═══════════════════════════════════════════════════════════════
    def journalize!
      return if journalized?
      return unless completed?

      journalizer = Gl::Journalizers::Payment.new(self)
      entry = journalizer.journalize

      if entry.persisted?
        update!(gl_journal_entry: entry, journalized: true)
      end

      entry
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Display
    # ═══════════════════════════════════════════════════════════════
    def display_name
      case payment_type
      when 'customer_payment'
        "Payment #{payment_number} from #{contact_name}"
      when 'supplier_payment'
        "Payment #{payment_number} to #{contact_name}"
      when 'refund'
        "Refund #{payment_number} - #{contact_name}"
      else
        "#{payment_type.titleize} #{payment_number}"
      end
    end

    def status_badge
      case status
      when 'pending' then { text: 'Pending', color: 'yellow' }
      when 'completed' then { text: 'Completed', color: 'green' }
      when 'voided' then { text: 'Voided', color: 'red' }
      else { text: status.titleize, color: 'gray' }
      end
    end

    def type_badge
      case payment_type
      when 'customer_payment' then { text: 'Received', color: 'green' }
      when 'supplier_payment' then { text: 'Paid', color: 'blue' }
      when 'refund' then { text: 'Refund', color: 'orange' }
      else { text: payment_type.titleize, color: 'gray' }
      end
    end

    private

    def update_invoice_amounts
      invoices.each(&:recalculate_amount_due!)
    end
  end
end

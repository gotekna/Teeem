# frozen_string_literal: true

module Gl
  class Invoice < ApplicationRecord
    self.table_name = 'gl_invoices'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company
    belongs_to :contact, optional: true
    belongs_to :job, optional: true
    belongs_to :approved_by, class_name: 'User', optional: true
    belongs_to :gl_journal_entry, class_name: 'Gl::JournalEntry', optional: true

    has_many :lines, class_name: 'Gl::InvoiceLine', foreign_key: 'gl_invoice_id', dependent: :destroy
    has_many :payment_allocations, class_name: 'Gl::PaymentAllocation', foreign_key: 'gl_invoice_id', dependent: :destroy
    has_many :payments, through: :payment_allocations, source: :gl_payment

    accepts_nested_attributes_for :lines, allow_destroy: true

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    INVOICE_TYPES = %w[sales_invoice bill credit_note].freeze
    STATUSES = %w[draft submitted approved paid voided deleted].freeze
    PROVIDERS = %w[xero quickbooks myob].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :invoice_type, presence: true, inclusion: { in: INVOICE_TYPES }
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :invoice_date, presence: true
    validates :external_provider, inclusion: { in: PROVIDERS }, allow_blank: true

    # ═══════════════════════════════════════════════════════════════
    # CALLBACKS
    # ═══════════════════════════════════════════════════════════════
    before_save :calculate_totals
    after_save :update_amount_due

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    # By type
    scope :sales_invoices, -> { where(invoice_type: 'sales_invoice') }
    scope :bills, -> { where(invoice_type: 'bill') }
    scope :credit_notes, -> { where(invoice_type: 'credit_note') }

    # By status
    scope :draft, -> { where(status: 'draft') }
    scope :submitted, -> { where(status: 'submitted') }
    scope :approved, -> { where(status: 'approved') }
    scope :paid, -> { where(status: 'paid') }
    scope :voided, -> { where(status: 'voided') }
    scope :active, -> { where.not(status: %w[voided deleted]) }
    scope :unpaid, -> { where.not(status: 'paid') }
    scope :overdue, -> { unpaid.where('due_date < ?', Date.current) }

    # By provider
    scope :standalone, -> { where(external_provider: nil) }
    scope :for_provider, ->(provider, tenant_id) {
      where(external_provider: provider, external_tenant_id: tenant_id)
    }

    # Sync scopes
    scope :pending_push, -> { where(pending_push: true) }
    scope :sync_enabled, -> { where(sync_enabled: true) }
    scope :created_in_teeem, -> { where(created_in_teeem: true) }
    scope :needs_sync, -> { sync_enabled.pending_push }

    # Date scopes
    scope :in_period, ->(from_date, to_date) {
      where(invoice_date: from_date..to_date)
    }
    scope :recent, -> { order(invoice_date: :desc) }

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Type Checks
    # ═══════════════════════════════════════════════════════════════
    def sales_invoice?
      invoice_type == 'sales_invoice'
    end

    def bill?
      invoice_type == 'bill'
    end

    def credit_note?
      invoice_type == 'credit_note'
    end

    def standalone?
      external_provider.blank?
    end

    def linked?
      external_invoice_id.present?
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Status
    # ═══════════════════════════════════════════════════════════════
    def draft?
      status == 'draft'
    end

    def submitted?
      status == 'submitted'
    end

    def approved?
      status == 'approved'
    end

    def paid?
      status == 'paid'
    end

    def voided?
      status == 'voided'
    end

    def editable?
      draft?
    end

    def can_approve?
      draft? || submitted?
    end

    def can_void?
      !voided? && !deleted?
    end

    def overdue?
      !paid? && due_date.present? && due_date < Date.current
    end

    def days_overdue
      return 0 unless overdue?
      (Date.current - due_date).to_i
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Actions
    # ═══════════════════════════════════════════════════════════════
    def approve!(user = nil)
      return false unless can_approve?

      update!(
        status: 'approved',
        approved_at: Time.current,
        approved_by: user
      )

      journalize! unless journalized?
      true
    end

    def void!(reason = nil)
      return false unless can_void?

      transaction do
        # Void the journal entry if exists
        if gl_journal_entry.present?
          gl_journal_entry.void!(reason)
        end

        update!(
          status: 'voided',
          journalized: false
        )
      end

      true
    end

    def mark_paid!
      return if paid?

      update!(status: 'paid', amount_due: 0)
    end

    def mark_for_push!
      update!(pending_push: true, teeem_updated_at: Time.current)
    end

    def mark_synced!(external_modified_at = nil)
      update!(
        external_synced_at: Time.current,
        external_updated_at: external_modified_at,
        pending_push: false,
        sync_error: nil
      )
    end

    def record_sync_error!(message)
      update!(sync_error: message)
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Journalization
    # ═══════════════════════════════════════════════════════════════
    def journalize!
      return if journalized?
      return unless approved?

      journalizer = Gl::Journalizers::Invoice.new(self)
      entry = journalizer.journalize

      if entry.persisted?
        update!(gl_journal_entry: entry, journalized: true)
      end

      entry
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Calculations
    # ═══════════════════════════════════════════════════════════════
    def calculate_totals
      self.subtotal = lines.sum(&:line_amount)
      self.total_tax = lines.sum(&:tax_amount)
      self.total = subtotal + total_tax
    end

    def recalculate_totals!
      calculate_totals
      save!
    end

    def update_amount_due
      paid = payment_allocations.sum(:amount)
      self.amount_paid = paid
      self.amount_due = total - paid

      # Mark as paid if fully paid
      if amount_due <= 0 && !paid?
        update_column(:status, 'paid')
      end
    end

    def recalculate_amount_due!
      update_amount_due
      save!
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Display
    # ═══════════════════════════════════════════════════════════════
    def display_name
      case invoice_type
      when 'sales_invoice'
        "Invoice #{invoice_number} - #{contact_name}"
      when 'bill'
        "Bill #{invoice_number} - #{contact_name}"
      when 'credit_note'
        "Credit Note #{invoice_number} - #{contact_name}"
      else
        "#{invoice_type.titleize} #{invoice_number}"
      end
    end

    def status_badge
      case status
      when 'draft' then { text: 'Draft', color: 'gray' }
      when 'submitted' then { text: 'Submitted', color: 'blue' }
      when 'approved' then { text: 'Approved', color: 'green' }
      when 'paid' then { text: 'Paid', color: 'green' }
      when 'voided' then { text: 'Voided', color: 'red' }
      when 'deleted' then { text: 'Deleted', color: 'red' }
      else { text: status.titleize, color: 'gray' }
      end
    end

    def type_badge
      case invoice_type
      when 'sales_invoice' then { text: 'Invoice', color: 'blue' }
      when 'bill' then { text: 'Bill', color: 'orange' }
      when 'credit_note' then { text: 'Credit Note', color: 'purple' }
      else { text: invoice_type.titleize, color: 'gray' }
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Xero Compatibility
    # ═══════════════════════════════════════════════════════════════
    XERO_TYPE_MAP = {
      'sales_invoice' => 'ACCREC',
      'bill' => 'ACCPAY',
      'credit_note' => 'ACCRECREDIT'
    }.freeze

    XERO_STATUS_MAP = {
      'draft' => 'DRAFT',
      'submitted' => 'SUBMITTED',
      'approved' => 'AUTHORISED',
      'paid' => 'PAID',
      'voided' => 'VOIDED',
      'deleted' => 'DELETED'
    }.freeze

    def xero_type
      XERO_TYPE_MAP[invoice_type] || 'ACCREC'
    end

    def xero_status
      XERO_STATUS_MAP[status] || 'DRAFT'
    end

    def self.normalize_xero_type(xero_type)
      XERO_TYPE_MAP.invert[xero_type] || 'sales_invoice'
    end

    def self.normalize_xero_status(xero_status)
      XERO_STATUS_MAP.invert[xero_status] || 'draft'
    end
  end
end

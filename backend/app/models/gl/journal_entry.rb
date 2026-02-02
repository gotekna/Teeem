# frozen_string_literal: true

module Gl
  class JournalEntry < ApplicationRecord
    self.table_name = 'gl_journal_entries'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :gl_period, class_name: 'Gl::Period'
    belongs_to :job, optional: true
    belongs_to :created_by, class_name: 'User', optional: true

    has_many :ledger_lines, class_name: 'Gl::LedgerLine', foreign_key: 'gl_journal_entry_id', dependent: :destroy
    accepts_nested_attributes_for :ledger_lines, allow_destroy: true

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    SOURCE_TYPES = %w[
      invoice bill payment bank_transaction
      credit_note manual_journal opening_balance
      year_end_close adjustment
    ].freeze
    STATUSES = %w[draft posted voided].freeze
    PROVIDERS = %w[xero quickbooks myob].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :entry_date, presence: true
    validates :source_type, presence: true, inclusion: { in: SOURCE_TYPES }
    validates :status, inclusion: { in: STATUSES }
    validates :external_provider, inclusion: { in: PROVIDERS }, allow_blank: true
    validates :currency_code, presence: true
    validates :exchange_rate, numericality: { greater_than: 0 }
    validate :debits_equal_credits, if: :posted?
    validate :period_is_open, on: :create

    # ═══════════════════════════════════════════════════════════════
    # CALLBACKS
    # ═══════════════════════════════════════════════════════════════
    before_validation :set_defaults
    before_save :calculate_totals
    after_save :update_account_balances, if: :saved_change_to_status?

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :draft, -> { where(status: 'draft') }
    scope :posted, -> { where(status: 'posted') }
    scope :voided, -> { where(status: 'voided') }
    scope :active, -> { where.not(status: 'voided') }
    scope :ordered, -> { order(:entry_date, :id) }
    scope :reverse_ordered, -> { order(entry_date: :desc, id: :desc) }
    scope :for_provider, ->(provider, tenant_id) {
      where(external_provider: provider, external_tenant_id: tenant_id)
    }
    scope :standalone, -> { where(external_provider: nil) }
    scope :for_period, ->(period) { where(gl_period: period) }
    scope :for_date_range, ->(start_date, end_date) {
      where(entry_date: start_date..end_date)
    }
    scope :for_source, ->(source_type) { where(source_type: source_type) }
    scope :for_job, ->(job) { where(job: job) }

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    def draft?
      status == 'draft'
    end

    def posted?
      status == 'posted'
    end

    def voided?
      status == 'voided'
    end

    def balanced?
      (total_debits - total_credits).abs < 0.01
    end

    def post!
      return false unless draft?
      return false unless balanced?

      transaction do
        update!(status: 'posted')
        recalculate_affected_balances
      end
    end

    def void!(reason = nil)
      return false if voided?

      transaction do
        update!(
          status: 'voided',
          voided_at: Time.current,
          void_reason: reason
        )
        recalculate_affected_balances
      end
    end

    def linked?
      external_source_id.present?
    end

    def standalone?
      external_provider.nil?
    end

    # Generate the next entry number
    def generate_entry_number
      return if entry_number.present?

      year = entry_date&.year || Date.current.year
      last_entry = self.class
        .where(corporate_company: corporate_company)
        .where('entry_number LIKE ?', "JE-#{year}-%")
        .order(entry_number: :desc)
        .first

      if last_entry
        last_num = last_entry.entry_number.split('-').last.to_i
        self.entry_number = format("JE-#{year}-%05d", last_num + 1)
      else
        self.entry_number = format("JE-#{year}-%05d", 1)
      end
    end

    # Add a debit line
    def add_debit(account, amount, description: nil, job: nil, contact: nil, tax_type: nil)
      ledger_lines.build(
        gl_account: account,
        debit: amount,
        credit: 0,
        description: description,
        job: job,
        contact: contact,
        tax_type: tax_type
      )
    end

    # Add a credit line
    def add_credit(account, amount, description: nil, job: nil, contact: nil, tax_type: nil)
      ledger_lines.build(
        gl_account: account,
        debit: 0,
        credit: amount,
        description: description,
        job: job,
        contact: contact,
        tax_type: tax_type
      )
    end

    private

    def set_defaults
      self.status ||= 'draft'
      self.currency_code ||= 'AUD'
      self.exchange_rate ||= 1.0
      generate_entry_number
    end

    def calculate_totals
      self.total_debits = ledger_lines.reject(&:marked_for_destruction?).sum(&:debit)
      self.total_credits = ledger_lines.reject(&:marked_for_destruction?).sum(&:credit)
    end

    def debits_equal_credits
      return if balanced?

      errors.add(:base, "Debits ($#{total_debits}) must equal credits ($#{total_credits})")
    end

    def period_is_open
      return unless gl_period
      return if gl_period.can_post_entries?

      errors.add(:gl_period, 'is closed and cannot accept new entries')
    end

    def update_account_balances
      recalculate_affected_balances if posted? || voided?
    end

    def recalculate_affected_balances
      # Get all affected accounts
      account_ids = ledger_lines.pluck(:gl_account_id).uniq

      # Queue balance recalculation for each account
      account_ids.each do |account_id|
        # This would call a service to recalculate balances
        # Gl::BalanceCalculator.recalculate_account(account_id, gl_period)
      end
    end
  end
end

# frozen_string_literal: true

module Gl
  class OpeningBalance < ApplicationRecord
    self.table_name = 'gl_opening_balances'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :gl_account, class_name: 'Gl::Account'

    # Delegate
    delegate :code, :name, :account_type, :is_bank_account, to: :gl_account, prefix: :account

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    SOURCES = %w[xero_sync quickbooks_sync myob_sync manual migration year_end_rollover].freeze
    PROVIDERS = %w[xero quickbooks myob].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :effective_date, presence: true
    validates :source, inclusion: { in: SOURCES }, allow_blank: true
    validates :external_provider, inclusion: { in: PROVIDERS }, allow_blank: true
    validates :gl_account_id, uniqueness: {
      scope: :effective_date,
      message: 'already has an opening balance for this date'
    }
    validates :financial_year, format: { with: /\AFY\d{4}\z/ }, allow_blank: true

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :for_account, ->(account) { where(gl_account: account) }
    scope :for_date, ->(date) { where(effective_date: date) }
    scope :for_financial_year, ->(fy) { where(financial_year: fy) }
    scope :for_provider, ->(provider, tenant_id) {
      where(external_provider: provider, external_tenant_id: tenant_id)
    }
    scope :standalone, -> { where(external_provider: nil) }
    scope :on_or_before, ->(date) { where('effective_date <= ?', date) }
    scope :latest_first, -> { order(effective_date: :desc) }
    scope :ordered, -> { order(:effective_date) }
    scope :bank_accounts_only, -> {
      joins(:gl_account).where(gl_accounts: { is_bank_account: true })
    }
    scope :reconciled, -> { where.not(reconciled_balance: nil) }

    # ═══════════════════════════════════════════════════════════════
    # CLASS METHODS
    # ═══════════════════════════════════════════════════════════════
    class << self
      # Get the effective opening balance for an account as of a date
      def balance_for(account, as_of_date)
        for_account(account)
          .on_or_before(as_of_date)
          .latest_first
          .first
          &.balance || 0
      end

      # Create opening balances for a new financial year (year-end rollover)
      def rollover_to_new_year(corporate_company, from_fy, to_fy)
        # Get closing balances for all balance sheet accounts
        Gl::Account
          .where(corporate_company: corporate_company)
          .balance_sheet
          .active
          .find_each do |account|
            # Get the closing balance as of the last day of from_fy
            last_period = Gl::Period
              .where(corporate_company: corporate_company, financial_year: from_fy)
              .order(period_number: :desc)
              .first

            next unless last_period

            closing_balance = Gl::AccountBalance
              .for_account(account)
              .for_period(last_period)
              .first
              &.closing_balance || 0

            # Create opening balance for new FY
            # FY2025 starts July 1, 2024
            fy_year = to_fy.gsub('FY', '').to_i
            effective_date = Date.new(fy_year - 1, 7, 1)

            find_or_initialize_by(
              corporate_company: corporate_company,
              gl_account: account,
              effective_date: effective_date
            ).tap do |ob|
              ob.balance = closing_balance
              ob.source = 'year_end_rollover'
              ob.financial_year = to_fy
              ob.save!
            end
          end
      end

      # Set opening balance for an account
      def set_balance(account, date, balance, source: 'manual', financial_year: nil)
        find_or_initialize_by(
          corporate_company: account.corporate_company,
          gl_account: account,
          effective_date: date
        ).tap do |ob|
          ob.balance = balance
          ob.source = source
          ob.financial_year = financial_year || Gl::Period.financial_year_for(date)
          ob.save!
        end
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Is this from an external sync?
    def synced?
      source&.end_with?('_sync')
    end

    # Is this from year-end rollover?
    def rollover?
      source == 'year_end_rollover'
    end

    # Is this manually entered?
    def manual?
      source == 'manual'
    end

    # Is this a bank account with reconciled balance?
    def reconciled?
      reconciled_balance.present?
    end

    # Difference between book and reconciled balance
    def reconciliation_difference
      return nil unless reconciled?

      balance - reconciled_balance
    end

    # Display balance with sign based on account type
    def signed_balance
      if gl_account.debit_normal?
        balance
      else
        -balance
      end
    end

    # Format for display
    def display_balance
      format('$%.2f', balance.abs)
    end
  end
end

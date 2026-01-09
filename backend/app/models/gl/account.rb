# frozen_string_literal: true

module Gl
  class Account < ApplicationRecord
    self.table_name = 'gl_accounts'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company
    belongs_to :parent_account, class_name: 'Gl::Account', optional: true

    has_many :child_accounts, class_name: 'Gl::Account', foreign_key: :parent_account_id, dependent: :nullify
    has_many :ledger_lines, class_name: 'Gl::LedgerLine', foreign_key: 'gl_account_id', dependent: :restrict_with_error
    has_many :account_balances, class_name: 'Gl::AccountBalance', foreign_key: 'gl_account_id', dependent: :destroy
    has_many :opening_balances, class_name: 'Gl::OpeningBalance', foreign_key: 'gl_account_id', dependent: :destroy
    has_many :budgets, class_name: 'Gl::Budget', foreign_key: 'gl_account_id', dependent: :destroy
    has_many :tax_rates, class_name: 'Gl::TaxRate', foreign_key: 'gl_account_id', dependent: :nullify

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    ACCOUNT_TYPES = %w[asset liability equity revenue expense].freeze
    ACCOUNT_CLASSES = %w[
      current_asset fixed_asset non_current_asset
      current_liability non_current_liability
      equity
      revenue direct_costs
      expense overhead depreciation
    ].freeze
    SYSTEM_ACCOUNTS = %w[
      accounts_receivable accounts_payable
      bank gst_collected gst_paid
      retained_earnings current_year_earnings
      sales cost_of_sales
    ].freeze
    PROVIDERS = %w[xero quickbooks myob].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :code, presence: true
    validates :name, presence: true
    validates :account_type, presence: true, inclusion: { in: ACCOUNT_TYPES }
    validates :account_class, inclusion: { in: ACCOUNT_CLASSES }, allow_blank: true
    validates :system_account, inclusion: { in: SYSTEM_ACCOUNTS }, allow_blank: true
    validates :external_provider, inclusion: { in: PROVIDERS }, allow_blank: true
    validates :code, uniqueness: {
      scope: [:corporate_company_id, :external_provider, :external_tenant_id],
      message: 'must be unique per company and provider'
    }

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :active, -> { where(active: true) }
    scope :inactive, -> { where(active: false) }
    scope :bank_accounts, -> { where(is_bank_account: true) }
    scope :system_accounts, -> { where(is_system_account: true) }
    scope :expense_claim_accounts, -> { where(show_in_expense_claims: true) }
    scope :top_level, -> { where(parent_account_id: nil) }
    scope :ordered, -> { order(:display_order, :code) }

    # Provider scopes
    scope :for_provider, ->(provider, tenant_id) {
      where(external_provider: provider, external_tenant_id: tenant_id)
    }
    scope :standalone, -> { where(external_provider: nil) }
    scope :linked, -> { where.not(external_account_id: nil) }
    scope :unlinked, -> { where(external_account_id: nil) }

    # Type scopes
    scope :assets, -> { where(account_type: 'asset') }
    scope :liabilities, -> { where(account_type: 'liability') }
    scope :equity, -> { where(account_type: 'equity') }
    scope :revenue, -> { where(account_type: 'revenue') }
    scope :expenses, -> { where(account_type: 'expense') }

    # Balance sheet vs P&L
    scope :balance_sheet, -> { where(account_type: %w[asset liability equity]) }
    scope :profit_loss, -> { where(account_type: %w[revenue expense]) }

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Is this account linked to an external provider?
    def linked?
      external_account_id.present?
    end

    # Is this a standalone (TEEEM-only) account?
    def standalone?
      external_provider.nil?
    end

    # Normal balance (debit or credit)
    # Assets and Expenses have debit normal balance
    # Liabilities, Equity, and Revenue have credit normal balance
    def debit_normal?
      account_type.in?(%w[asset expense])
    end

    def credit_normal?
      account_type.in?(%w[liability equity revenue])
    end

    # Calculate the balance for this account (positive = normal direction)
    def balance_for_period(period)
      account_balances.find_by(gl_period: period)&.closing_balance || 0
    end

    # Full account path (for hierarchical accounts)
    def full_name
      if parent_account
        "#{parent_account.full_name} > #{name}"
      else
        name
      end
    end

    # Display code with name
    def code_and_name
      "#{code} - #{name}"
    end
  end
end

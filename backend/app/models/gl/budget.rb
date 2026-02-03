# frozen_string_literal: true

module Gl
  class Budget < ApplicationRecord
    self.table_name = 'gl_budgets'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate, foreign_key: "company_id"
    belongs_to :gl_account, class_name: 'Gl::Account'
    belongs_to :gl_period, class_name: 'Gl::Period'
    belongs_to :job, optional: true

    # Delegate
    delegate :code, :name, :account_type, to: :gl_account, prefix: :account
    delegate :financial_year, :period_number, :period_name, to: :gl_period, prefix: :period

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    BUDGET_TYPES = %w[monthly quarterly annual].freeze
    PROVIDERS = %w[xero quickbooks myob].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :amount, presence: true, numericality: true
    validates :budget_type, inclusion: { in: BUDGET_TYPES }
    validates :external_provider, inclusion: { in: PROVIDERS }, allow_blank: true
    validates :gl_account_id, uniqueness: {
      scope: [:gl_period_id, :tracking_category, :tracking_option, :job_id],
      message: 'already has a budget for this period and tracking combination'
    }

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :for_account, ->(account) { where(gl_account: account) }
    scope :for_period, ->(period) { where(gl_period: period) }
    scope :for_job, ->(job) { where(job: job) }
    scope :for_financial_year, ->(fy) {
      joins(:gl_period).where(gl_periods: { financial_year: fy })
    }
    scope :for_provider, ->(provider, tenant_id) {
      where(external_provider: provider, external_tenant_id: tenant_id)
    }
    scope :standalone, -> { where(external_provider: nil) }
    scope :with_tracking, ->(category, option) {
      where(tracking_category: category, tracking_option: option)
    }
    scope :without_tracking, -> { where(tracking_category: nil) }
    scope :ordered_by_period, -> {
      joins(:gl_period).order('gl_periods.period_start')
    }

    # ═══════════════════════════════════════════════════════════════
    # CLASS METHODS
    # ═══════════════════════════════════════════════════════════════
    class << self
      # Get YTD budget for an account
      def ytd_budget_for(account, period)
        for_account(account)
          .joins(:gl_period)
          .where(gl_periods: { financial_year: period.financial_year })
          .where('gl_periods.period_number <= ?', period.period_number)
          .sum(:amount)
      end

      # Get annual budget for an account
      def annual_budget_for(account, financial_year)
        for_account(account)
          .for_financial_year(financial_year)
          .sum(:amount)
      end

      # Copy budgets from one FY to another
      def copy_to_new_year(corporate, from_fy, to_fy, adjustment: 0)
        # Create periods for new FY first
        Gl::Period.generate_for_year(corporate, to_fy)

        for_financial_year(from_fy)
          .where(corporate: corporate)
          .find_each do |budget|
            # Find corresponding period in new FY
            new_period = Gl::Period.find_by(
              corporate: corporate,
              financial_year: to_fy,
              period_number: budget.period_period_number
            )
            next unless new_period

            # Calculate adjusted amount
            adjusted_amount = budget.amount * (1 + adjustment / 100.0)

            create!(
              corporate: corporate,
              gl_account: budget.gl_account,
              gl_period: new_period,
              amount: adjusted_amount.round(2),
              budget_type: budget.budget_type,
              tracking_category: budget.tracking_category,
              tracking_option: budget.tracking_option,
              job: budget.job,
              notes: "Copied from #{from_fy} with #{adjustment}% adjustment"
            )
          end
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Get actual amount for this budget's account and period
    def actual_amount
      Gl::AccountBalance
        .for_account(gl_account)
        .for_period(gl_period)
        .first
        &.net_movement || 0
    end

    # Variance (positive = under budget, negative = over budget)
    def variance
      amount - actual_amount
    end

    # Variance percentage
    def variance_percentage
      return nil if amount.zero?

      (variance / amount * 100).round(2)
    end

    # Is spending under budget?
    def under_budget?
      variance >= 0
    end

    # Is spending over budget?
    def over_budget?
      variance.negative?
    end

    # Status based on variance
    def status
      pct = variance_percentage
      return :unknown if pct.nil?

      if pct >= 10
        :excellent
      elsif pct >= 0
        :on_track
      elsif pct >= -10
        :warning
      else
        :over_budget
      end
    end

    # Has tracking categories?
    def has_tracking?
      tracking_category.present?
    end

    # Is this a job-specific budget?
    def job_budget?
      job_id.present?
    end

    # Display amount
    def display_amount
      format('$%.2f', amount)
    end

    # Display variance
    def display_variance
      v = variance
      sign = v.negative? ? '-' : '+'
      "#{sign}$#{format('%.2f', v.abs)}"
    end
  end
end

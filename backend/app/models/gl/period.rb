# frozen_string_literal: true

module Gl
  class Period < ApplicationRecord
    self.table_name = 'gl_periods'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :closed_by, class_name: 'User', optional: true

    has_many :journal_entries, class_name: 'Gl::JournalEntry', foreign_key: 'gl_period_id', dependent: :restrict_with_error
    has_many :account_balances, class_name: 'Gl::AccountBalance', foreign_key: 'gl_period_id', dependent: :destroy
    has_many :budgets, class_name: 'Gl::Budget', foreign_key: 'gl_period_id', dependent: :destroy

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    STATUSES = %w[open closed locked].freeze
    PROVIDERS = %w[xero quickbooks myob].freeze

    # Australian financial year: July (1) to June (12)
    MONTH_TO_PERIOD = {
      7 => 1, 8 => 2, 9 => 3, 10 => 4, 11 => 5, 12 => 6,
      1 => 7, 2 => 8, 3 => 9, 4 => 10, 5 => 11, 6 => 12
    }.freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :financial_year, presence: true, format: { with: /\AFY\d{4}\z/, message: 'must be in format FY2025' }
    validates :period_number, presence: true, inclusion: { in: 1..12 }
    validates :period_start, presence: true
    validates :period_end, presence: true
    validates :status, inclusion: { in: STATUSES }
    validates :external_provider, inclusion: { in: PROVIDERS }, allow_blank: true
    validates :period_number, uniqueness: {
      scope: [:corporate_company_id, :external_provider, :external_tenant_id, :financial_year],
      message: 'must be unique per financial year'
    }
    validate :period_end_after_start

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :open, -> { where(status: 'open') }
    scope :closed, -> { where(status: 'closed') }
    scope :locked, -> { where(status: 'locked') }
    scope :ordered, -> { order(:period_start) }
    scope :reverse_ordered, -> { order(period_start: :desc) }
    scope :for_financial_year, ->(fy) { where(financial_year: fy) }
    scope :for_provider, ->(provider, tenant_id) {
      where(external_provider: provider, external_tenant_id: tenant_id)
    }
    scope :standalone, -> { where(external_provider: nil) }
    scope :containing_date, ->(date) {
      where('period_start <= ? AND period_end >= ?', date, date)
    }

    # ═══════════════════════════════════════════════════════════════
    # CLASS METHODS
    # ═══════════════════════════════════════════════════════════════
    class << self
      # Get the financial year string for a date (e.g., "FY2025" for July 2024)
      def financial_year_for(date)
        year = date.month >= 7 ? date.year + 1 : date.year
        "FY#{year}"
      end

      # Get the period number for a date (July = 1, June = 12)
      def period_number_for(date)
        MONTH_TO_PERIOD[date.month]
      end

      # Find or create period for a given date
      def for_date(corporate_company, date, provider: nil, tenant_id: nil)
        fy = financial_year_for(date)
        period_num = period_number_for(date)

        find_or_create_by!(
          corporate_company: corporate_company,
          external_provider: provider,
          external_tenant_id: tenant_id,
          financial_year: fy,
          period_number: period_num
        ) do |period|
          period.period_start = date.beginning_of_month
          period.period_end = date.end_of_month
          period.period_name = date.strftime('%B %Y')
        end
      end

      # Generate all periods for a financial year
      def generate_for_year(corporate_company, fy_year, provider: nil, tenant_id: nil)
        # FY2025 = July 2024 to June 2025
        start_year = fy_year.to_s.gsub('FY', '').to_i - 1

        12.times do |i|
          month = ((i + 6) % 12) + 1
          year = month >= 7 ? start_year : start_year + 1
          date = Date.new(year, month, 1)
          for_date(corporate_company, date, provider: provider, tenant_id: tenant_id)
        end
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    def open?
      status == 'open'
    end

    def closed?
      status == 'closed'
    end

    def locked?
      status == 'locked'
    end

    def can_post_entries?
      open?
    end

    def first_period_of_year?
      period_number == 1
    end

    def last_period_of_year?
      period_number == 12
    end

    def close!(user = nil)
      return false unless open?

      update!(status: 'closed', closed_at: Time.current, closed_by: user)
    end

    def lock!
      return false unless closed?

      update!(status: 'locked')
    end

    def reopen!
      return false if locked?

      update!(status: 'open', closed_at: nil, closed_by: nil)
    end

    # Previous period in the same financial year or prior year
    def previous_period
      if period_number == 1
        # Go to period 12 of previous FY
        prev_fy = "FY#{financial_year.gsub('FY', '').to_i - 1}"
        self.class.find_by(
          corporate_company: corporate_company,
          external_provider: external_provider,
          external_tenant_id: external_tenant_id,
          financial_year: prev_fy,
          period_number: 12
        )
      else
        self.class.find_by(
          corporate_company: corporate_company,
          external_provider: external_provider,
          external_tenant_id: external_tenant_id,
          financial_year: financial_year,
          period_number: period_number - 1
        )
      end
    end

    # Next period
    def next_period
      if period_number == 12
        # Go to period 1 of next FY
        next_fy = "FY#{financial_year.gsub('FY', '').to_i + 1}"
        self.class.find_by(
          corporate_company: corporate_company,
          external_provider: external_provider,
          external_tenant_id: external_tenant_id,
          financial_year: next_fy,
          period_number: 1
        )
      else
        self.class.find_by(
          corporate_company: corporate_company,
          external_provider: external_provider,
          external_tenant_id: external_tenant_id,
          financial_year: financial_year,
          period_number: period_number + 1
        )
      end
    end

    private

    def period_end_after_start
      return unless period_start && period_end

      if period_end <= period_start
        errors.add(:period_end, 'must be after period start')
      end
    end
  end
end

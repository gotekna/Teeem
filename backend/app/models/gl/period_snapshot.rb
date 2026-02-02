# frozen_string_literal: true

module Gl
  # Snapshot of financial data for a period (for comparative reporting)
  class PeriodSnapshot < ApplicationRecord
    self.table_name = "gl_period_snapshots"

    PERIOD_TYPES = %w[month quarter year].freeze

    belongs_to :corporate, foreign_key: "company_id"

    validates :period_type, presence: true, inclusion: { in: PERIOD_TYPES }
    validates :period_start, presence: true
    validates :period_end, presence: true
    validates :period_start, uniqueness: { scope: [:corporate_id, :period_type] }

    scope :for_type, ->(type) { where(period_type: type) }
    scope :finalized, -> { where(finalized: true) }
    scope :recent, -> { order(period_start: :desc) }

    # Generate snapshot for a period
    def self.generate!(company, period_type:, period_start:, period_end:, label: nil)
      snapshot = find_or_initialize_by(
        corporate: company,
        period_type: period_type,
        period_start: period_start
      )

      snapshot.period_end = period_end
      snapshot.label = label || generate_label(period_type, period_start)
      snapshot.capture_data!
      snapshot.save!
      snapshot
    end

    # Capture current data
    def capture_data!
      self.account_balances = capture_account_balances
      self.department_totals = capture_department_totals
      self.class_totals = capture_class_totals
      self.kpi_values = capture_kpis
    end

    # Finalize (lock) snapshot
    def finalize!
      update!(finalized: true)
    end

    # Compare to another snapshot
    def compare_to(other_snapshot)
      return nil unless other_snapshot

      {
        period: { current: label, previous: other_snapshot.label },
        accounts: compare_account_balances(other_snapshot),
        departments: compare_department_totals(other_snapshot),
        kpis: compare_kpis(other_snapshot)
      }
    end

    # Compare to same period last year
    def year_over_year
      previous_year_start = period_start - 1.year
      previous_snapshot = self.class.find_by(
        corporate: corporate,
        period_type: period_type,
        period_start: previous_year_start
      )

      compare_to(previous_snapshot)
    end

    # Compare to previous period
    def period_over_period
      previous_start = case period_type
                       when "month" then period_start - 1.month
                       when "quarter" then period_start - 3.months
                       when "year" then period_start - 1.year
                       end

      previous_snapshot = self.class.find_by(
        corporate: corporate,
        period_type: period_type,
        period_start: previous_start
      )

      compare_to(previous_snapshot)
    end

    private

    def self.generate_label(period_type, period_start)
      case period_type
      when "month" then period_start.strftime("%b %Y")
      when "quarter" then "Q#{((period_start.month - 1) / 3) + 1} #{period_start.year}"
      when "year" then "FY#{period_start.year}"
      end
    end

    def capture_account_balances
      corporate.gl_accounts.pluck(:id, :balance).to_h
    end

    def capture_department_totals
      corporate.gl_departments.active.to_h do |dept|
        pl = dept.profit_loss(start_date: period_start, end_date: period_end)
        [dept.id, pl]
      end
    end

    def capture_class_totals
      corporate.gl_tracking_classes.active.to_h do |tc|
        totals = tc.totals(start_date: period_start, end_date: period_end)
        [tc.id, totals]
      end
    end

    def capture_kpis
      corporate.gl_kpi_definitions.active.to_h do |kpi|
        value = kpi.calculate(start_date: period_start, end_date: period_end)
        [kpi.code, value]
      end
    end

    def compare_account_balances(other)
      account_balances.map do |account_id, current_balance|
        previous_balance = other.account_balances[account_id.to_s] || 0
        change = current_balance - previous_balance
        change_percent = previous_balance.nonzero? ? (change / previous_balance * 100).round(2) : nil

        {
          account_id: account_id,
          current: current_balance,
          previous: previous_balance,
          change: change,
          change_percent: change_percent
        }
      end
    end

    def compare_department_totals(other)
      department_totals.map do |dept_id, current|
        previous = other.department_totals[dept_id.to_s] || {}

        {
          department_id: dept_id,
          current: current,
          previous: previous,
          profit_change: (current["profit"] || 0) - (previous["profit"] || 0)
        }
      end
    end

    def compare_kpis(other)
      kpi_values.map do |kpi_code, current_value|
        previous_value = other.kpi_values[kpi_code] || 0
        change = current_value - previous_value

        {
          kpi_code: kpi_code,
          current: current_value,
          previous: previous_value,
          change: change
        }
      end
    end
  end
end

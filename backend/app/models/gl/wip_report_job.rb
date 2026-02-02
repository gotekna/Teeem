# frozen_string_literal: true

module Gl
  # WIP Report details for a specific job
  class WipReportJob < ApplicationRecord
    self.table_name = "gl_wip_report_jobs"

    COMPLETION_METHODS = %w[cost_to_cost units_delivered milestones].freeze
    JOB_STATUSES = %w[active completed on_hold loss_expected].freeze

    belongs_to :wip_report, class_name: "Gl::WipReport"
    belongs_to :job

    validates :contract_value, presence: true
    validates :completion_method, inclusion: { in: COMPLETION_METHODS }

    # Calculate WIP data from job actuals
    def calculate_from_job!
      # Get contract value from job
      self.contract_value = job.value || job.estimate_total || 0
      self.approved_variations = job.approved_variations || 0
      self.revised_contract_value = contract_value + approved_variations

      # Calculate costs
      self.costs_to_date = calculate_costs_to_date
      self.estimated_costs_to_complete = job.estimated_costs_to_complete || 0
      self.total_estimated_costs = costs_to_date + estimated_costs_to_complete

      # Calculate completion percentage (cost-to-cost method)
      self.completion_percentage = calculate_completion_percentage

      # Calculate revenue recognition
      self.revenue_recognized = (revised_contract_value * completion_percentage / 100).round(2)
      self.revenue_recognized_prior = calculate_prior_revenue
      self.revenue_this_period = revenue_recognized - revenue_recognized_prior

      # Calculate billings
      self.billings_to_date = calculate_billings_to_date
      self.unbilled_revenue = [revenue_recognized - billings_to_date, 0].max

      # Calculate WIP position
      if costs_to_date > billings_to_date
        self.costs_in_excess_of_billings = costs_to_date - billings_to_date
        self.billings_in_excess_of_costs = 0
      else
        self.costs_in_excess_of_billings = 0
        self.billings_in_excess_of_costs = billings_to_date - costs_to_date
      end

      # Calculate profitability
      calculate_profitability!

      # Set status
      self.status = determine_status
    end

    private

    def calculate_costs_to_date
      # Sum of all costs posted to this job
      Gl::JournalEntry.joins(:account)
                      .where(job_id: job.id)
                      .where(gl_accounts: { account_type: "expense" })
                      .where("date <= ?", wip_report.report_date)
                      .sum(:amount).abs
    end

    def calculate_completion_percentage
      return 100.0 if job.status == "completed"
      return 0 if total_estimated_costs.to_d.zero?

      pct = (costs_to_date / total_estimated_costs * 100)
      [pct, 100].min.round(2)
    end

    def calculate_prior_revenue
      # Get revenue recognized from previous WIP report
      prior_report = Gl::WipReport
                     .where(company_id: wip_report.corporate_id)
                     .where("report_date < ?", wip_report.report_date)
                     .order(report_date: :desc)
                     .first

      return 0 unless prior_report

      prior_job = prior_report.jobs.find_by(job_id: job.id)
      prior_job&.revenue_recognized || 0
    end

    def calculate_billings_to_date
      # Sum of invoices for this job
      Gl::Invoice.where(job_id: job.id)
                 .where("date <= ?", wip_report.report_date)
                 .where(status: %w[submitted paid])
                 .sum(:total)
    end

    def calculate_profitability!
      self.gross_profit = revenue_recognized - costs_to_date
      self.gross_profit_pct = revenue_recognized.positive? ? (gross_profit / revenue_recognized * 100).round(2) : 0
      self.estimated_profit_at_completion = revised_contract_value - total_estimated_costs
    end

    def determine_status
      return "completed" if completion_percentage >= 100
      return "loss_expected" if estimated_profit_at_completion.negative?
      return "on_hold" if job.status == "on_hold"

      "active"
    end
  end
end

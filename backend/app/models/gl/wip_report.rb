# frozen_string_literal: true

module Gl
  # Work in Progress report for construction projects
  class WipReport < ApplicationRecord
    self.table_name = "gl_wip_reports"

    STATUSES = %w[draft final archived].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :created_by, class_name: "User", optional: true

    has_many :jobs, class_name: "Gl::WipReportJob", foreign_key: "wip_report_id", dependent: :destroy

    validates :reference, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :report_date, presence: true
    validates :status, presence: true, inclusion: { in: STATUSES }

    before_create :generate_reference

    scope :draft, -> { where(status: "draft") }
    scope :final, -> { where(status: "final") }

    # Generate a new WIP report
    def self.generate!(company, as_of: Date.current, user: nil)
      report = create!(
        corporate_company: company,
        report_date: as_of,
        period_end: as_of,
        period_start: as_of.beginning_of_month,
        created_by: user,
        status: "draft"
      )

      # Add all active construction jobs
      company.jobs.where(status: "active", job_type: "construction").find_each do |job|
        report.add_job!(job)
      end

      report.calculate_totals!
      report
    end

    # Add a job to the report
    def add_job!(job)
      wip_job = jobs.build(job: job)
      wip_job.calculate_from_job!
      wip_job.save!
      wip_job
    end

    # Recalculate all job data
    def recalculate!
      jobs.each(&:calculate_from_job!)
      calculate_totals!
    end

    # Calculate summary totals
    def calculate_totals!
      update!(
        total_contract_value: jobs.sum(:revised_contract_value),
        total_costs_to_date: jobs.sum(:costs_to_date),
        total_estimated_costs: jobs.sum(:total_estimated_costs),
        total_revenue_recognized: jobs.sum(:revenue_recognized),
        total_billings_to_date: jobs.sum(:billings_to_date),
        total_wip_asset: jobs.sum(:costs_in_excess_of_billings),
        total_wip_liability: jobs.sum(:billings_in_excess_of_costs)
      )
    end

    # Finalize the report
    def finalize!
      return false unless status == "draft"

      recalculate!
      update!(status: "final")
    end

    # Archive the report
    def archive!
      update!(status: "archived")
    end

    # Net WIP position
    def net_wip_position
      total_wip_asset - total_wip_liability
    end

    # Overall completion percentage
    def overall_completion_pct
      return 0 if total_estimated_costs.to_d.zero?

      (total_costs_to_date / total_estimated_costs * 100).round(1)
    end

    # Jobs with expected losses
    def loss_jobs
      jobs.where(status: "loss_expected")
    end

    # Jobs over budget
    def over_budget_jobs
      jobs.where("total_estimated_costs > revised_contract_value")
    end

    private

    def generate_reference
      return if reference.present?

      year = Date.current.year.to_s[-2..]
      month = Date.current.strftime("%m")
      sequence = self.class.where(corporate_company_id: corporate_company_id)
                           .where("reference LIKE ?", "WIP#{year}#{month}%")
                           .count + 1

      self.reference = "WIP#{year}#{month}#{sequence.to_s.rjust(2, '0')}"
    end
  end
end

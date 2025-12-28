# frozen_string_literal: true

module HealthChecks
  # Health checks for Jobs
  # Foundation: jobs (slug-based lookup - SSoT)
  #
  # Checks:
  #   - Jobs without start date (warning)
  #   - Jobs without contract value (info)
  #   - Jobs without assigned PM (info)
  #
  class JobsCheck < BaseCheck
    FOUNDATION_SLUG = "jobs"

    def self.check_type
      "jobs"
    end

    # SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
    def self.foundation_id
      @foundation_id ||= Foundation.find_by(slug: FOUNDATION_SLUG)&.id
    end

    # Jobs missing start date
    def check_jobs_without_start_date
      jobs = Job.includes(:job_status)
               .where(start_date: nil)
               .where.not(job_statuses: { name: [ "Completed", "Cancelled", "Archived" ] })
               .select(:id, :name, :job_status_id)

      build_result(
        name: "Jobs Without Start Date",
        description: "Active jobs that do not have a start date set. This affects scheduling and reporting.",
        severity: :warning,
        items: jobs,
        icon: "calendar",
        action_path: "/jobs/:id"
      )
    end

    # Jobs missing contract price
    # SSoT: Check contract_price (THE ONE) - also check contract_value for backwards compat
    def check_jobs_without_contract_value
      jobs = Job.includes(:job_status)
               .where(contract_price: [ nil, 0 ])
               .where(contract_value: [ nil, 0 ])  # Also check legacy column
               .where.not(job_statuses: { name: [ "Completed", "Cancelled", "Archived" ] })
               .select(:id, :name, :job_status_id)

      build_result(
        name: "Jobs Without Contract Price",
        description: "Jobs without a contract price set. This affects financial reporting and profitability tracking.",
        severity: :info,
        items: jobs,
        icon: "currency-dollar",
        action_path: "/jobs/:id"
      )
    end

    # Jobs without project manager
    # Note: Jobs don't have direct project_manager_id - they have projects which have PMs
    # This checks for jobs without a project, or with a project that has no PM
    def check_jobs_without_pm
      jobs = Job.includes(:job_status, :project)
               .where.not(job_statuses: { name: [ "Completed", "Cancelled", "Archived", "Enquiry" ] })
               .where("projects.id IS NULL OR projects.project_manager_id IS NULL")
               .references(:projects)
               .select(:id, :name, :job_status_id)

      build_result(
        name: "Jobs Without Project Manager",
        description: "Active jobs without a project or assigned project manager.",
        severity: :info,
        items: jobs,
        icon: "user",
        action_path: "/jobs/:id"
      )
    end

    protected

    def format_items(items)
      items.map do |item|
        if item.is_a?(Hash)
          item
        elsif item.respond_to?(:name)
          {
            id: item.id,
            display: item.name,
            name: item.name,
            status: item.job_status&.name
          }
        else
          super
        end
      end
    end
  end
end

# frozen_string_literal: true

module HealthChecks
  # Health checks for Jobs
  # Foundation ID: 204
  #
  # Checks:
  #   - Jobs without start date (warning)
  #   - Jobs without contract value (info)
  #   - Jobs without assigned PM (info)
  #
  class JobsCheck < BaseCheck
    FOUNDATION_ID = 204

    def self.check_type
      "jobs"
    end

    def self.foundation_id
      FOUNDATION_ID
    end

    # Jobs missing start date
    def check_jobs_without_start_date
      jobs = Job.where(start_date: nil)
               .where.not(stage: [ "completed", "cancelled", "on_hold" ])
               .select(:id, :title, :ted_number, :stage)

      build_result(
        name: "Jobs Without Start Date",
        description: "Active jobs that do not have a start date set. This affects scheduling and reporting.",
        severity: :warning,
        items: jobs,
        icon: "calendar",
        action_path: "/jobs/:id"
      )
    end

    # Jobs missing contract value
    def check_jobs_without_contract_value
      jobs = Job.where(contract_value: [ nil, 0 ])
               .where.not(stage: [ "completed", "cancelled", "on_hold" ])
               .select(:id, :title, :ted_number, :stage)

      build_result(
        name: "Jobs Without Contract Value",
        description: "Jobs without a contract value set. This affects financial reporting and profitability tracking.",
        severity: :info,
        items: jobs,
        icon: "currency-dollar",
        action_path: "/jobs/:id"
      )
    end

    # Jobs without project manager
    def check_jobs_without_pm
      jobs = Job.where(project_manager_id: nil)
               .where.not(stage: [ "completed", "cancelled", "on_hold", "lead" ])
               .select(:id, :title, :ted_number, :stage)

      build_result(
        name: "Jobs Without Project Manager",
        description: "Active jobs without an assigned project manager.",
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
        elsif item.respond_to?(:ted_number)
          {
            id: item.id,
            display: "#{item.ted_number || 'No TED'} - #{item.title}",
            ted_number: item.ted_number,
            title: item.title,
            stage: item.try(:stage)
          }
        else
          super
        end
      end
    end
  end
end

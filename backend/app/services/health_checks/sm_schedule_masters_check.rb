# frozen_string_literal: true

module HealthChecks
  # Health checks for SM Schedule Master (Template Rows)
  # Foundation: sm-schedule-master (slug-based lookup - SSoT)
  #
  # Checks:
  #   - Missing duration (critical) - causes sync failures
  #   - Missing name (critical) - required field
  #   - Missing trade (warning) - affects task assignment
  #
  class SmScheduleMastersCheck < BaseCheck
    FOUNDATION_SLUG = "sm-schedule-master"

    def self.check_type
      "sm_schedule_masters"
    end

    # SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
    def self.foundation_id
      @foundation_id ||= Foundation.find_by(slug: FOUNDATION_SLUG)&.id
    end

    # Schedule master rows missing duration_days
    # This is CRITICAL because sync fails when duration is nil
    # EXCLUDES headers - they don't need duration
    def check_missing_duration
      # Get IDs of all header rows (rows referenced by other rows' header_gantt)
      header_ids = SmScheduleMaster.active
                                   .where(header_gantt: "Header")
                                   .pluck(:id)

      rows = SmScheduleMaster.active
                             .where("duration_days IS NULL OR duration_days = 0")
                             .where.not(id: header_ids)
                             .where.not(header_gantt: "Header")
                             .select(:id, :name, :task_number, :sequence_order, :header_gantt)

      build_result(
        name: "Missing Duration",
        description: "Template rows without duration (excludes headers). Sync will fail for these rows. Duration must be at least 1 day.",
        severity: :critical,
        items: rows,
        icon: "clock",
        action_path: "/schedule-master"
      )
    end

    # Schedule master rows missing name
    def check_missing_name
      rows = SmScheduleMaster.active
                             .where("name IS NULL OR name = ''")
                             .select(:id, :name, :task_number, :sequence_order)

      build_result(
        name: "Missing Name",
        description: "Template rows without a name. This is a required field.",
        severity: :critical,
        items: rows,
        icon: "document-text",
        action_path: "/schedule-master"
      )
    end

    # Schedule master rows missing trade assignment
    def check_missing_trade
      rows = SmScheduleMaster.active
                             .where(trade: nil)
                             .select(:id, :name, :task_number, :sequence_order)

      build_result(
        name: "Missing Trade",
        description: "Template rows without a trade assignment. This affects task scheduling and supplier assignment.",
        severity: :warning,
        items: rows,
        icon: "wrench-screwdriver",
        action_path: "/schedule-master"
      )
    end

    # Schedule master rows missing stage assignment
    def check_missing_stage
      rows = SmScheduleMaster.active
                             .where(stage: nil)
                             .select(:id, :name, :task_number, :sequence_order)

      build_result(
        name: "Missing Stage",
        description: "Template rows without a stage assignment. This affects Gantt chart grouping.",
        severity: :info,
        items: rows,
        icon: "queue-list",
        action_path: "/schedule-master"
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
            display: item.name.presence || "##{item.task_number || item.id}",
            name: item.name,
            task_number: item.task_number,
            sequence_order: item.sequence_order
          }
        else
          super
        end
      end
    end
  end
end

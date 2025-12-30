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
    # EXCLUDES headers - they don't need duration:
    #   - Rows with header_gantt = "Header" (self-declared headers)
    #   - Rows referenced by other rows as parent (implicit headers)
    def check_missing_duration
      # Find IDs of rows being used as parent headers by other rows
      parent_header_ids = SmScheduleMaster.active
                                          .where.not(header_gantt: [nil, "", "Header"])
                                          .pluck(:header_gantt)
                                          .map(&:to_i)
                                          .uniq

      rows = SmScheduleMaster.active
                             .where("duration_days IS NULL OR duration_days = 0")
                             .where("header_gantt IS NULL OR header_gantt != ?", "Header")
                             .where.not(id: parent_header_ids)
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

    # Headers should be clean - no duration, trade, stage, assigned_role, cost_centre, or parent header
    def check_dirty_headers
      rows = SmScheduleMaster.active
                             .where(header_gantt: "Header")
                             .where(<<~SQL)
                               (duration_days IS NOT NULL AND duration_days > 0)
                               OR trade IS NOT NULL
                               OR stage IS NOT NULL
                               OR assigned_role IS NOT NULL
                               OR cost_centre IS NOT NULL
                             SQL
                             .select(:id, :name, :task_number, :sequence_order)

      build_result(
        name: "Headers With Data",
        description: "Header rows should be clean (no duration, trade, stage, assigned_role, cost_centre). These headers have data that should be cleared.",
        severity: :warning,
        items: rows,
        icon: "exclamation-triangle",
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

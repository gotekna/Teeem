# frozen_string_literal: true

# Service to cascade schedule changes to dependent tasks
# When a task's start_date or duration changes, this service:
# 1. Finds all dependent tasks (tasks that have this task as a predecessor)
# 2. Recalculates their start dates based on dependency type and lag
# 3. Recursively cascades to their dependents
# 4. Returns all affected tasks
class ScheduleCascadeService
  # Recalculates dependent task dates when a task changes
  # @param task [ScheduleTemplateRow] The task that was updated
  # @param changed_attributes [Array<Symbol>] List of attributes that changed (e.g., [:start_date, :duration])
  # @return [Array<ScheduleTemplateRow>] List of all tasks affected by the cascade (including the original task)
  def self.cascade_changes(task, changed_attributes = [])
    new(task, changed_attributes).cascade
  end

  def initialize(task, changed_attributes = [])
    @task = task
    @changed_attributes = changed_attributes
    @affected_tasks = {}  # task_id => task (to avoid duplicates)
    @template = task.schedule_template
    # Use company timezone-aware today as reference date for day offset calculations
    # In real implementation, this would come from the actual project start date
    @reference_date = CompanySetting.today

    # Load company settings and holidays for working day calculations
    @company_settings = CompanySetting.instance
    @region = timezone_to_region(@company_settings.timezone)
    @holidays = load_holidays
  end

  def cascade
    # Only cascade if start_date or duration changed
    return [ @task ] unless cascade_needed?

    Rails.logger.info "🔄 CASCADE: Task #{@task.id} changed (#{@changed_attributes.join(', ')})"

    # Add the original task to affected list
    @affected_tasks[@task.id] = @task

    # Recursively cascade to dependents
    cascade_to_dependents(@task)

    # Return all affected tasks
    affected_list = @affected_tasks.values
    Rails.logger.info "✅ CASCADE COMPLETE: #{affected_list.length} tasks affected"
    affected_list
  end

  private

  def cascade_needed?
    # Cascade if start_date or duration changed
    # We don't check manually_positioned here - we always cascade FROM any task
    # We skip cascading TO manually positioned tasks in cascade_to_dependents
    @changed_attributes.include?(:start_date) || @changed_attributes.include?(:duration)
  end

  def cascade_to_dependents(predecessor_task)
    # Find all tasks that depend on this task
    dependent_tasks = find_dependent_tasks(predecessor_task)

    Rails.logger.info "  📋 Found #{dependent_tasks.length} dependents of task #{predecessor_task.id} (sequence #{predecessor_task.sequence_order})"

    dependent_tasks.each do |dependent_task|
      # Skip if already processed (avoid infinite loops)
      next if @affected_tasks.key?(dependent_task.id)

      # Skip if manually positioned (user explicitly set the date)
      next if dependent_task.manually_positioned?

      # Calculate new start date based on predecessor
      new_start_date = calculate_start_date(dependent_task, predecessor_task)

      # Only update if date actually changed
      if new_start_date && dependent_task.start_date != new_start_date
        old_date = dependent_task.start_date
        dependent_task.update_column(:start_date, new_start_date)
        dependent_task.reload

        Rails.logger.info "  ✏️  Task #{dependent_task.id}: #{old_date} → #{new_start_date}"

        # Add to affected list
        @affected_tasks[dependent_task.id] = dependent_task

        # Recursively cascade to this task's dependents
        cascade_to_dependents(dependent_task)
      end
    end
  end

  def find_dependent_tasks(predecessor_task)
    # Find all tasks in the template where predecessor_ids contains this task
    # NOTE: predecessor_ids are 1-based (1, 2, 3...) while sequence_order is 0-based (0, 1, 2...)
    predecessor_id = predecessor_task.sequence_order + 1  # Convert 0-based to 1-based

    @template.schedule_template_rows.select do |row|
      next false if row.predecessor_ids.blank?

      row.predecessor_ids.any? { |pred| (pred["id"] || pred[:id]).to_i == predecessor_id }
    end
  end

  def calculate_start_date(dependent_task, predecessor_task)
    # Find the predecessor entry in dependent_task's predecessor_ids
    # NOTE: predecessor_ids are 1-based (1, 2, 3...) while sequence_order is 0-based (0, 1, 2...)
    predecessor_id = predecessor_task.sequence_order + 1  # Convert 0-based to 1-based
    pred_entry = dependent_task.predecessor_ids.find do |pred|
      (pred["id"] || pred[:id]).to_i == predecessor_id
    end

    return nil unless pred_entry

    # Extract dependency type and lag
    dep_type = pred_entry["type"] || pred_entry[:type] || "FS"
    lag = (pred_entry["lag"] || pred_entry[:lag] || 0).to_i

    # Calculate based on dependency type
    predecessor_start = predecessor_task.start_date
    duration = (predecessor_task.duration || 1)
    # Duration is inclusive: duration 1 = task runs for 1 day
    # End date is start + (duration - 1) since start day counts as day 1
    predecessor_end = predecessor_start + (duration - 1)

    calculated_start = case dep_type
    when "FS" # Finish-to-Start (most common)
      # Task finishes at end of predecessor_end day
      # Next task starts on predecessor_end (not +1, tasks can start same day one ends)
      predecessor_end + lag
    when "SS" # Start-to-Start
      predecessor_start + lag
    when "FF" # Finish-to-Finish
      dependent_end = predecessor_end + lag
      dependent_end - (dependent_task.duration || 1)
    when "SF" # Start-to-Finish (rare)
      dependent_end = predecessor_start + lag
      dependent_end - (dependent_task.duration || 1)
    else
      # Default to FS if unknown type
      predecessor_end + lag
    end

    # IMPORTANT: Tasks can only start on working days (skip weekends/holidays)
    # But respect lock hierarchy - locked tasks can stay on weekends
    if task_is_locked?(dependent_task)
      calculated_start  # Don't adjust locked tasks
    else
      skip_to_next_working_day(calculated_start)
    end
  end

  def task_is_locked?(task)
    # Check lock hierarchy (highest to lowest priority)
    task.supplier_confirm? ||
      task.confirm? ||
      task.start? ||
      task.complete? ||
      task.manually_positioned?
  end

  def skip_to_next_working_day(day_offset)
    # Convert day offset to actual date
    actual_date = @reference_date + day_offset.days

    # Skip weekends and holidays
    while !working_day?(actual_date)
      actual_date += 1.day
    end

    # Convert back to day offset
    (actual_date - @reference_date).to_i
  end

  def working_day?(date)
    # Check company settings for working days configuration
    working_days = @company_settings.working_days || {
      "monday" => true,
      "tuesday" => true,
      "wednesday" => true,
      "thursday" => true,
      "friday" => true,
      "saturday" => false,
      "sunday" => false
    }

    # Get day name in lowercase (e.g., "monday", "tuesday")
    day_name = date.strftime("%A").downcase

    # Return whether this day is configured as a working day
    working_days[day_name] == true
  end

  # Map timezone to region code for public holidays
  def timezone_to_region(timezone)
    case timezone
    when "Australia/Brisbane" then "QLD"
    when "Australia/Sydney", "Australia/Melbourne" then "NSW"
    when "Australia/Adelaide" then "SA"
    when "Australia/Perth" then "WA"
    when "Australia/Hobart" then "TAS"
    when "Australia/Darwin" then "NT"
    when "Pacific/Auckland" then "NZ"
    else "QLD" # Default to QLD
    end
  end

  # Load public holidays for the region
  # Cache them as a Set for O(1) lookup
  def load_holidays
    # Load holidays for current year and next 2 years to cover project schedules
    # Use company timezone-aware today
    today = CompanySetting.today
    year_range = (today.year..today.year + 2)

    holiday_dates = PublicHoliday
      .for_region(@region)
      .where("EXTRACT(YEAR FROM date) IN (?)", year_range.to_a)
      .pluck(:date)

    Set.new(holiday_dates)
  end
end

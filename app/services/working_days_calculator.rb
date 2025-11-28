# frozen_string_literal: true

# WorkingDaysCalculator - Business days calculation for SM Gantt
#
# Calculates working days considering:
# - Company working days (M-F by default, configurable)
# - Public holidays (future enhancement)
#
# See GANTT_ARCHITECTURE_PLAN.md Section 1.5
#
class WorkingDaysCalculator
  DAYS_OF_WEEK = %w[sunday monday tuesday wednesday thursday friday saturday].freeze

  attr_reader :working_days

  def initialize(company_setting = nil)
    @working_days = if company_setting&.working_days.present?
      company_setting.working_days
    else
      default_working_days
    end
  end

  # Add N working days to a date
  def add_working_days(start_date, days)
    return start_date if days.zero?

    date = start_date.is_a?(String) ? Date.parse(start_date) : start_date
    remaining = days.abs
    direction = days > 0 ? 1 : -1

    while remaining > 0
      date += direction.day
      remaining -= 1 if working_day?(date)
    end

    date
  end

  # Subtract N working days from a date
  def subtract_working_days(end_date, days)
    add_working_days(end_date, -days)
  end

  # Calculate working days between two dates (inclusive)
  def working_days_between(start_date, end_date)
    start_d = start_date.is_a?(String) ? Date.parse(start_date) : start_date
    end_d = end_date.is_a?(String) ? Date.parse(end_date) : end_date

    return 0 if start_d > end_d

    count = 0
    current = start_d
    while current <= end_d
      count += 1 if working_day?(current)
      current += 1.day
    end
    count
  end

  # Check if a date is a working day
  def working_day?(date)
    date = date.is_a?(String) ? Date.parse(date) : date
    day_name = DAYS_OF_WEEK[date.wday]

    # Check working days config
    return false unless @working_days[day_name]

    # Future: Check public holidays
    # return false if public_holiday?(date)

    true
  end

  # Get next working day on or after date
  def next_working_day(date)
    date = date.is_a?(String) ? Date.parse(date) : date
    return date if working_day?(date)

    while !working_day?(date)
      date += 1.day
    end
    date
  end

  # Get previous working day on or before date
  def previous_working_day(date)
    date = date.is_a?(String) ? Date.parse(date) : date
    return date if working_day?(date)

    while !working_day?(date)
      date -= 1.day
    end
    date
  end

  # Calculate end date given start date and duration (in working days)
  def calculate_end_date(start_date, duration_days)
    return start_date if duration_days <= 1

    # Start date counts as day 1, so we add (duration - 1) more working days
    add_working_days(start_date, duration_days - 1)
  end

  # Calculate duration in working days between two dates
  def calculate_duration(start_date, end_date)
    working_days_between(start_date, end_date)
  end

  private

  def default_working_days
    {
      'monday' => true,
      'tuesday' => true,
      'wednesday' => true,
      'thursday' => true,
      'friday' => true,
      'saturday' => false,
      'sunday' => false
    }
  end
end

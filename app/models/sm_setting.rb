# frozen_string_literal: true

# SmSetting - Singleton configuration for SM Gantt system
#
# See Trinity Bible Rules 9.27 (SM Gantt - Navigation and Setup)
# See GANTT_ARCHITECTURE_PLAN.md Section 2.8
#
class SmSetting < ApplicationRecord
  # Associations
  belongs_to :default_template, class_name: 'ScheduleTemplate', optional: true

  # Singleton pattern - always use instance method
  def self.instance
    first || create!(id: 1)
  end

  # Validations
  validates :rollover_timezone, presence: true, length: { maximum: 50 }
  validates :rollover_time, presence: true

  # Available timezones (Australian focus)
  TIMEZONES = [
    'Australia/Brisbane',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Australia/Adelaide',
    'Australia/Perth',
    'Australia/Darwin',
    'Australia/Hobart',
    'Pacific/Auckland',
    'UTC'
  ].freeze

  # Get current time in configured timezone
  def current_time
    Time.current.in_time_zone(rollover_timezone)
  end

  # Get today's date in configured timezone
  def today
    current_time.to_date
  end

  # Check if rollover should run now
  def rollover_due?
    return false unless rollover_enabled?

    current = current_time
    rollover_hour = rollover_time.hour
    rollover_minute = rollover_time.min

    current.hour == rollover_hour && current.min == rollover_minute
  end
end

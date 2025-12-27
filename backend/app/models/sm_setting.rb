# frozen_string_literal: true

# SmSetting - Singleton configuration for SM Gantt system
#
# See Trinity Bible Rules 9.27 (SM Gantt - Navigation and Setup)
# See GANTT_ARCHITECTURE_PLAN.md Section 2.8
#
class SmSetting < ApplicationRecord
  # Note: default_template_id column removed in Phase 6 Tier 2
  # Default template is now determined by SmScheduleMasterTemplate.default_template scope

  # Singleton pattern - always use instance method
  def self.instance
    first || create!(id: 1)
  end

  # Tag management methods
  def tags
    schedule_master_tags || []
  end

  def add_tag(tag_name)
    return false if tag_name.blank?
    tag_name = tag_name.strip
    return false if tags.include?(tag_name)

    update!(schedule_master_tags: tags + [tag_name])
    true
  end

  def remove_tag(tag_name)
    return false unless tags.include?(tag_name)

    update!(schedule_master_tags: tags - [tag_name])
    true
  end

  def rename_tag(old_name, new_name)
    return false unless tags.include?(old_name)
    return false if new_name.blank?
    new_name = new_name.strip
    return false if old_name == new_name
    return false if tags.include?(new_name)

    new_tags = tags.map { |t| t == old_name ? new_name : t }
    update!(schedule_master_tags: new_tags)
    true
  end

  # Trade management methods
  def trades
    schedule_master_trades || []
  end

  def add_trade(name)
    return false if name.blank?
    name = name.strip.upcase
    return false if trades.include?(name)

    update!(schedule_master_trades: trades + [name])
    true
  end

  def remove_trade(name)
    return false unless trades.include?(name)

    update!(schedule_master_trades: trades - [name])
    true
  end

  # Stage management methods
  def stages
    schedule_master_stages || []
  end

  def add_stage(name)
    return false if name.blank?
    name = name.strip.upcase
    return false if stages.include?(name)

    update!(schedule_master_stages: stages + [name])
    true
  end

  def remove_stage(name)
    return false unless stages.include?(name)

    update!(schedule_master_stages: stages - [name])
    true
  end

  # Role management methods
  def roles
    schedule_master_roles || []
  end

  def add_role(name)
    return false if name.blank?
    name = name.strip.downcase
    return false if roles.include?(name)

    update!(schedule_master_roles: roles + [name])
    true
  end

  def remove_role(name)
    return false unless roles.include?(name)

    update!(schedule_master_roles: roles - [name])
    true
  end

  # Validations
  validates :rollover_timezone, presence: true, length: { maximum: 50 }
  validates :rollover_time, presence: true

  # Available timezones (Australian focus)
  TIMEZONES = [
    "Australia/Brisbane",
    "Australia/Sydney",
    "Australia/Melbourne",
    "Australia/Adelaide",
    "Australia/Perth",
    "Australia/Darwin",
    "Australia/Hobart",
    "Pacific/Auckland",
    "UTC"
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

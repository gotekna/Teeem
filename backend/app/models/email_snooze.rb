# frozen_string_literal: true

# SSoT: Email Snooze System
# Temporarily hide emails from inbox, bring them back at specified time.
# Supports preset durations and custom times.
#
class EmailSnooze < ApplicationRecord
  belongs_to :email_warehouse
  belongs_to :user

  # Validations
  validates :snooze_until, presence: true
  validate :snooze_until_must_be_future, on: :create

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :inactive, -> { where(is_active: false) }
  scope :ready_to_wake, -> { active.where("snooze_until <= ?", Time.current) }
  scope :for_user, ->(user) { where(user: user) }
  scope :upcoming, -> { active.order(snooze_until: :asc) }

  # Preset snooze durations
  PRESETS = {
    later_today: {
      label: "Later today",
      description: "6:00 PM today",
      calculate: -> { Time.current.change(hour: 18, min: 0) }
    },
    tomorrow: {
      label: "Tomorrow",
      description: "8:00 AM tomorrow",
      calculate: -> { (Time.current + 1.day).change(hour: 8, min: 0) }
    },
    this_weekend: {
      label: "This weekend",
      description: "Saturday 9:00 AM",
      calculate: -> {
        days_until_saturday = (6 - Time.current.wday) % 7
        days_until_saturday = 7 if days_until_saturday.zero? && Time.current.hour >= 9
        (Time.current + days_until_saturday.days).change(hour: 9, min: 0)
      }
    },
    next_week: {
      label: "Next week",
      description: "Monday 8:00 AM",
      calculate: -> {
        days_until_monday = (8 - Time.current.wday) % 7
        days_until_monday = 7 if days_until_monday.zero?
        (Time.current + days_until_monday.days).change(hour: 8, min: 0)
      }
    },
    in_1_hour: {
      label: "In 1 hour",
      description: nil,
      calculate: -> { Time.current + 1.hour }
    },
    in_3_hours: {
      label: "In 3 hours",
      description: nil,
      calculate: -> { Time.current + 3.hours }
    },
    in_1_day: {
      label: "In 1 day",
      description: nil,
      calculate: -> { Time.current + 1.day }
    },
    in_3_days: {
      label: "In 3 days",
      description: nil,
      calculate: -> { Time.current + 3.days }
    },
    in_1_week: {
      label: "In 1 week",
      description: nil,
      calculate: -> { Time.current + 1.week }
    }
  }.freeze

  # Class methods

  # Snooze an email for a user
  # @param email [EmailWarehouse] The email to snooze
  # @param user [User] The user snoozing the email
  # @param until_time [DateTime] When to bring it back
  # @param reason [String] Optional reason/note
  def self.snooze!(email, user:, until_time:, reason: nil)
    # Cancel any existing active snooze for this email/user
    active.where(email_warehouse: email, user: user).update_all(is_active: false)

    create!(
      email_warehouse: email,
      user: user,
      snooze_until: until_time,
      reason: reason
    )
  end

  # Snooze using a preset duration
  def self.snooze_with_preset!(email, user:, preset:, reason: nil)
    preset_config = PRESETS[preset.to_sym]
    raise ArgumentError, "Unknown preset: #{preset}" unless preset_config

    until_time = preset_config[:calculate].call
    snooze!(email, user: user, until_time: until_time, reason: reason)
  end

  # Wake up all emails that are ready
  # Called by background job every minute
  def self.wakeup_ready!
    count = 0

    ready_to_wake.find_each do |snooze|
      snooze.wakeup!
      count += 1
    end

    count
  end

  # Get all snoozed emails for a user
  def self.snoozed_emails_for(user)
    EmailWarehouse
      .joins(:email_snoozes)
      .where(email_snoozes: { user: user, is_active: true })
      .order("email_snoozes.snooze_until ASC")
  end

  # Check if an email is snoozed for a user
  def self.snoozed?(email, user)
    active.exists?(email_warehouse: email, user: user)
  end

  # Get the active snooze for an email/user if any
  def self.active_snooze_for(email, user)
    active.find_by(email_warehouse: email, user: user)
  end

  # Get preset options with calculated times
  def self.preset_options
    PRESETS.map do |key, config|
      calculated_time = config[:calculate].call

      {
        key: key.to_s,
        label: config[:label],
        description: config[:description] || calculated_time.strftime("%a %b %d at %I:%M %p"),
        time: calculated_time
      }
    end
  end

  # Instance methods

  # Wake up this snoozed email
  def wakeup!
    return unless is_active

    update!(
      is_active: false,
      woken_at: Time.current
    )

    # TODO: Send notification to user that snoozed email is back
    # NotificationService.notify_snooze_wakeup(self)

    true
  end

  # Cancel/unsnooze
  def cancel!
    update!(is_active: false)
  end

  # Extend snooze time
  def extend!(new_until_time)
    update!(snooze_until: new_until_time)
  end

  # Time remaining until wakeup
  def time_remaining
    return nil unless is_active
    return nil if snooze_until <= Time.current

    snooze_until - Time.current
  end

  # Human-readable time remaining
  def time_remaining_in_words
    remaining = time_remaining
    return "Ready" unless remaining&.positive?

    if remaining < 1.hour
      "#{(remaining / 60).to_i} minutes"
    elsif remaining < 1.day
      "#{(remaining / 1.hour).to_i} hours"
    elsif remaining < 1.week
      "#{(remaining / 1.day).to_i} days"
    else
      "#{(remaining / 1.week).to_i} weeks"
    end
  end

  # JSON representation
  def as_json(options = {})
    {
      id: id,
      email_id: email_warehouse_id,
      user_id: user_id,
      snooze_until: snooze_until,
      is_active: is_active,
      reason: reason,
      woken_at: woken_at,
      time_remaining: time_remaining,
      time_remaining_in_words: time_remaining_in_words,
      created_at: created_at
    }
  end

  private

  def snooze_until_must_be_future
    return unless snooze_until.present? && snooze_until <= Time.current

    errors.add(:snooze_until, "must be in the future")
  end
end

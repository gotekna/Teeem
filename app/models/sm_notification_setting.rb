# frozen_string_literal: true

# SmNotificationSetting - User notification preferences
#
class SmNotificationSetting < ApplicationRecord
  belongs_to :user

  validates :user_id, uniqueness: true

  # Defaults
  attribute :email_task_reminders, :boolean, default: true
  attribute :email_schedule_updates, :boolean, default: true
  attribute :email_delay_alerts, :boolean, default: true
  attribute :push_enabled, :boolean, default: false
  attribute :reminder_days_before, :integer, default: 1
end

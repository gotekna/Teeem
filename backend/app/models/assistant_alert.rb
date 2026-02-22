# frozen_string_literal: true

# Proactive alerts from the AssistantMonitorJob
# Tracks urgent items that need user attention
#
class AssistantAlert < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :user
  belongs_to :source, polymorphic: true, optional: true
  belongs_to :assistant_action, optional: true

  ALERT_TYPES = %w[
    urgent_email overdue_task
    task_due_today schedule_delay
    unread_notifications
    follow_up_email stale_task
    unanswered_email pending_approval
    upcoming_deadline autopilot_suggestion
    daily_digest
  ].freeze

  PRIORITIES = %w[low medium high critical].freeze
  STATUSES = %w[pending seen actioned dismissed].freeze

  validates :alert_type, inclusion: { in: ALERT_TYPES }
  validates :priority, inclusion: { in: PRIORITIES }
  validates :status, inclusion: { in: STATUSES }
  validates :title, presence: true

  scope :active, -> { where(status: %w[pending seen]) }
  scope :pending, -> { where(status: "pending") }
  scope :for_user, ->(user) { where(user: user) }
  scope :high_priority, -> { where(priority: %w[high critical]) }

  def see!
    update!(status: "seen", seen_at: Time.current)
  end

  def action!
    update!(status: "actioned", actioned_at: Time.current)
  end

  def dismiss!
    update!(status: "dismissed")
  end
end

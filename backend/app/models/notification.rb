# frozen_string_literal: true

class Notification < ApplicationRecord
  belongs_to :user
  belongs_to :notifiable, polymorphic: true, optional: true

  # Allowed polymorphic types for notifiable (security: prevents arbitrary type injection)
  ALLOWED_NOTIFIABLE_TYPES = %w[SmTask EmailWarehouse EmailSnooze].freeze

  # Notification types
  TYPES = %w[
    task_assigned
    task_due_soon
    task_overdue
    task_completed
    task_started
    task_created_from_email
    task_email_reply
    mention
    email_reminder
    email_snooze_wakeup
    task_followed
    task_updated_followed
    task_comment_followed
  ].freeze

  validates :notification_type, presence: true, inclusion: { in: TYPES }
  validates :title, presence: true
  validates :notifiable_type, inclusion: { in: ALLOWED_NOTIFIABLE_TYPES }, allow_nil: true

  scope :unread, -> { where(read: false) }
  scope :read, -> { where(read: true) }
  scope :recent, -> { order(created_at: :desc).limit(50) }

  def mark_as_read!
    update!(read: true)
  end

  def self.mark_all_read_for_user!(user)
    where(user: user, read: false).update_all(read: true)
  end
end

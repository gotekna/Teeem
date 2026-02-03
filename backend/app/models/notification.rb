# frozen_string_literal: true

class Notification < ApplicationRecord
  belongs_to :user
  belongs_to :notifiable, polymorphic: true, optional: true

  # Allowed polymorphic types for notifiable (security: prevents arbitrary type injection)
  ALLOWED_NOTIFIABLE_TYPES = %w[SmTask SyncedEmail EmailSnooze].freeze

  # Auto-generate link based on notifiable type
  before_save :generate_link_from_notifiable

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
    question_delegated
    question_answered
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

  private

  # Generate the navigation link based on the notifiable object
  # This allows clicking on a notification to navigate directly to the relevant page
  def generate_link_from_notifiable
    return if link.present? # Don't overwrite if already set
    return if notifiable_type.blank? || notifiable_id.blank?

    self.link = case notifiable_type
                when "SmTask"
                  # Link to tasks page with task expanded
                  "/tasks?taskId=#{notifiable_id}"
                when "SyncedEmail"
                  # Link to email page with email selected
                  "/email?id=#{notifiable_id}"
                when "EmailSnooze"
                  # Link to email page - find the email ID from the snooze
                  snooze = EmailSnooze.find_by(id: notifiable_id)
                  snooze&.email_warehouse_id ? "/email?id=#{snooze.email_warehouse_id}" : nil
                end
  end
end

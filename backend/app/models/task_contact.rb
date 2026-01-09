# frozen_string_literal: true

# TaskContact - Links contacts and users to tasks
# Follows JobContact pattern for consistency
#
# Roles:
#   - sender: person who sent the email that created the task
#   - assigned: explicitly assigned to the task
#   - cc: CC'd on the source email
#   - participant: other email participants (to recipients)
#   - follower: manually added to follow the task
#
class TaskContact < ApplicationRecord
  belongs_to :sm_task
  belongs_to :contact, optional: true
  belongs_to :user, optional: true
  belongs_to :added_by, class_name: "User", optional: true

  ROLES = %w[sender assigned cc participant follower].freeze

  validates :role, presence: true, inclusion: { in: ROLES }
  validate :contact_or_user_present

  validates :contact_id, uniqueness: {
    scope: [:sm_task_id, :role],
    message: "is already associated with this task for this role"
  }, if: -> { contact_id.present? }

  validates :user_id, uniqueness: {
    scope: [:sm_task_id, :role],
    message: "is already associated with this task for this role"
  }, if: -> { user_id.present? }

  # Scopes
  scope :senders, -> { where(is_sender: true) }
  scope :internal, -> { where.not(user_id: nil) }
  scope :external, -> { where.not(contact_id: nil) }
  scope :by_role, ->(role) { where(role: role) }

  # Get display name regardless of contact or user
  def person_name
    if user.present?
      user.name || user.email
    elsif contact.present?
      contact.display_name || contact.email
    else
      "Unknown"
    end
  end

  def person_email
    user&.email || contact&.email
  end

  def internal?
    user_id.present?
  end

  def external?
    contact_id.present?
  end

  private

  def contact_or_user_present
    if contact_id.blank? && user_id.blank?
      errors.add(:base, "Either contact or user must be present")
    end
    if contact_id.present? && user_id.present?
      errors.add(:base, "Cannot have both contact and user")
    end
  end
end

# Task Activity Log - tracks changes to tasks for history/audit purposes
#
# Activity types:
#   - created: Task was created
#   - assignment_changed: Task assignee changed
#   - status_changed: Task status changed (started, completed, etc.)
#   - privacy_changed: Task privacy setting changed
#   - follower_added: Someone started following the task
#   - follower_removed: Someone stopped following the task
#   - cascade_completed: Task was completed as part of cascade completion
#
class TaskActivityLog < ApplicationRecord
  belongs_to :sm_task
  belongs_to :user, optional: true  # Who made the change (nil for system actions)

  validates :activity_type, presence: true

  # Activity type constants
  ACTIVITY_TYPES = %w[
    created
    assignment_changed
    status_changed
    privacy_changed
    follower_added
    follower_removed
    hold_changed
    confirm_changed
    dates_changed
    cascade_completed
  ].freeze

  validates :activity_type, inclusion: { in: ACTIVITY_TYPES }

  scope :recent, -> { order(created_at: :desc) }
  scope :for_task, ->(task_id) { where(sm_task_id: task_id) }

  # Create a log entry for task creation
  def self.log_created(task, user)
    create!(
      sm_task: task,
      user: user,
      activity_type: 'created',
      description: "Task created#{user ? " by #{user.name}" : ''}"
    )
  end

  # Create a log entry for assignment change
  def self.log_assignment_change(task, user, old_assignee, new_assignee)
    old_name = old_assignee&.name || 'Unassigned'
    new_name = new_assignee&.name || 'Unassigned'

    create!(
      sm_task: task,
      user: user,
      activity_type: 'assignment_changed',
      field_name: 'assigned_user_id',
      old_value: old_assignee&.id&.to_s,
      new_value: new_assignee&.id&.to_s,
      description: "#{user&.name || 'System'} reassigned from #{old_name} to #{new_name}"
    )
  end

  # Create a log entry for status change
  def self.log_status_change(task, user, old_status, new_status)
    create!(
      sm_task: task,
      user: user,
      activity_type: 'status_changed',
      field_name: 'status',
      old_value: old_status,
      new_value: new_status,
      description: "#{user&.name || 'System'} changed status from #{old_status} to #{new_status}"
    )
  end

  # Create a log entry for privacy change
  def self.log_privacy_change(task, user, was_private, is_private)
    privacy_text = is_private ? 'private' : 'public'
    create!(
      sm_task: task,
      user: user,
      activity_type: 'privacy_changed',
      field_name: 'is_private',
      old_value: was_private.to_s,
      new_value: is_private.to_s,
      description: "#{user&.name || 'System'} made task #{privacy_text}"
    )
  end

  # Create a log entry for follower added
  def self.log_follower_added(task, user, follower)
    create!(
      sm_task: task,
      user: user,
      activity_type: 'follower_added',
      new_value: follower.id.to_s,
      description: "#{user&.name || 'System'} added #{follower.name} as a follower"
    )
  end

  # Create a log entry for follower removed
  def self.log_follower_removed(task, user, follower)
    create!(
      sm_task: task,
      user: user,
      activity_type: 'follower_removed',
      old_value: follower.id.to_s,
      description: "#{user&.name || 'System'} removed #{follower.name} as a follower"
    )
  end

  # Create a log entry for hold change
  def self.log_hold_change(task, user, was_on_hold, is_on_hold)
    action = is_on_hold ? 'put task on hold' : 'took task off hold'
    create!(
      sm_task: task,
      user: user,
      activity_type: 'hold_changed',
      field_name: 'hold',
      old_value: was_on_hold.to_s,
      new_value: is_on_hold.to_s,
      description: "#{user&.name || 'System'} #{action}"
    )
  end

  # Create a log entry for confirm change
  def self.log_confirm_change(task, user, field_name, old_value, new_value)
    action = new_value ? 'confirmed' : 'unconfirmed'
    label = field_name == 'supplier_confirm' ? 'supplier' : ''
    create!(
      sm_task: task,
      user: user,
      activity_type: 'confirm_changed',
      field_name: field_name,
      old_value: old_value.to_s,
      new_value: new_value.to_s,
      description: "#{user&.name || 'System'} #{action} #{label}".strip
    )
  end

  # Create a log entry for cascade completion (task completed with another task)
  def self.log_cascade_completion(task:, triggered_by:, user:)
    create!(
      sm_task: task,
      user: user,
      activity_type: 'cascade_completed',
      field_name: 'status',
      old_value: task.status_was || 'not_started',
      new_value: 'completed',
      description: "Auto-completed with #{triggered_by.name} by #{user&.name || 'System'}"
    )
  end
end

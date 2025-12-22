# DEPRECATED: Part of the deprecated ScheduleTask system.
# This will be removed when ScheduleTask is removed.
class ScheduleTaskChecklistItem < ApplicationRecord
  include Deprecatable

  after_find { log_deprecation("ScheduleTaskChecklistItem is deprecated along with ScheduleTask.") }

  belongs_to :schedule_task

  validates :name, presence: true
  validates :sequence_order, presence: true

  scope :ordered, -> { order(:sequence_order) }
  scope :completed, -> { where(is_completed: true) }
  scope :incomplete, -> { where(is_completed: false) }
  scope :by_category, ->(category) { where(category: category) }

  # Mark item as completed
  def complete!(user_name = nil)
    update!(
      is_completed: true,
      completed_at: Time.current,
      completed_by: user_name
    )
  end

  # Mark item as incomplete
  def uncomplete!
    update!(
      is_completed: false,
      completed_at: nil,
      completed_by: nil
    )
  end

  # Check if all items for a task are completed
  def self.all_completed_for_task?(task_id)
    where(schedule_task_id: task_id).incomplete.none?
  end
end

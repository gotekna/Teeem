# frozen_string_literal: true

# SmDependency - Task dependencies stored in separate table (not JSONB)
#
# See Trinity Bible Rules 9.25 (SM Gantt - Dependencies in Separate Table)
# See GANTT_ARCHITECTURE_PLAN.md Section 2.2
#
class SmDependency < ApplicationRecord
  # Dependency type enum
  DEPENDENCY_TYPES = {
    'FS' => 'Finish-to-Start',
    'SS' => 'Start-to-Start',
    'FF' => 'Finish-to-Finish',
    'SF' => 'Start-to-Finish'
  }.freeze

  # Deleted reason enum
  DELETED_REASONS = %w[
    rollover
    user_manual
    cascade_conflict
    task_started
    task_completed
    hold_released
  ].freeze

  # Associations
  belongs_to :predecessor_task, class_name: 'SmTask'
  belongs_to :successor_task, class_name: 'SmTask'
  belongs_to :created_by, class_name: 'User', optional: true
  belongs_to :deleted_by, class_name: 'User', optional: true

  # Validations
  validates :dependency_type, presence: true, inclusion: { in: DEPENDENCY_TYPES.keys }
  validates :lag_days, presence: true, numericality: { only_integer: true }
  validates :predecessor_task_id, uniqueness: { scope: :successor_task_id, conditions: -> { where(active: true) } }
  validates :deleted_reason, inclusion: { in: DELETED_REASONS }, allow_nil: true
  validate :no_self_dependency
  validate :no_circular_dependency, on: :create

  # Scopes
  scope :active, -> { where(active: true) }
  scope :inactive, -> { where(active: false) }
  scope :for_task, ->(task_id) { where('predecessor_task_id = ? OR successor_task_id = ?', task_id, task_id) }
  scope :deleted_by_rollover, -> { inactive.where(deleted_by_rollover: true) }

  # Display helper for dependency type
  def type_display
    "#{predecessor_task.task_number}#{dependency_type}#{lag_display}"
  end

  def lag_display
    return '' if lag_days.zero?
    lag_days.positive? ? "+#{lag_days}" : lag_days.to_s
  end

  def type_name
    DEPENDENCY_TYPES[dependency_type]
  end

  # Soft delete
  def soft_delete!(reason:, user: nil)
    update!(
      active: false,
      deleted_at: Time.current,
      deleted_reason: reason,
      deleted_by: user,
      deleted_by_rollover: reason == 'rollover'
    )
  end

  # Restore soft-deleted dependency
  def restore!
    update!(
      active: true,
      deleted_at: nil,
      deleted_reason: nil,
      deleted_by: nil,
      deleted_by_rollover: false
    )
  end

  private

  def no_self_dependency
    if predecessor_task_id == successor_task_id
      errors.add(:base, 'Task cannot depend on itself')
    end
  end

  def no_circular_dependency
    return unless predecessor_task_id.present? && successor_task_id.present?

    # Check if adding this dependency would create a cycle
    if would_create_cycle?
      errors.add(:base, 'This dependency would create a circular reference')
    end
  end

  def would_create_cycle?
    # BFS to check if successor_task can reach predecessor_task through existing dependencies
    visited = Set.new
    queue = [successor_task_id]

    while queue.any?
      current_id = queue.shift
      next if visited.include?(current_id)
      visited.add(current_id)

      # If we reach the predecessor, it's a cycle
      return true if current_id == predecessor_task_id

      # Get all successors of current task
      SmDependency.active.where(predecessor_task_id: current_id).pluck(:successor_task_id).each do |next_id|
        queue << next_id unless visited.include?(next_id)
      end
    end

    false
  end
end

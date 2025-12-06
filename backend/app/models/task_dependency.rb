class TaskDependency < ApplicationRecord
  belongs_to :successor_task, class_name: "ProjectTask"
  belongs_to :predecessor_task, class_name: "ProjectTask"

  validates :dependency_type, inclusion: {
    in: %w[finish_to_start start_to_start finish_to_finish start_to_finish]
  }
  validates :successor_task_id, uniqueness: { scope: :predecessor_task_id,
    message: "already has this dependency" }

  validate :no_circular_dependencies
  validate :same_project_tasks
  validate :no_self_dependency

  # Convenience aliases
  DEPENDENCY_TYPES = {
    fs: "finish_to_start",
    ss: "start_to_start",
    ff: "finish_to_finish",
    sf: "start_to_finish"
  }.freeze

  private

  def no_circular_dependencies
    return unless successor_task && predecessor_task
    return if successor_task.id == predecessor_task.id # Caught by no_self_dependency

    if creates_circular_dependency?
      errors.add(:base, "Cannot create circular dependency")
    end
  end

  def same_project_tasks
    return unless successor_task && predecessor_task

    if successor_task.project_id != predecessor_task.project_id
      errors.add(:base, "Tasks must be in the same project")
    end
  end

  def no_self_dependency
    return unless successor_task_id && predecessor_task_id

    if successor_task_id == predecessor_task_id
      errors.add(:base, "Task cannot depend on itself")
    end
  end

  def creates_circular_dependency?
    # Check if adding this dependency would create a cycle
    # This is a simplified check - full implementation would need graph traversal
    visited = Set.new
    to_visit = [ predecessor_task_id ]

    while to_visit.any?
      current_id = to_visit.pop
      next if visited.include?(current_id)

      visited.add(current_id)

      # If we reached the successor, we have a cycle
      return true if current_id == successor_task_id

      # Add all predecessors of this task to the visit queue
      TaskDependency.where(successor_task_id: current_id).pluck(:predecessor_task_id).each do |pred_id|
        to_visit << pred_id unless visited.include?(pred_id)
      end
    end

    false
  end
end

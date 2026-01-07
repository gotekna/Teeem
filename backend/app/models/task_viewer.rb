class TaskViewer < ApplicationRecord
  # Associations
  belongs_to :user
  belongs_to :sm_task

  # Validations
  validates :user_id, uniqueness: { scope: :sm_task_id, message: "already has access to this task" }
end

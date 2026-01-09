class TaskFollower < ApplicationRecord
  # Associations
  belongs_to :user
  belongs_to :sm_task

  # Validations
  validates :user_id, uniqueness: { scope: :sm_task_id, message: "is already following this task" }

  # Scopes
  scope :recent, -> { order(followed_at: :desc) }
end

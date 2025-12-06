class GrokPlan < ApplicationRecord
  belongs_to :user

  # Statuses: planning, in_progress, completed, archived
  validates :title, presence: true
  validates :status, inclusion: { in: %w[planning in_progress completed archived] }

  # Scopes for easy querying
  scope :active, -> { where(status: [ "planning", "in_progress" ]) }
  scope :recent, -> { order(updated_at: :desc).limit(10) }
end

class GrokPlan < ApplicationRecord
  belongs_to :user, optional: true

  # Constants
  # Statuses: planning, in_progress, completed, archived
  STATUSES = %w[planning in_progress completed archived].freeze

  validates :title, presence: true
  validates :status, inclusion: { in: STATUSES }

  # Scopes for easy querying
  scope :active, -> { where(status: [ "planning", "in_progress" ]) }
  scope :recent, -> { order(updated_at: :desc).limit(10) }
end

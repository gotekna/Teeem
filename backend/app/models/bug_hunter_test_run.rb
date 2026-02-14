class BugHunterTestRun < ApplicationRecord
  # Constants
  STATUSES = %w[pass fail error].freeze

  # Validations
  validates :test_id, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  # Scopes
  scope :recent, -> { order(created_at: :desc).limit(100) }
  scope :old, ->(before_date) { where("created_at < ?", before_date) }
  scope :by_test, ->(test_id) { where(test_id: test_id) }
  scope :passed, -> { where(status: "pass") }
  scope :failed, -> { where(status: "fail") }
  scope :errors, -> { where(status: "error") }
end

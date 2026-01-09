class EstimateReview < ApplicationRecord
  # Associations
  belongs_to :estimate

  # Enums
  enum :status, {
    pending: "pending",
    processing: "processing",
    completed: "completed",
    failed: "failed"
  }, prefix: true, default: :pending

  # Serializations
  serialize :ai_findings, coder: JSON
  serialize :discrepancies, coder: JSON

  # Validations
  validates :status, presence: true
  validates :confidence_score, numericality: {
    greater_than_or_equal_to: 0,
    less_than_or_equal_to: 100
  }, allow_nil: true

  # Scopes
  scope :completed, -> { where(status: "completed") }
  scope :recent, -> { order(created_at: :desc) }
  scope :failed, -> { where(status: "failed") }

  # Methods
  def completed?
    status == "completed"
  end

  def processing?
    status == "processing"
  end

  def failed?
    status == "failed"
  end

  def total_discrepancies
    items_mismatched + items_missing + items_extra
  end

  def has_discrepancies?
    total_discrepancies > 0
  end
end

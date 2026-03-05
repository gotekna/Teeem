class PropertyInspection < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :tenancy, optional: true
  belongs_to :inspector_contact, class_name: "Contact", optional: true

  # Types and statuses
  INSPECTION_TYPES = %w[entry routine exit maintenance sda_compliance].freeze
  STATUSES = %w[scheduled in_progress completed overdue].freeze
  CONDITIONS = %w[excellent good fair poor].freeze

  validates :inspection_type, presence: true, inclusion: { in: INSPECTION_TYPES }
  validates :scheduled_date, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :overall_condition, inclusion: { in: CONDITIONS, allow_nil: true }

  # Scopes
  scope :upcoming, -> { where(status: "scheduled").where("scheduled_date >= ?", Date.current).order(scheduled_date: :asc) }
  scope :overdue, -> { where(status: %w[scheduled in_progress]).where("scheduled_date < ?", Date.current) }
  scope :completed, -> { where(status: "completed") }
  scope :by_type, ->(type) { where(inspection_type: type) }

  def overdue?
    %w[scheduled in_progress].include?(status) && scheduled_date < Date.current
  end

  def completed?
    status == "completed"
  end
end

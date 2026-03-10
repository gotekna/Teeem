# frozen_string_literal: true

class SdaConflictOfInterest < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :declarant_user, class_name: "User", optional: true
  belongs_to :declarant_contact, class_name: "Contact", optional: true
  belongs_to :related_property, class_name: "Property", optional: true
  belongs_to :related_contact, class_name: "Contact", optional: true
  belongs_to :reviewed_by_user, class_name: "User", optional: true

  DECLARANT_TYPES = %w[staff sil_provider contractor board_member].freeze
  CONFLICT_TYPES = %w[financial personal professional familial other].freeze
  STATUSES = %w[declared under_review managed resolved dismissed].freeze
  SEVERITIES = %w[low medium high critical].freeze

  validates :declarant_type, presence: true, inclusion: { in: DECLARANT_TYPES }
  validates :conflict_type, presence: true, inclusion: { in: CONFLICT_TYPES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :severity, presence: true, inclusion: { in: SEVERITIES }
  validates :description, presence: true
  validates :declaration_date, presence: true

  scope :active, -> { where(status: %w[declared under_review managed]) }
  scope :needs_review, -> { where("review_date <= ?", Date.current).where.not(status: %w[resolved dismissed]) }
  scope :high_severity, -> { where(severity: %w[high critical]) }

  def resolved?
    status == "resolved"
  end

  def review_overdue?
    return false unless review_date
    return false if status.in?(%w[resolved dismissed])

    review_date < Date.current
  end
end

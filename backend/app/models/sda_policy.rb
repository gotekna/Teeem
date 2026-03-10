# frozen_string_literal: true

class SdaPolicy < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :owner_user, class_name: "User", optional: true
  belongs_to :approved_by_user, class_name: "User", optional: true
  belongs_to :document_blob, class_name: "StorageBlob", optional: true

  POLICY_TYPES = %w[policy procedure guideline form template].freeze
  CATEGORIES = %w[
    governance safety complaints incidents restrictive_practices
    conflict_of_interest maintenance tenancy privacy rights
    emergency medication infection_control sda_specific
  ].freeze
  STATUSES = %w[draft active under_review archived superseded].freeze

  validates :policy_type, presence: true, inclusion: { in: POLICY_TYPES }
  validates :category, presence: true, inclusion: { in: CATEGORIES }
  validates :title, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  scope :active, -> { where(status: "active") }
  scope :due_for_review, -> { where("review_date <= ?", Date.current).where(status: "active") }
  scope :ndis_required, -> { where(ndis_required: true) }
  scope :by_category, ->(cat) { where(category: cat) }

  def review_overdue?
    return false unless review_date
    return false unless status == "active"

    review_date < Date.current
  end

  def days_until_review
    return nil unless review_date

    (review_date - Date.current).to_i
  end

  def current_version?
    status == "active" && !review_overdue?
  end
end

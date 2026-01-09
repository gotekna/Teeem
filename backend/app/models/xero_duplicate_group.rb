# frozen_string_literal: true

# XeroDuplicateGroup represents a group of duplicate contacts detected in Xero
# Each group contains multiple contacts that are likely duplicates based on
# ABN, display name, or ATO/ASIC references
class XeroDuplicateGroup < ApplicationRecord
  # Associations
  has_many :xero_duplicate_items, foreign_key: :duplicate_group_id, dependent: :destroy
  has_many :contacts, through: :xero_duplicate_items
  belongs_to :merge_target, class_name: "Contact", optional: true

  # Validations
  validates :group_key, presence: true, uniqueness: true
  validates :match_type, presence: true, inclusion: { in: %w[abn display_name ato_asic] }
  validates :confidence_score, presence: true, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
  validates :status, presence: true, inclusion: { in: %w[pending approved rejected merged] }

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :approved, -> { where(status: "approved") }
  scope :rejected, -> { where(status: "rejected") }
  scope :merged, -> { where(status: "merged") }
  scope :high_confidence, -> { where("confidence_score >= ?", 90) }
  scope :medium_confidence, -> { where("confidence_score >= ? AND confidence_score < ?", 70, 90) }
  scope :low_confidence, -> { where("confidence_score < ?", 70) }
  scope :by_match_type, ->(type) { where(match_type: type) }

  # Order by confidence (highest first), then created_at (oldest first)
  scope :prioritized, -> { order(confidence_score: :desc, created_at: :asc) }

  # Instance methods
  def pending?
    status == "pending"
  end

  def approved?
    status == "approved"
  end

  def rejected?
    status == "rejected"
  end

  def merged?
    status == "merged"
  end

  def mark_approved!(reviewer_email = nil)
    update!(
      status: "approved",
      reviewed_at: Time.current,
      reviewed_by: reviewer_email
    )
  end

  def mark_rejected!(reviewer_email = nil)
    update!(
      status: "rejected",
      reviewed_at: Time.current,
      reviewed_by: reviewer_email
    )
  end

  def mark_merged!(target_contact_id, reviewer_email = nil)
    update!(
      status: "merged",
      merge_target_id: target_contact_id,
      reviewed_at: Time.current,
      reviewed_by: reviewer_email
    )
  end

  def contact_ids
    xero_duplicate_items.pluck(:contact_id)
  end

  def contact_count
    xero_duplicate_items.count
  end

  def abn_match?
    match_type == "abn"
  end

  def name_match?
    match_type == "display_name"
  end

  def ato_asic_match?
    match_type == "ato_asic"
  end
end

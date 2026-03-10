class SdaParticipantMatch < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :sda_vacancy
  belongs_to :contact
  belongs_to :matched_by_user, class_name: "User", optional: true

  STATUSES = %w[suggested contacted interested applied approved rejected withdrawn].freeze
  MATCH_REASONS = %w[category_match location_match manual].freeze

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :match_reason, inclusion: { in: MATCH_REASONS }, allow_nil: true

  scope :active, -> { where.not(status: %w[rejected withdrawn]) }
  scope :approved, -> { where(status: "approved") }

  def compatible?
    return false unless contact && sda_vacancy&.property

    property = sda_vacancy.property
    return false unless property.sda_category.present?
    return false unless contact.sda_approved_category.present?

    contact.sda_approved_category == property.sda_category
  end
end

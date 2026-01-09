class ContactPhone < ApplicationRecord
  belongs_to :contact

  PHONE_TYPES = %w[mobile office fax home].freeze

  # Explicit presence validation (also enforced by belongs_to in Rails 5+)
  validates :contact_id, presence: true
  validates :phone_number, presence: true
  validates :phone_type, presence: true, inclusion: { in: PHONE_TYPES }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Ensure only one primary phone per contact
  validate :only_one_primary_per_contact

  scope :ordered, -> { order(:position) }
  scope :primary, -> { where(is_primary: true) }
  scope :mobile, -> { where(phone_type: "mobile") }
  scope :office, -> { where(phone_type: "office") }

  # Auto-set position if not provided
  before_validation :set_position, on: :create

  # If this is set as primary, unset all other primary phones for this contact
  # CRITICAL: Must run before_validation (not before_save) so that the
  # only_one_primary_per_contact validation doesn't fail before we clear conflicts
  before_validation :ensure_single_primary

  def display_type
    phone_type.titleize
  end

  private

  def only_one_primary_per_contact
    # Only validate if is_primary is being set to true (new record or changed)
    return unless is_primary
    return unless new_record? || is_primary_changed?

    # Check if another phone is already primary
    if ContactPhone.where(contact_id: contact_id, is_primary: true).where.not(id: id).exists?
      errors.add(:is_primary, "contact already has a primary phone")
    end
  end

  def set_position
    return if position.present?
    max_position = contact.contact_phones.maximum(:position) || -1
    self.position = max_position + 1
  end

  def ensure_single_primary
    if is_primary_changed? && is_primary?
      ContactPhone.where(contact_id: contact_id).where.not(id: id).update_all(is_primary: false)
    end
  end
end

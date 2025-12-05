class ContactEmail < ApplicationRecord
  belongs_to :contact

  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Ensure only one primary email per contact
  validate :only_one_primary_per_contact

  scope :ordered, -> { order(:position) }
  scope :primary, -> { where(is_primary: true) }

  # Auto-set position if not provided
  before_validation :set_position, on: :create

  # If this is set as primary, unset all other primary emails for this contact
  before_save :ensure_single_primary

  private

  def only_one_primary_per_contact
    if is_primary && ContactEmail.where(contact_id: contact_id, is_primary: true).where.not(id: id).exists?
      errors.add(:is_primary, "contact already has a primary email")
    end
  end

  def set_position
    return if position.present?
    max_position = contact.contact_emails.maximum(:position) || -1
    self.position = max_position + 1
  end

  def ensure_single_primary
    if is_primary_changed? && is_primary?
      ContactEmail.where(contact_id: contact_id).where.not(id: id).update_all(is_primary: false)
    end
  end
end

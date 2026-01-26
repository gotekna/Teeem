class ContactEmail < ApplicationRecord
  belongs_to :contact

  # SSoT: Allowed email labels for Contact Consolidation (Phase 4)
  # - work: Business/work email (default for existing emails)
  # - personal: Personal email address
  # - login: User login email (synced from User.email)
  # - other: Any other email type
  ALLOWED_LABELS = %w[work personal login other].freeze

  # NOTE: contact_id presence validation removed - belongs_to validates automatically
  # and handles nested attributes correctly (doesn't validate until parent is saved)
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :label, inclusion: { in: ALLOWED_LABELS, message: "%{value} is not a valid label" }, allow_blank: true

  scope :ordered, -> { order(:position) }
  scope :primary, -> { where(is_primary: true) }
  scope :by_label, ->(label) { where(label: label) }
  scope :login_emails, -> { by_label('login') }
  scope :work_emails, -> { by_label('work') }
  scope :personal_emails, -> { by_label('personal') }

  # Auto-set position if not provided
  before_validation :set_position, on: :create

  # If this is set as primary, unset all other primary emails for this contact
  # This runs BEFORE validation to ensure single primary is enforced correctly
  before_validation :ensure_single_primary

  private

  def set_position
    return if position.present?
    max_position = contact.contact_emails.maximum(:position) || -1
    self.position = max_position + 1
  end

  def ensure_single_primary
    return unless is_primary? && (new_record? || is_primary_changed?)
    return unless contact_id.present?

    # For new records, unset all existing primaries
    # For existing records, exclude self from the update
    if new_record?
      ContactEmail.where(contact_id: contact_id, is_primary: true).update_all(is_primary: false)
    else
      ContactEmail.where(contact_id: contact_id, is_primary: true).where.not(id: id).update_all(is_primary: false)
    end
  end
end

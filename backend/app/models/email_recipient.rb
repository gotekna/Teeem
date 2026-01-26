# Links email_warehouse records to users/contacts as from/to/cc/bcc recipients
# Part of SSoT architecture - enables querying "all emails involving this contact"
class EmailRecipient < ApplicationRecord
  # SSoT: Legacy column is email_warehouse_id, but actual model is SyncedEmail
  belongs_to :email_warehouse, class_name: "SyncedEmail"
  belongs_to :user, optional: true  # Internal user (nullable)
  belongs_to :contact, optional: true  # External contact (nullable)

  # Recipient types
  TYPES = %w[from to cc bcc].freeze

  validates :email_address, presence: true
  validates :recipient_type, presence: true, inclusion: { in: TYPES }
  validates :email_address, uniqueness: { scope: :email_warehouse_id }

  # Scopes
  # Note: 'from' conflicts with ActiveRecord's .from() method, so using 'senders'
  scope :senders, -> { where(recipient_type: "from") }
  scope :recipients_to, -> { where(recipient_type: "to") }
  scope :recipients_cc, -> { where(recipient_type: "cc") }
  scope :recipients_bcc, -> { where(recipient_type: "bcc") }
  scope :internal, -> { where(is_internal: true) }
  scope :external, -> { where(is_internal: false) }

  # Find or create a recipient, auto-matching to user/contact
  def self.find_or_create_for_email(email_warehouse, email_address, type)
    recipient = find_or_initialize_by(
      email_warehouse: email_warehouse,
      email_address: email_address.to_s.downcase.strip
    )

    recipient.recipient_type = type
    recipient.match_to_user_or_contact! if recipient.new_record?
    recipient.save!
    recipient
  end

  # Try to match this email address to an existing user or contact
  def match_to_user_or_contact!
    normalized_email = email_address.to_s.downcase.strip
    return if normalized_email.blank?

    # Try to match to internal user first
    matched_user = User.find_by("LOWER(email) = ?", normalized_email)
    if matched_user
      self.user = matched_user
      self.is_internal = true
      return
    end

    # Try to match to external contact (SSoT: find_by_email uses contact_emails table)
    matched_contact = Contact.find_by_email(normalized_email)
    if matched_contact
      self.contact = matched_contact
      self.is_internal = false
    end
  end
end

class ContactPerson < ApplicationRecord
  self.table_name = "contact_persons"

  belongs_to :contact

  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP, allow_blank: true }

  before_save :ensure_single_primary_per_contact

  scope :primary, -> { where(is_primary: true) }
  scope :secondary, -> { where(is_primary: false) }

  def display_name
    [ first_name, last_name ].compact.join(" ").presence || email || "Contact Person ##{id}"
  end

  private

  # Automatically set other contact persons to non-primary when this one becomes primary
  def ensure_single_primary_per_contact
    if is_primary? && is_primary_changed? && contact
      # Set all other contact persons to non-primary
      contact.contact_persons.where.not(id: id).update_all(is_primary: false)
    end
  end
end

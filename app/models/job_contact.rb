class JobContact < ApplicationRecord
  belongs_to :job
  belongs_to :contact, optional: true
  belongs_to :user, optional: true

  validates :job_id, presence: true
  # Either contact_id or user_id must be present
  validate :contact_or_user_present
  validates :contact_id, uniqueness: { scope: [ :job_id, :role ], message: "is already associated with this job for this role" }, if: -> { contact_id.present? }
  validates :user_id, uniqueness: { scope: [ :job_id, :role ], message: "is already associated with this job for this role" }, if: -> { user_id.present? }

  # Ensure only one primary contact per job
  validates :primary, uniqueness: { scope: :job_id, message: "contact already exists for this job" }, if: :primary?

  # Scope for primary contact
  scope :primary, -> { where(primary: true) }

  # Internal team roles use users, external roles use contacts
  INTERNAL_ROLES = %w[supervisor site_coordinator estimator internal_sales coordinator].freeze

  def internal_team?
    INTERNAL_ROLES.include?(role)
  end

  # Get the person name regardless of contact or user
  def person_name
    if user.present?
      user.name || user.email
    elsif contact.present?
      contact.full_name || contact.company_name
    else
      "Unknown"
    end
  end

  private

  def contact_or_user_present
    if contact_id.blank? && user_id.blank?
      errors.add(:base, "Either contact or user must be present")
    end
  end
end

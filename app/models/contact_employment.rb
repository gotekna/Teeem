class ContactEmployment < ApplicationRecord
  # Associations
  belongs_to :employee, class_name: 'Contact'
  belongs_to :employer, class_name: 'Contact'

  # Validations
  validates :employee_id, presence: true
  validates :employer_id, presence: true
  validates :employee_id, uniqueness: { scope: :employer_id, message: "already has an employment record with this employer" }

  # Validate that employee is a person and employer is a company/trust
  validate :employee_must_be_person
  validate :employer_must_be_company

  # Callbacks - track changes to key fields
  before_save :track_email_changes
  before_save :track_phone_changes
  before_save :track_role_changes

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :inactive, -> { where(is_active: false) }
  scope :primary, -> { where(is_primary: true) }

  private

  def track_email_changes
    if work_email_changed? && !new_record?
      self.previous_work_email = work_email_was
      self.email_changed_at = Time.current
    end
  end

  def track_phone_changes
    if work_phone_changed? && !new_record?
      self.previous_work_phone = work_phone_was
      self.phone_changed_at = Time.current
    end
  end

  def track_role_changes
    if role_changed? && !new_record?
      self.previous_role = role_was
      self.role_changed_at = Time.current
    end
  end

  def employee_must_be_person
    return unless employee

    unless employee.entity_type == 'person'
      errors.add(:employee, "must be a person contact (not #{employee.entity_type})")
    end
  end

  def employer_must_be_company
    return unless employer

    unless %w[company trust sole_trader].include?(employer.entity_type)
      errors.add(:employer, "must be a company, trust, or sole trader contact (not #{employer.entity_type})")
    end
  end
end

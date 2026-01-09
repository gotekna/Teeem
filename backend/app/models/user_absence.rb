class UserAbsence < ApplicationRecord
  # Associations
  belongs_to :user
  belongs_to :approved_by, class_name: 'User', optional: true

  # Validations
  validates :start_date, presence: true
  validates :end_date, presence: true
  validates :absence_type, inclusion: { in: %w[leave sick holiday training other] }
  validate :end_date_after_start_date
  validate :no_overlapping_absences

  # Scopes
  scope :approved, -> { where(approved: true) }
  scope :pending, -> { where(approved: false) }
  scope :active, -> { where('end_date >= ?', Date.current) }
  scope :for_date, ->(date) { where('start_date <= ? AND end_date >= ?', date, date) }
  scope :for_date_range, ->(start_date, end_date) {
    where('start_date <= ? AND end_date >= ?', end_date, start_date)
  }

  # Constants
  ABSENCE_TYPES = {
    'leave' => 'Annual Leave',
    'sick' => 'Sick Leave',
    'holiday' => 'Public Holiday',
    'training' => 'Training',
    'other' => 'Other'
  }.freeze

  # Instance methods
  def approve!(approver)
    update!(
      approved: true,
      approved_by: approver,
      approved_at: Time.current
    )
  end

  def reject!
    destroy
  end

  def duration_days
    (end_date - start_date).to_i + 1
  end

  def absence_type_label
    ABSENCE_TYPES[absence_type] || absence_type&.titleize
  end

  def covers_date?(date)
    date >= start_date && date <= end_date
  end

  # Class methods
  def self.user_absent_on?(user_id, date)
    approved.where(user_id: user_id).for_date(date).exists?
  end

  def self.users_absent_on(date)
    approved.for_date(date).includes(:user).map(&:user)
  end

  private

  def end_date_after_start_date
    return unless start_date.present? && end_date.present?

    if end_date < start_date
      errors.add(:end_date, 'must be on or after start date')
    end
  end

  def no_overlapping_absences
    return unless user_id.present? && start_date.present? && end_date.present?

    overlapping = UserAbsence.where(user_id: user_id)
                             .where.not(id: id)
                             .where('start_date <= ? AND end_date >= ?', end_date, start_date)

    if overlapping.exists?
      errors.add(:base, 'overlaps with an existing absence record')
    end
  end
end

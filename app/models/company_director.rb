class CompanyDirector < ApplicationRecord
  # Associations
  belongs_to :company
  belongs_to :contact

  # Validations
  validates :position, inclusion: { in: %w[director secretary director_secretary chairman] }, allow_blank: true
  validates :contact_id, uniqueness: { scope: :company_id, conditions: -> { where(is_current: true) },
                                       message: "is already a current director/officer of this company" }
  validate :resignation_date_after_appointment

  # Scopes
  scope :current, -> { where(is_current: true) }
  scope :historical, -> { where(is_current: false) }
  scope :directors, -> { where(position: ['director', 'director_secretary', 'chairman']) }
  scope :secretaries, -> { where(position: ['secretary', 'director_secretary']) }

  # Callbacks
  before_save :update_current_status
  after_create :create_appointment_activity
  after_update :create_resignation_activity, if: :saved_change_to_resignation_date?

  # Instance methods
  def active_duration
    start_date = appointment_date || created_at.to_date
    end_date = resignation_date || Date.today
    (end_date - start_date).to_i
  end

  def formatted_position
    position.to_s.titleize.gsub('_', ' / ')
  end

  private

  def update_current_status
    if resignation_date.present? && resignation_date <= Date.today
      self.is_current = false
    end
  end

  def resignation_date_after_appointment
    return unless appointment_date.present? && resignation_date.present?
    if resignation_date < appointment_date
      errors.add(:resignation_date, "cannot be before appointment date")
    end
  end

  def create_appointment_activity
    company.company_activities.create!(
      activity_type: 'director_appointed',
      description: "#{contact.display_name} was appointed as #{formatted_position}",
      metadata: { contact_id: contact.id, position: position, appointment_date: appointment_date },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  end

  def create_resignation_activity
    company.company_activities.create!(
      activity_type: 'director_resigned',
      description: "#{contact.display_name} resigned as #{formatted_position}",
      metadata: { contact_id: contact.id, position: position, resignation_date: resignation_date },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  end
end

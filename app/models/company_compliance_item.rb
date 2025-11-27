class CompanyComplianceItem < ApplicationRecord
  # Associations
  belongs_to :company

  # Validations
  validates :title, presence: true
  validates :due_date, presence: true
  validates :status, inclusion: { in: %w[pending completed overdue cancelled] }
  validates :compliance_type, inclusion: {
    in: %w[asic_review tax_return agm insurance_renewal license_renewal registration other]
  }, allow_blank: true

  # Scopes
  scope :pending, -> { where(status: 'pending') }
  scope :completed, -> { where(status: 'completed') }
  scope :overdue, -> { where('due_date < ? AND status = ?', Date.today, 'pending') }
  scope :due_soon, ->(days = 30) {
    where('due_date BETWEEN ? AND ? AND status = ?', Date.today, days.days.from_now, 'pending')
  }
  scope :by_type, ->(type) { where(compliance_type: type) }
  scope :recurring, -> { where(is_recurring: true) }

  # Callbacks
  before_save :update_status_based_on_due_date
  after_create :create_activity
  after_update :create_update_activity, if: :saved_change_to_status?

  # Instance methods
  def days_until_due
    return nil unless due_date.present?
    (due_date - Date.today).to_i
  end

  def overdue?
    due_date.present? && due_date < Date.today && status == 'pending'
  end

  def due_soon?(days = 30)
    return false if overdue? || completed?
    due_date.present? && days_until_due <= days && days_until_due >= 0
  end

  def completed?
    status == 'completed'
  end

  def mark_completed!
    update!(
      status: 'completed',
      completed_date: Date.today
    )

    # If recurring, create next occurrence
    create_next_occurrence if is_recurring?
  end

  def formatted_compliance_type
    compliance_type.to_s.titleize.gsub('_', ' ')
  end

  def reminder_days
    days = []
    days << 90 if reminder_90_days
    days << 60 if reminder_60_days
    days << 30 if reminder_30_days
    days << 7 if reminder_7_days
    days
  end

  def needs_reminder?(days_before)
    return false if completed? || overdue?
    days_until_due == days_before && reminder_days.include?(days_before)
  end

  private

  def update_status_based_on_due_date
    if due_date.present? && due_date < Date.today && status == 'pending'
      self.status = 'overdue'
    end
  end

  def create_activity
    company.company_activities.create!(
      activity_type: 'compliance_item_created',
      description: "Compliance item created: #{title}",
      metadata: {
        compliance_type: compliance_type,
        due_date: due_date
      },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  end

  def create_update_activity
    if status == 'completed'
      company.company_activities.create!(
        activity_type: 'compliance_item_completed',
        description: "Compliance item completed: #{title}",
        metadata: {
          completed_date: completed_date
        },
        performed_by: Current.user || User.first,
        occurred_at: Time.current
      )
    end
  end

  def create_next_occurrence
    return unless recurrence_frequency.present?

    next_due_date = case recurrence_frequency
                    when 'annual'
                      due_date + 1.year
                    when 'quarterly'
                      due_date + 3.months
                    when 'monthly'
                      due_date + 1.month
                    else
                      nil
                    end

    return unless next_due_date.present?

    company.company_compliance_items.create!(
      compliance_type: compliance_type,
      title: title,
      description: description,
      due_date: next_due_date,
      status: 'pending',
      reminder_90_days: reminder_90_days,
      reminder_60_days: reminder_60_days,
      reminder_30_days: reminder_30_days,
      reminder_7_days: reminder_7_days,
      notification_recipients: notification_recipients,
      is_recurring: is_recurring,
      recurrence_frequency: recurrence_frequency
    )
  end
end

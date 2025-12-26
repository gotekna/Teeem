class SmRecurringTaskDefinition < ApplicationRecord
  # Associations
  belongs_to :assigned_user, class_name: 'User', optional: true
  belongs_to :job, optional: true
  belongs_to :checklist, optional: true
  belongs_to :created_by, class_name: 'User', optional: true
  belongs_to :updated_by, class_name: 'User', optional: true
  has_many :generated_tasks, class_name: 'SmTask', foreign_key: :recurring_task_definition_id

  # Validations
  validates :name, presence: true
  validates :frequency, presence: true, inclusion: { in: %w[daily weekly fortnightly monthly quarterly annually] }
  validates :frequency_interval, numericality: { greater_than: 0 }
  validates :start_date, presence: true
  validates :assignment_type, inclusion: { in: %w[user role] }
  validates :day_of_month, numericality: { greater_than_or_equal_to: -1, less_than_or_equal_to: 28 }, allow_nil: true
  validates :day_of_week, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 6 }, allow_nil: true
  validates :assigned_role, inclusion: { in: User::ASSIGNABLE_ROLES }, allow_blank: true
  validate :end_date_after_start_date, if: -> { end_date.present? }
  validate :assignment_present

  # Scopes
  scope :active, -> { where(is_active: true, status: 'active') }
  scope :paused, -> { where(status: 'paused') }
  scope :due_for_generation, -> { active.where('next_generation_date <= ?', Date.current) }
  scope :assigned_to_user, ->(user) { where(assignment_type: 'user', assigned_user_id: user.id) }
  scope :assigned_to_role, ->(role) { where(assignment_type: 'role', assigned_role: role) }

  # Callbacks
  before_create :set_next_generation_date
  before_save :clear_opposite_assignment

  # Constants
  FREQUENCIES = {
    'daily' => 1.day,
    'weekly' => 1.week,
    'fortnightly' => 2.weeks,
    'monthly' => 1.month,
    'quarterly' => 3.months,
    'annually' => 1.year
  }.freeze

  STATUSES = %w[active paused completed cancelled].freeze

  # Instance methods
  def generate_tasks_for_period!(target_date = nil)
    target_date ||= Date.current + (advance_days || 7).days
    generated = []

    return generated unless can_generate?

    # Generate tasks up to target_date
    while next_generation_date && next_generation_date <= target_date && can_generate?
      task = generate_single_task!
      generated << task if task
    end

    generated
  end

  def generate_single_task!
    return nil unless can_generate?

    task = nil
    transaction do
      # Find effective assignee (handles skip_user_leave)
      effective_date = next_generation_date
      effective_date = skip_to_valid_date(effective_date) if should_skip?(effective_date)

      # Skip if no valid date found
      if effective_date.nil?
        advance_to_next_date!
        return nil
      end

      task = build_task_for_date(effective_date)
      task.save!

      # Update tracking
      self.occurrences_count += 1
      self.last_generated_for_date = next_generation_date
      self.next_generation_date = calculate_next_date

      # Check if completed
      if reached_limit? || past_end_date?
        self.status = 'completed'
        self.is_active = false
      end

      save!

      # Send notification if configured
      if notify_on_create
        notify_assignee(task)
      end
    end

    task
  end

  def can_generate?
    return false unless is_active && status == 'active'
    return false if next_generation_date.nil?
    return false if reached_limit?
    return false if past_end_date?
    true
  end

  def reached_limit?
    occurrences_limit.present? && occurrences_count >= occurrences_limit
  end

  def past_end_date?
    end_date.present? && next_generation_date && next_generation_date > end_date
  end

  def pause!
    update!(status: 'paused', is_active: false)
  end

  def resume!
    # Recalculate next date if it's in the past
    new_next_date = next_generation_date
    while new_next_date && new_next_date < Date.current
      new_next_date = calculate_next_date(from_date: new_next_date)
    end
    update!(status: 'active', is_active: true, next_generation_date: new_next_date)
  end

  def cancel!
    update!(status: 'cancelled', is_active: false)
  end

  def frequency_description
    interval = frequency_interval == 1 ? '' : "#{frequency_interval} "
    case frequency
    when 'daily' then "Every #{interval}day#{'s' if frequency_interval > 1}"
    when 'weekly' then "Every #{interval}week#{'s' if frequency_interval > 1}"
    when 'fortnightly' then 'Every 2 weeks'
    when 'monthly' then "Every #{interval}month#{'s' if frequency_interval > 1}"
    when 'quarterly' then "Every #{interval}quarter#{'s' if frequency_interval > 1}"
    when 'annually' then "Every #{interval}year#{'s' if frequency_interval > 1}"
    else frequency
    end
  end

  def remaining_occurrences
    return nil unless occurrences_limit
    [occurrences_limit - occurrences_count, 0].max
  end

  def assignee_name
    if assignment_type == 'user'
      assigned_user&.name || 'Unassigned'
    else
      assigned_role&.titleize || 'No Role'
    end
  end

  def skip_weekends?
    skip_config&.dig('skip_weekends') == true
  end

  def skip_holidays?
    skip_config&.dig('skip_holidays') == true
  end

  def skip_user_leave?
    skip_config&.dig('skip_user_leave') == true
  end

  private

  def set_next_generation_date
    self.next_generation_date ||= start_date
  end

  def clear_opposite_assignment
    if assignment_type == 'user'
      self.assigned_role = nil
    else
      self.assigned_user_id = nil
    end
  end

  def calculate_next_date(from_date: next_generation_date)
    return nil if from_date.nil?

    base_date = from_date
    interval = frequency_interval || 1

    new_date = case frequency
    when 'daily'
      base_date + interval.days
    when 'weekly'
      base_date + interval.weeks
    when 'fortnightly'
      base_date + (interval * 2).weeks
    when 'monthly'
      next_monthly_date(base_date, interval)
    when 'quarterly'
      base_date + (interval * 3).months
    when 'annually'
      base_date + interval.years
    else
      base_date + 1.month
    end

    new_date
  end

  def next_monthly_date(from_date, interval)
    target_date = from_date + interval.months

    if day_of_month.present?
      if day_of_month == -1
        # Last day of month
        target_date.end_of_month
      else
        # Specific day, but don't exceed month length
        day = [day_of_month, target_date.end_of_month.day].min
        Date.new(target_date.year, target_date.month, day)
      end
    else
      target_date
    end
  end

  def build_task_for_date(task_date)
    SmTask.new(
      name: name,
      description: description,
      job_id: job_id,
      assigned_user_id: assignment_type == 'user' ? assigned_user_id : nil,
      assigned_role: assignment_type == 'role' ? assigned_role : nil,
      start_date: task_date,
      duration_days: default_duration_days || 1,
      trade: trade,
      stage: stage,
      checklist_id: checklist_id,
      status: 'not_started',
      source_type: 'recurring',
      recurring_task_definition_id: id,
      recurring_sequence: occurrences_count + 1
    )
  end

  def should_skip?(date)
    return true if skip_weekends? && date.on_weekend?
    return true if skip_holidays? && PublicHoliday.exists?(date: date, state: 'QLD')
    return true if skip_user_leave? && user_on_leave?(date)
    false
  end

  def skip_to_valid_date(date)
    max_attempts = 30 # Prevent infinite loops
    attempts = 0

    while should_skip?(date) && attempts < max_attempts
      date += 1.day
      attempts += 1
    end

    attempts >= max_attempts ? nil : date
  end

  def user_on_leave?(date)
    return false unless assignment_type == 'user' && assigned_user_id.present?

    UserAbsence.where(user_id: assigned_user_id, approved: true)
               .where('start_date <= ? AND end_date >= ?', date, date)
               .exists?
  end

  def advance_to_next_date!
    self.next_generation_date = calculate_next_date
    save!
  end

  def notify_assignee(task)
    # TODO: Implement notification logic
    # Could use existing notification system or create a new one
    Rails.logger.info "Recurring task generated: #{task.name} (ID: #{task.id}) for #{assignee_name}"
  end

  def end_date_after_start_date
    if end_date <= start_date
      errors.add(:end_date, 'must be after start date')
    end
  end

  def assignment_present
    if assignment_type == 'user' && assigned_user_id.blank?
      # Allow unassigned user tasks
    elsif assignment_type == 'role' && assigned_role.blank?
      errors.add(:assigned_role, "can't be blank when assignment type is 'role'")
    end
  end
end

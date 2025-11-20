class WhsActionItem < ApplicationRecord
  # Polymorphic association - can belong to inspection, incident, or hazard
  belongs_to :actionable, polymorphic: true
  belongs_to :assigned_to_user, class_name: 'User', optional: true
  belongs_to :created_by, class_name: 'User'
  belongs_to :project_task, optional: true

  # Constants
  ACTION_TYPES = %w[immediate short_term long_term preventative].freeze
  PRIORITIES = %w[low medium high critical].freeze
  STATUSES = %w[open in_progress completed cancelled].freeze

  # Validations
  validates :title, presence: true
  validates :action_type, presence: true, inclusion: { in: ACTION_TYPES }
  validates :priority, presence: true, inclusion: { in: PRIORITIES }
  validates :status, presence: true, inclusion: { in: STATUSES }

  # Callbacks
  after_create :create_project_task_if_needed
  after_save :sync_with_project_task
  before_save :set_completion_timestamp

  # Scopes
  scope :open, -> { where(status: 'open') }
  scope :in_progress, -> { where(status: 'in_progress') }
  scope :completed, -> { where(status: 'completed') }
  scope :pending, -> { where(status: ['open', 'in_progress']) }
  scope :by_priority, ->(priority) { where(priority: priority) }
  scope :critical, -> { where(priority: 'critical') }
  scope :high_priority, -> { where(priority: ['critical', 'high']) }
  scope :assigned_to, ->(user) { where(assigned_to_user: user) }
  scope :overdue, -> { where('due_date < ? AND status NOT IN (?)', CompanySetting.today, ['completed', 'cancelled']) }
  scope :due_soon, ->(days = 7) { where('due_date <= ? AND due_date >= ? AND status NOT IN (?)', CompanySetting.today + days.days, CompanySetting.today, ['completed', 'cancelled']) }

  # State machine methods
  def can_start?
    status == 'open'
  end

  def can_complete?
    status.in?(['open', 'in_progress'])
  end

  def start!
    return false unless can_start?
    update!(status: 'in_progress')
  end

  def complete!(notes = nil)
    return false unless can_complete?

    update!(
      status: 'completed',
      completed_at: Time.current,
      completion_notes: notes
    )
  end

  def cancel!
    update!(status: 'cancelled')
  end

  # Helper methods
  def overdue?
    return false unless due_date.present?
    return false if completed? || cancelled?

    due_date < CompanySetting.today
  end

  def due_soon?(days = 7)
    return false unless due_date.present?
    return false if completed? || cancelled?

    due_date <= CompanySetting.today + days.days && due_date >= CompanySetting.today
  end

  def days_until_due
    return nil unless due_date.present?
    return 0 if overdue?

    (due_date - CompanySetting.today).to_i
  end

  def completed?
    status == 'completed'
  end

  def cancelled?
    status == 'cancelled'
  end

  def assigned?
    assigned_to_user.present?
  end

  def source_type
    actionable_type.demodulize
  end

  def source_description
    case actionable_type
    when 'WhsInspection'
      "Inspection: #{actionable.inspection_number}"
    when 'WhsIncident'
      "Incident: #{actionable.incident_number}"
    when 'WhsSwmsHazard'
      "SWMS Hazard: #{actionable.hazard_description.truncate(50)}"
    else
      actionable_type
    end
  end

  private

  def create_project_task_if_needed
    # TODO: Create linked ProjectTask when action item is created
    # This will be implemented in Phase 5 (integrations)
    return if project_task.present?
    return unless assigned_to_user.present?

    # Create task in project task system
    # project = find_related_project
    # if project
    #   task = project.project_tasks.create!(
    #     name: title,
    #     description: description,
    #     task_type: 'whs_action',
    #     category: 'safety',
    #     status: status_for_project_task,
    #     assigned_to: assigned_to_user,
    #     planned_end_date: due_date,
    #     duration_days: 1
    #   )
    #   update_column(:project_task_id, task.id)
    # end
  end

  def sync_with_project_task
    return unless project_task.present?
    return unless saved_change_to_status? || saved_change_to_due_date?

    # TODO: Sync status and dates with linked ProjectTask
    # project_task.update(
    #   status: status_for_project_task,
    #   planned_end_date: due_date
    # )
  end

  def set_completion_timestamp
    if status_changed? && status == 'completed'
      self.completed_at = Time.current
    end
  end

  def status_for_project_task
    case status
    when 'open'
      'not_started'
    when 'in_progress'
      'in_progress'
    when 'completed'
      'completed'
    when 'cancelled'
      'cancelled'
    else
      'not_started'
    end
  end
end

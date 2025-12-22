class MeetingAgendaItem < ApplicationRecord
  # Associations
  belongs_to :meeting
  belongs_to :presenter, class_name: "User", optional: true

  # DEPRECATED: Old task system - will be removed after Phase 5 migration
  belongs_to :created_task, class_name: "ProjectTask", optional: true

  # NEW: SSoT task system (SmTask via tasks table)
  belongs_to :sm_task, optional: true

  # Validations
  validates :title, presence: true
  validates :sequence_order, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :duration_minutes, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true

  # Scopes
  scope :completed, -> { where(completed: true) }
  scope :pending, -> { where(completed: false) }
  scope :ordered, -> { order(:sequence_order) }

  # Callbacks
  before_validation :set_sequence_order, on: :create

  # Helper methods
  def complete!
    update(completed: true)
  end

  def create_action_item!(task_attributes)
    return if created_task.present?

    # Create a project task (action item) from this agenda item
    # Following B11.001: Task status lifecycle
    task = meeting.construction.project_tasks.build(task_attributes.merge(
      status: "not_started",
      description: "Action item from meeting: #{meeting.title}\n\nAgenda item: #{title}\n\n#{description}"
    ))

    if task.save
      update(created_task: task)

      # NEW: Also create SmTask (dual-write during migration)
      create_sm_action_item!(task_attributes)

      task
    else
      nil
    end
  end

  # NEW: Create SmTask action item (SSoT)
  def create_sm_action_item!(task_attributes)
    return if sm_task.present?

    job = meeting.job
    return unless job.present?

    task = job.sm_tasks.create!(
      name: "Meeting: #{task_attributes[:name] || title}",
      description: "Action item from meeting: #{meeting.title}\n\nAgenda item: #{title}\n\n#{description}",
      trade: "Admin",
      stage: "Meeting Action",
      status: "not_started",
      assigned_user: task_attributes[:assigned_to],
      start_date: CorporateCompanySetting.today,
      end_date: task_attributes[:planned_end_date] || CorporateCompanySetting.today + 7.days,
      duration_days: task_attributes[:duration_days] || 7,
      created_by: meeting.organizer&.user
    )
    update_column(:sm_task_id, task.id)
  rescue StandardError => e
    Rails.logger.error("[Meeting→SmTask] Failed to create SmTask for agenda item #{id}: #{e.message}")
    # Don't fail action item creation if SmTask creation fails
  end

  private

  def set_sequence_order
    return if sequence_order.present?

    # Auto-assign sequence_order based on existing items
    max_order = meeting.meeting_agenda_items.maximum(:sequence_order) || 0
    self.sequence_order = max_order + 1
  end
end

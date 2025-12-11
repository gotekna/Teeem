class BpmnTaskInstance < ApplicationRecord
  # Associations
  belongs_to :bpmn_token
  belongs_to :bpmn_node
  belongs_to :assigned_to, polymorphic: true, optional: true

  # Delegate to process instance
  delegate :bpmn_process_instance, to: :bpmn_token
  delegate :subject, to: :bpmn_process_instance

  # Constants
  STATUSES = %w[pending in_progress completed failed cancelled skipped].freeze
  TASK_TYPES = %w[user_task service_task].freeze

  # Validations
  validates :status, inclusion: { in: STATUSES }
  validates :task_type, inclusion: { in: TASK_TYPES }

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :in_progress, -> { where(status: "in_progress") }
  scope :actionable, -> { where(status: %w[pending in_progress]) }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :user_tasks, -> { where(task_type: "user_task") }
  scope :service_tasks, -> { where(task_type: "service_task") }

  # Callbacks
  after_create :log_task_created

  # Instance methods
  def pending?
    status == "pending"
  end

  def in_progress?
    status == "in_progress"
  end

  def completed?
    status == "completed"
  end

  def failed?
    status == "failed"
  end

  def cancelled?
    status == "cancelled"
  end

  def actionable?
    status.in?(%w[pending in_progress])
  end

  def user_task?
    task_type == "user_task"
  end

  def service_task?
    task_type == "service_task"
  end

  # Actions
  def start!
    update!(status: "in_progress", started_at: Time.current)
  end

  def complete!(result = {})
    update!(
      status: "completed",
      completed_at: Time.current,
      execution_result: result
    )
    log_task_completed
    BpmnTokenAdvanceJob.perform_later(bpmn_token_id)
  end

  def fail!(error)
    update!(
      status: "failed",
      error_message: error,
      retry_count: retry_count + 1
    )
    log_task_failed(error)
  end

  def cancel!
    update!(status: "cancelled", completed_at: Time.current)
  end

  def skip!
    update!(status: "skipped", completed_at: Time.current)
    BpmnTokenAdvanceJob.perform_later(bpmn_token_id)
  end

  # Form data management
  def set_form_field(key, value)
    self.form_data = (form_data || {}).merge(key.to_s => value)
    save!
  end

  def get_form_field(key)
    form_data&.dig(key.to_s)
  end

  # Assignment
  def can_action?(user)
    return false unless actionable?

    # If assigned to specific user
    if assigned_to_type == "User"
      return assigned_to_id == user.id
    end

    # If assigned to role
    config = bpmn_node.config
    if config&.dig("assignee_type") == "role"
      return user.role == config["assignee_value"]
    end

    # Allow any user if not specifically assigned
    true
  end

  def claim!(user)
    return false unless pending?
    return false unless can_action?(user)

    update!(assigned_to: user, status: "in_progress", started_at: Time.current)
    true
  end

  def unclaim!
    return false unless in_progress?

    update!(assigned_to: nil, status: "pending", started_at: nil)
    true
  end

  # Display helpers
  def display_name
    bpmn_node.display_name
  end

  def process_name
    bpmn_process_instance.bpmn_process.name
  end

  def assignee_name
    assigned_to.try(:name) || assigned_to.try(:email) || "Unassigned"
  end

  def overdue?
    due_date.present? && due_date < Time.current && actionable?
  end

  def time_remaining
    return nil unless due_date.present? && actionable?

    due_date - Time.current
  end

  private

  def log_task_created
    Rails.logger.info("BPMN Task ##{id} created: #{task_type} - #{display_name}")
  end

  def log_task_completed
    Rails.logger.info("BPMN Task ##{id} completed")
  end

  def log_task_failed(error)
    Rails.logger.error("BPMN Task ##{id} failed: #{error}")
  end
end

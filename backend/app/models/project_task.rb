class ProjectTask < ApplicationRecord
  belongs_to :project
  belongs_to :task_template, optional: true
  belongs_to :purchase_order, optional: true
  belongs_to :assigned_to, class_name: "User", optional: true

  # Parent task relationship (for spawned subtasks)
  belongs_to :parent_task, class_name: "ProjectTask", optional: true
  has_many :spawned_tasks, class_name: "ProjectTask", foreign_key: "parent_task_id", dependent: :destroy
  belongs_to :supervisor_checked_by, class_name: "User", optional: true

  # Dependency relationships
  has_many :successor_dependencies, class_name: "TaskDependency",
           foreign_key: "predecessor_task_id", dependent: :destroy
  has_many :predecessor_dependencies, class_name: "TaskDependency",
           foreign_key: "successor_task_id", dependent: :destroy

  has_many :successor_tasks, through: :successor_dependencies, source: :successor_task
  has_many :predecessor_tasks, through: :predecessor_dependencies, source: :predecessor_task

  # Progress tracking
  has_many :task_updates, dependent: :destroy

  # Supervisor checklist items
  has_many :project_task_checklist_items, dependent: :destroy

  validates :name, presence: true
  validates :task_type, presence: true
  validates :category, presence: true
  validates :status, inclusion: { in: %w[not_started in_progress complete on_hold] }
  validates :progress_percentage, inclusion: { in: 0..100 }
  validates :duration_days, presence: true, numericality: { greater_than: 0 }

  scope :by_status, ->(status) { where(status: status) }
  scope :not_started, -> { where(status: "not_started") }
  scope :in_progress, -> { where(status: "in_progress") }
  scope :completed, -> { where(status: "complete") }
  scope :on_hold, -> { where(status: "on_hold") }
  scope :critical_path, -> { where(is_critical_path: true) }
  scope :milestones, -> { where(is_milestone: true) }
  scope :overdue, -> { where("planned_end_date < ? AND status != ?", Date.current, "complete") }
  scope :upcoming, -> { where("planned_start_date <= ? AND status = ?", 1.week.from_now, "not_started") }
  scope :by_category, ->(category) { where(category: category) }

  # New scopes for schedule template features
  scope :normal_tasks, -> { where(spawned_type: nil) }
  scope :photo_tasks, -> { where(spawned_type: "photo") }
  scope :certificate_tasks, -> { where(spawned_type: "certificate") }
  scope :subtasks, -> { where(spawned_type: "subtask") }
  scope :requiring_supervisor, -> { where(requires_supervisor_check: true) }
  scope :supervisor_pending, -> { requiring_supervisor.where(supervisor_checked_at: nil) }
  scope :with_tag, ->(tag) { where("tags @> ?", [ tag ].to_json) }
  scope :critical_po_tasks, -> { where(critical_po: true) }
  scope :by_sequence, -> { order(sequence_order: :asc) }

  before_save :update_actual_dates
  after_save :update_project_timeline, if: :saved_change_to_planned_end_date?
  after_save :spawn_child_tasks_on_status_change, if: :saved_change_to_status?
  after_save :auto_complete_predecessors_if_enabled, if: :saved_change_to_status?

  def complete!
    update!(
      status: "complete",
      progress_percentage: 100,
      actual_end_date: Date.current
    )
  end

  def start!
    update!(
      status: "in_progress",
      actual_start_date: actual_start_date || Date.current
    )
  end

  def can_start?
    predecessor_tasks.all? { |pred| pred.status == "complete" }
  end

  def blocked_by
    predecessor_tasks.where.not(status: "complete")
  end

  def total_float
    return 0 unless planned_start_date && planned_end_date
    # This is simplified - would need backward pass for accurate float calculation
    0
  end

  def is_on_critical_path?
    is_critical_path
  end

  # Check if task has required materials (linked to a PO)
  def has_purchase_order?
    purchase_order_id.present?
  end

  # Check if materials will arrive on time
  def materials_on_time?
    return true unless has_purchase_order?
    purchase_order.delivery_before_task_start?(self)
  end

  # Get materials status for this task
  # Returns: 'no_po', 'on_time', or 'delayed'
  def materials_status
    return "no_po" unless has_purchase_order?
    return "on_time" if materials_on_time?
    "delayed"
  end

  # Schedule template helper methods
  def spawned_task?
    spawned_type.present?
  end

  def photo_task?
    spawned_type == "photo"
  end

  def certificate_task?
    spawned_type == "certificate"
  end

  def subtask?
    spawned_type == "subtask"
  end

  def has_photo?
    photo_uploaded_at.present?
  end

  def has_certificate?
    certificate_uploaded_at.present?
  end

  def supervisor_checked?
    supervisor_checked_at.present?
  end

  def needs_supervisor_check?
    requires_supervisor_check && !supervisor_checked?
  end

  def tag_list
    tags || []
  end

  def has_tag?(tag)
    tag_list.include?(tag)
  end

  # Mark supervisor check as complete
  def mark_supervisor_checked!(user)
    update!(
      supervisor_checked_at: Time.current,
      supervisor_checked_by: user
    )
  end

  # Upload photo for this task
  def mark_photo_uploaded!
    update!(photo_uploaded_at: Time.current)
  end

  # Upload certificate for this task
  def mark_certificate_uploaded!
    update!(certificate_uploaded_at: Time.current)
  end

  private

  def update_actual_dates
    case status
    when "in_progress"
      self.actual_start_date ||= Date.current
    when "complete"
      self.actual_start_date ||= Date.current
      self.actual_end_date = Date.current
      self.progress_percentage = 100
    end
  end

  def update_project_timeline
    # Recalculate project end date if this task's end date changed
    project.reload
  end

  def spawn_child_tasks_on_status_change
    # DEPRECATED: Phase 6 Tier 3 - ScheduleTemplateRow and Schedule::TaskSpawner deleted
    # Task spawning is now handled by SmTaskCompletionService for SmTask
    # This callback is a no-op for backward compatibility
  end

  def auto_complete_predecessors_if_enabled
    # If this task is complete and has auto_complete_predecessors enabled,
    # mark all predecessor tasks as complete
    return unless status == "complete"
    return unless auto_complete_predecessors

    predecessor_tasks.where.not(status: "complete").find_each do |pred|
      pred.complete!
      Rails.logger.info("Auto-completed predecessor task #{pred.id} (#{pred.name})")
    end
  rescue StandardError => e
    Rails.logger.error("Failed to auto-complete predecessors for task #{id}: #{e.message}")
    # Don't raise - we don't want to block the completion
  end

  # Auto-complete all subtasks for this task
  public
  def auto_complete_all_subtasks!(user_name = nil)
    return 0 unless spawned_tasks.subtasks.any?

    completed_count = 0
    spawned_tasks.subtasks.where.not(status: "complete").find_each do |subtask|
      subtask.update!(
        status: "complete",
        progress_percentage: 100,
        actual_end_date: Date.current,
        completed_by: user_name
      )
      completed_count += 1
      Rails.logger.info("Auto-completed subtask #{subtask.id} (#{subtask.name}) for parent task #{id}")
    end

    completed_count
  rescue StandardError => e
    Rails.logger.error("Failed to auto-complete subtasks for task #{id}: #{e.message}")
    raise
  end
end

# frozen_string_literal: true

# SmTask - Job task instances for SM Gantt system
#
# See Trinity Bible Rules 9.20-9.29 (SM Gantt rules)
# See GANTT_ARCHITECTURE_PLAN.md Section 2.1
#
class SmTask < ApplicationRecord
  self.table_name = "sm_tasks"

  # Status enum
  enum :status, {
    not_started: "not_started",
    started: "started",
    completed: "completed"
  }, prefix: true

  # Confirm status enum
  enum :confirm_status, {
    confirm_requested: "confirm_requested",
    supplier_confirmed: "supplier_confirmed",
    moved_after_confirm: "moved_after_confirm"
  }, prefix: true, default: nil

  # Progress percentage based on status
  def progress_percentage
    case status
    when "completed" then 100
    when "started" then 50
    else 0
    end
  end

  # Hold notes - returns hold_reason description (used by controller)
  def hold_notes
    hold_reason&.description
  end

  # Associations
  belongs_to :job
  alias_method :construction, :job  # Backwards compatibility
  alias_attribute :construction_id, :job_id  # Backwards compatibility for queries

  # SSoT association - points to sm_schedule_master (THE ONE template system)
  belongs_to :sm_schedule_master, optional: true
  belongs_to :parent_task, class_name: "SmTask", optional: true
  has_many :children, class_name: "SmTask", foreign_key: :parent_task_id, dependent: :nullify

  belongs_to :hold_reason, class_name: "SmHoldReason", optional: true
  belongs_to :hold_started_by, class_name: "User", optional: true
  belongs_to :hold_released_by, class_name: "User", optional: true
  belongs_to :supplier_confirmed_by, class_name: "User", optional: true

  belongs_to :purchase_order, optional: true
  belongs_to :assigned_user, class_name: "User", optional: true
  belongs_to :supplier, class_name: "Contact", optional: true
  belongs_to :checklist, class_name: "SupervisorChecklistTemplate", optional: true
  belongs_to :photo_entity_tab, class_name: "EntityTab", optional: true
  belongs_to :spawn_scan_task, class_name: "SmScheduleMaster", optional: true

  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true

  # Recurring task support
  belongs_to :recurring_task_definition, class_name: "SmRecurringTaskDefinition", optional: true

  # Dependencies (separate table per Rule 9.25)
  has_many :predecessor_dependencies, class_name: "SmDependency", foreign_key: :successor_task_id, dependent: :destroy
  has_many :successor_dependencies, class_name: "SmDependency", foreign_key: :predecessor_task_id, dependent: :destroy
  has_many :predecessors, through: :predecessor_dependencies, source: :predecessor_task
  has_many :successors, through: :successor_dependencies, source: :successor_task

  # Logs
  has_many :rollover_logs, class_name: "SmRolloverLog", dependent: :destroy
  has_many :parent_spawn_logs, class_name: "SmSpawnLog", foreign_key: :parent_task_id, dependent: :destroy
  has_many :spawned_spawn_logs, class_name: "SmSpawnLog", foreign_key: :spawned_task_id, dependent: :destroy
  has_many :hold_logs, class_name: "SmHoldLog", dependent: :destroy
  has_many :working_drawing_pages, class_name: "SmWorkingDrawingPage", dependent: :destroy

  # Phase 2: Resource Allocations
  has_many :resource_allocations, class_name: "SmResourceAllocation", dependent: :destroy
  has_many :time_entries, class_name: "SmTimeEntry", dependent: :destroy

  # Phase 3: Field & Collaboration
  has_many :task_photos, class_name: "SmTaskPhoto", dependent: :destroy
  has_many :voice_notes, class_name: "SmVoiceNote", dependent: :destroy
  has_many :comments, class_name: "SmComment", dependent: :destroy
  has_many :activities, class_name: "SmActivity", dependent: :nullify

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  validates :task_number, presence: true, uniqueness: { scope: :construction_id }
  validates :sequence_order, presence: true
  validates :start_date, presence: true
  validates :end_date, presence: true
  validates :duration_days, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :status, presence: true
  validate :end_date_after_start_date

  # Scopes
  scope :active, -> { where.not(status: "completed") }
  scope :hold_tasks, -> { where(is_hold_task: true) }
  scope :regular_tasks, -> { where(is_hold_task: false) }
  scope :ordered, -> { order(:sequence_order) }
  scope :by_trade, ->(trade) { where(trade: trade) if trade.present? }
  scope :for_construction, ->(construction_id) { where(construction_id: construction_id) }
  scope :past_due, -> { where("start_date < ?", Date.current).active }
  scope :for_role, ->(role) { where(assigned_role: role) }
  scope :for_user_roles, ->(user) { where(assigned_role: user.assigned_roles) if user&.assigned_roles.present? }
  scope :recurring, -> { where(source_type: 'recurring') }
  scope :manual, -> { where(source_type: 'manual') }
  scope :from_job_template, -> { where(source_type: 'job') }

  # Callbacks
  before_validation :set_task_number, on: :create
  before_validation :calculate_end_date, if: -> { start_date_changed? || duration_days_changed? }
  before_save :sync_supplier_from_po, if: -> { purchase_order_id_changed? && purchase_order_id.present? }
  before_save :clear_spawn_tasks_if_not_po

  # Lock hierarchy check (Rule 9.22)
  # Priority: supplier_confirm > confirm > started > completed > hold
  def locked?
    supplier_confirm? || confirm? || status_started? || status_completed? || hold?
  end

  def lock_type
    return "supplier_confirm" if supplier_confirm?
    return "confirm" if confirm?
    return "started" if status_started?
    return "completed" if status_completed?
    return "hold" if hold?
    nil
  end

  def lock_priority
    case lock_type
    when "supplier_confirm" then 1
    when "confirm" then 2
    when "started" then 3
    when "completed" then 4
    when "hold" then 5
    else nil
    end
  end

  # Can this task be unlocked?
  def unlockable?
    # Started and completed cannot be unlocked
    return false if status_started? || status_completed?
    # Others can be cleared
    supplier_confirm? || confirm? || hold?
  end

  # Clear all clearable locks
  def clear_locks!
    return false unless unlockable?
    update!(
      supplier_confirm: false,
      confirm: false,
      hold: false,
      hold_at: nil
    )
  end

  # Start task
  def start!
    return false unless status_not_started?
    update!(
      status: "started",
      started_at: Time.current
    )
  end

  # Complete task
  def complete!(passed: nil)
    return false unless status_started? || status_not_started?
    update!(
      status: "completed",
      completed_at: Time.current,
      passed: passed
    )
  end

  # Hold task helpers
  def hold_active?
    is_hold_task? && status_not_started?
  end

  # Get active dependencies
  def active_predecessor_dependencies
    predecessor_dependencies.where(active: true)
  end

  def active_successor_dependencies
    successor_dependencies.where(active: true)
  end

  # Documentation categories helper
  def documentation_categories
    return [] if documentation_category_ids.blank?
    ConstructionDocumentationTab.where(
      construction_id: construction_id,
      id: documentation_category_ids
    )
  end

  # PO Timing helpers (for CheckPoTimingJob)
  def has_purchase_order?
    purchase_order_id.present?
  end

  # Check if materials will arrive on time
  def materials_on_time?
    return true unless has_purchase_order?
    return true unless purchase_order.required_date.present? && start_date.present?
    purchase_order.required_date <= start_date
  end

  # Get materials status for this task
  def materials_status
    return "no_po" unless has_purchase_order?
    return "on_time" if materials_on_time?
    "delayed"
  end

  private

  def set_task_number
    return if task_number.present?
    max_number = SmTask.where(construction_id: construction_id).maximum(:task_number) || 0
    self.task_number = max_number + 1
  end

  # Clear spawn_order_task and spawn_call_task if po_required is false
  # These spawn tasks are only valid for PO tasks
  def clear_spawn_tasks_if_not_po
    unless po_required
      self.spawn_order_task = false
      self.spawn_call_task = false
      self.order_time_days = nil
      self.call_time_days = nil
    end
  end

  def calculate_end_date
    return unless start_date.present? && duration_days.present?
    # For now, simple calculation. Will be enhanced with working days calculator
    self.end_date = start_date + (duration_days - 1).days
  end

  def end_date_after_start_date
    return unless start_date.present? && end_date.present?
    if end_date < start_date
      errors.add(:end_date, "must be on or after start date")
    end
  end

  # Sync supplier from PO when task is linked (One Entity concept)
  # When a task is linked to a PO, inherit the supplier from the PO
  def sync_supplier_from_po
    return unless purchase_order.present?

    # Inherit supplier from PO - this is the "One Entity" rule
    self.supplier_id = purchase_order.supplier_id

    Rails.logger.info "[PO-Task Sync] Task #{id || 'new'} linked to PO #{purchase_order.purchase_order_number}, inherited supplier_id=#{supplier_id}"
  rescue StandardError => e
    Rails.logger.error "[PO-Task Sync] Failed to sync supplier from PO for task #{id}: #{e.message}"
  end
end

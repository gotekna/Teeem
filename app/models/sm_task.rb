# frozen_string_literal: true

# SmTask - Job task instances for SM Gantt system
#
# See Trinity Bible Rules 9.20-9.29 (SM Gantt rules)
# See GANTT_ARCHITECTURE_PLAN.md Section 2.1
#
class SmTask < ApplicationRecord
  # Status enum
  enum :status, {
    not_started: 'not_started',
    started: 'started',
    completed: 'completed'
  }, prefix: true

  # Confirm status enum
  enum :confirm_status, {
    confirm_requested: 'confirm_requested',
    supplier_confirmed: 'supplier_confirmed',
    moved_after_confirm: 'moved_after_confirm'
  }, prefix: true, default: nil

  # Associations
  belongs_to :construction
  belongs_to :template_row, class_name: 'ScheduleTemplateRow', optional: true
  belongs_to :parent_task, class_name: 'SmTask', optional: true
  has_many :children, class_name: 'SmTask', foreign_key: :parent_task_id, dependent: :nullify

  belongs_to :hold_reason, class_name: 'SmHoldReason', optional: true
  belongs_to :hold_started_by, class_name: 'User', optional: true
  belongs_to :hold_released_by, class_name: 'User', optional: true
  belongs_to :supplier_confirmed_by, class_name: 'User', optional: true

  belongs_to :purchase_order, optional: true
  belongs_to :assigned_user, class_name: 'User', optional: true
  belongs_to :supplier, class_name: 'Contact', optional: true
  belongs_to :checklist, class_name: 'SupervisorChecklistTemplate', optional: true

  belongs_to :created_by, class_name: 'User', optional: true
  belongs_to :updated_by, class_name: 'User', optional: true

  # Dependencies (separate table per Rule 9.25)
  has_many :predecessor_dependencies, class_name: 'SmDependency', foreign_key: :successor_task_id, dependent: :destroy
  has_many :successor_dependencies, class_name: 'SmDependency', foreign_key: :predecessor_task_id, dependent: :destroy
  has_many :predecessors, through: :predecessor_dependencies, source: :predecessor_task
  has_many :successors, through: :successor_dependencies, source: :successor_task

  # Logs
  has_many :rollover_logs, class_name: 'SmRolloverLog', dependent: :destroy
  has_many :parent_spawn_logs, class_name: 'SmSpawnLog', foreign_key: :parent_task_id, dependent: :destroy
  has_many :spawned_spawn_logs, class_name: 'SmSpawnLog', foreign_key: :spawned_task_id, dependent: :destroy
  has_many :hold_logs, class_name: 'SmHoldLog', dependent: :destroy
  has_many :working_drawing_pages, class_name: 'SmWorkingDrawingPage', dependent: :destroy

  # Phase 2: Resource Allocations
  has_many :resource_allocations, class_name: 'SmResourceAllocation', dependent: :destroy
  has_many :time_entries, class_name: 'SmTimeEntry', dependent: :destroy

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
  scope :active, -> { where.not(status: 'completed') }
  scope :hold_tasks, -> { where(is_hold_task: true) }
  scope :regular_tasks, -> { where(is_hold_task: false) }
  scope :ordered, -> { order(:sequence_order) }
  scope :by_trade, ->(trade) { where(trade: trade) if trade.present? }
  scope :for_construction, ->(construction_id) { where(construction_id: construction_id) }
  scope :past_due, -> { where('start_date < ?', Date.current).active }

  # Callbacks
  before_validation :set_task_number, on: :create
  before_validation :calculate_end_date, if: -> { start_date_changed? || duration_days_changed? }

  # Lock hierarchy check (Rule 9.22)
  # Priority: supplier_confirm > confirm > started > completed > manually_positioned
  def locked?
    supplier_confirm? || confirm? || status_started? || status_completed? || manually_positioned?
  end

  def lock_type
    return 'supplier_confirm' if supplier_confirm?
    return 'confirm' if confirm?
    return 'started' if status_started?
    return 'completed' if status_completed?
    return 'manually_positioned' if manually_positioned?
    nil
  end

  def lock_priority
    case lock_type
    when 'supplier_confirm' then 1
    when 'confirm' then 2
    when 'started' then 3
    when 'completed' then 4
    when 'manually_positioned' then 5
    else nil
    end
  end

  # Can this task be unlocked?
  def unlockable?
    # Started and completed cannot be unlocked
    return false if status_started? || status_completed?
    # Others can be cleared
    supplier_confirm? || confirm? || manually_positioned?
  end

  # Clear all clearable locks
  def clear_locks!
    return false unless unlockable?
    update!(
      supplier_confirm: false,
      confirm: false,
      manually_positioned: false,
      manually_positioned_at: nil
    )
  end

  # Start task
  def start!
    return false unless status_not_started?
    update!(
      status: 'started',
      started_at: Time.current
    )
  end

  # Complete task
  def complete!(passed: nil)
    return false unless status_started? || status_not_started?
    update!(
      status: 'completed',
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

  private

  def set_task_number
    return if task_number.present?
    max_number = SmTask.where(construction_id: construction_id).maximum(:task_number) || 0
    self.task_number = max_number + 1
  end

  def calculate_end_date
    return unless start_date.present? && duration_days.present?
    # For now, simple calculation. Will be enhanced with working days calculator
    self.end_date = start_date + (duration_days - 1).days
  end

  def end_date_after_start_date
    return unless start_date.present? && end_date.present?
    if end_date < start_date
      errors.add(:end_date, 'must be on or after start date')
    end
  end
end

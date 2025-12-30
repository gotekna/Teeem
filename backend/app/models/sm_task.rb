# frozen_string_literal: true

# SmTask - Job task instances for SM Gantt system
#
# See Trinity Bible Rules 9.20-9.29 (SM Gantt rules)
# See GANTT_ARCHITECTURE_PLAN.md Section 2.1
#
class SmTask < ApplicationRecord
  include Searchable

  # Searchable columns for full-text search (GIN index)
  searchable_columns :name, :description

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
  belongs_to :job, optional: true  # Tasks can exist without a job
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

  # SSoT: PO-Task link is via PurchaseOrder.sm_task_id (one PO -> one task)
  # Use linked_purchase_order to get the PO for this task
  has_one :purchase_order, class_name: "PurchaseOrder", foreign_key: "sm_task_id"

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
  has_many :rollover_logs, class_name: "SmRolloverLog", foreign_key: :task_id, dependent: :destroy
  has_many :parent_spawn_logs, class_name: "SmSpawnLog", foreign_key: :parent_task_id, dependent: :destroy
  has_many :spawned_spawn_logs, class_name: "SmSpawnLog", foreign_key: :spawned_task_id, dependent: :destroy
  has_many :hold_logs, class_name: "SmHoldLog", foreign_key: :hold_task_id, dependent: :destroy
  has_many :working_drawing_pages, class_name: "SmWorkingDrawingPage", foreign_key: :task_id, dependent: :destroy

  # Phase 2: Resource Allocations
  has_many :resource_allocations, class_name: "SmResourceAllocation", foreign_key: :task_id, dependent: :destroy
  has_many :time_entries, class_name: "SmTimeEntry", foreign_key: :task_id, dependent: :destroy

  # Phase 3: Field & Collaboration
  has_many :task_photos, class_name: "SmTaskPhoto", dependent: :destroy
  has_many :voice_notes, class_name: "SmVoiceNote", dependent: :destroy
  has_many :comments, class_name: "SmComment", dependent: :destroy
  has_many :activities, class_name: "SmActivity", dependent: :nullify

  # Task Attachments (emails, documents, uploads)
  has_many :sm_task_attachments, dependent: :destroy
  has_many :attached_emails, through: :sm_task_attachments, source: :attachable, source_type: "EmailWarehouse"
  has_many :attached_documents, through: :sm_task_attachments, source: :attachable, source_type: "CorporateCompanyDocument"

  # Task Followers (for notifications)
  has_many :task_followers, dependent: :destroy
  has_many :followers, through: :task_followers, source: :user

  # SaaS Customer association (for tickets and customer-linked tasks)
  belongs_to :saas_customer, class_name: "Contact", optional: true

  # Follow/unfollow helper methods
  def follow_by(user)
    task_followers.find_or_create_by(user: user)
  end

  def unfollow_by(user)
    task_followers.where(user: user).destroy_all
  end

  def followed_by?(user)
    task_followers.exists?(user: user)
  end

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  validates :task_number, presence: true  # Template task_number is SSoT - no uniqueness constraint
  validates :sequence_order, presence: true
  validates :start_date, presence: true
  validates :end_date, presence: true
  validates :duration_days, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
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
  # Show tasks assigned directly to user OR assigned to user's roles
  scope :for_user_roles, ->(user) {
    return none unless user.present?

    conditions = []
    conditions << where(assigned_user_id: user.id) if user.id.present?
    conditions << where(assigned_role: user.assigned_roles) if user.assigned_roles.present?

    return none if conditions.empty?
    conditions.reduce(:or)
  }
  scope :recurring, -> { where(source_type: 'recurring') }
  scope :manual, -> { where(source_type: 'manual') }
  scope :from_job_template, -> { where(source_type: 'job') }

  # ============================================
  # Support Ticket Scopes
  # ============================================
  scope :tickets, -> { where(is_ticket: true) }
  scope :non_tickets, -> { where(is_ticket: [false, nil]) }
  scope :for_saas_customer, ->(customer_id) { where(saas_customer_id: customer_id) }
  scope :customer_visible, -> { where(customer_visible: true) }
  scope :submitted_via_portal, -> { where(submitted_via_portal: true) }
  scope :sla_breached, -> { tickets.where("sla_resolution_due_at < ? AND status != ?", Time.current, "completed") }
  scope :sla_at_risk, -> {
    tickets.where(
      "sla_resolution_due_at BETWEEN ? AND ? AND status != ?",
      Time.current,
      4.hours.from_now,
      "completed"
    )
  }
  scope :by_ticket_priority, ->(priority) { tickets.where(ticket_priority: priority) }
  scope :by_ticket_category, ->(category) { tickets.where(ticket_category: category) }

  # Callbacks
  before_validation :set_task_number, on: :create
  before_validation :calculate_end_date, if: -> { start_date_changed? || duration_days_changed? }
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

  # ============================================
  # Support Ticket Methods
  # ============================================

  # SLA defaults by priority (in hours)
  SLA_RESPONSE_HOURS = {
    "urgent" => 1,
    "high" => 4,
    "medium" => 8,
    "low" => 24
  }.freeze

  SLA_RESOLUTION_HOURS = {
    "urgent" => 4,
    "high" => 24,
    "medium" => 72,
    "low" => 168  # 7 days
  }.freeze

  TICKET_PRIORITIES = %w[urgent high medium low].freeze
  TICKET_CATEGORIES = %w[bug feature_request question onboarding billing other].freeze

  # Set SLA deadlines based on priority
  def set_sla_deadlines!
    return unless is_ticket && ticket_priority.present?

    base_time = created_at || Time.current
    self.sla_response_due_at = base_time + SLA_RESPONSE_HOURS[ticket_priority].hours
    self.sla_resolution_due_at = base_time + SLA_RESOLUTION_HOURS[ticket_priority].hours
    save!
  end

  # Record first response time
  def record_first_response!
    return if sla_first_response_at.present?
    update!(sla_first_response_at: Time.current)
  end

  # Check if response SLA is breached
  def sla_response_breached?
    return false unless is_ticket && sla_response_due_at.present?
    sla_first_response_at.nil? && Time.current > sla_response_due_at
  end

  # Check if resolution SLA is breached
  def sla_resolution_breached?
    return false unless is_ticket && sla_resolution_due_at.present?
    !status_completed? && Time.current > sla_resolution_due_at
  end

  # Check if any SLA is breached
  def sla_breached?
    sla_response_breached? || sla_resolution_breached?
  end

  # Time until resolution SLA breach (or negative if already breached)
  def time_until_sla_breach
    return nil unless sla_resolution_due_at.present?
    sla_resolution_due_at - Time.current
  end

  # SLA status for display
  def sla_status
    return "n/a" unless is_ticket
    return "completed" if status_completed?
    return "breached" if sla_breached?
    return "at_risk" if time_until_sla_breach && time_until_sla_breach < 4.hours
    "on_track"
  end

  # Ticket summary for API
  def ticket_summary
    return nil unless is_ticket

    {
      priority: ticket_priority,
      category: ticket_category,
      sla_status: sla_status,
      sla_response_due: sla_response_due_at,
      sla_resolution_due: sla_resolution_due_at,
      first_response_at: sla_first_response_at,
      response_breached: sla_response_breached?,
      resolution_breached: sla_resolution_breached?,
      customer_visible: customer_visible,
      submitted_via_portal: submitted_via_portal
    }
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

  # SSoT: PO-Task link is via PurchaseOrder.sm_task_id
  # This reverse lookup finds the PO that points to this task
  def linked_purchase_order
    @linked_purchase_order ||= PurchaseOrder.find_by(sm_task_id: id)
  end

  # Alias for backwards compatibility
  alias_method :purchase_order, :linked_purchase_order

  def has_linked_po?
    PurchaseOrder.exists?(sm_task_id: id)
  end

  # Alias for backwards compatibility
  alias_method :has_purchase_order?, :has_linked_po?

  # Check if materials will arrive on time
  def materials_on_time?
    po = linked_purchase_order
    return true unless po
    return true unless po.required_date.present? && start_date.present?
    po.required_date <= start_date
  end

  # Get materials status for this task
  def materials_status
    return "no_po" unless has_linked_po?
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
    # Use WorkingDaysCalculator to respect working days (M-F by default)
    calendar = WorkingDaysCalculator.new(CorporateCompanySetting.instance)
    self.end_date = calendar.add_working_days(start_date, duration_days - 1)
  end

  def end_date_after_start_date
    return unless start_date.present? && end_date.present?
    if end_date < start_date
      errors.add(:end_date, "must be on or after start date")
    end
  end

  # NOTE: sync_supplier_from_po removed as part of SSoT cleanup
  # SSoT: PO-Task link is now via PurchaseOrder.sm_task_id only
  # Supplier sync happens via PurchaseOrder model when sm_task_id is set
end

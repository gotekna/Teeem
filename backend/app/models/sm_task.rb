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

  # ActiveStorage attachments (for email attachments, uploads, etc.)
  has_many_attached :files

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

  # Workflow triggers
  belongs_to :start_workflow, class_name: "BpmnProcess", optional: true
  belongs_to :complete_workflow, class_name: "BpmnProcess", optional: true

  # Document types for GET task spawning on completion
  has_many :sm_task_document_types, dependent: :destroy
  has_many :document_types, through: :sm_task_document_types

  # SSoT: predecessor_ids jsonb column (synced from SmScheduleMaster)
  # Format: [{id: task_number, lag: 0, type: "FS"}, ...]
  # NOTE: We explicitly define predecessor_ids reader/writer to use the jsonb column
  # because Rails would otherwise generate these for has_many associations
  def predecessor_ids
    read_attribute(:predecessor_ids) || []
  end

  def predecessor_ids=(value)
    write_attribute(:predecessor_ids, value || [])
  end

  # Get predecessor task_numbers from jsonb
  def predecessor_task_numbers_array
    predecessor_ids.map { |p| (p["id"] || p[:id]).to_i }.compact
  end

  # Get actual predecessor SmTask records (looks up by task_number on same job)
  def predecessors
    return SmTask.none if predecessor_ids.empty? || job_id.nil?
    task_numbers = predecessor_task_numbers_array
    return SmTask.none if task_numbers.empty?
    SmTask.where(job_id: job_id, task_number: task_numbers)
  end

  # Get actual successor SmTask records (tasks that have this task in their predecessor_ids)
  def successors
    return SmTask.none if job_id.nil?
    SmTask.where(job_id: job_id)
          .where("predecessor_ids @> ?", [{ id: task_number }].to_json)
  end

  # Format predecessors as "2FS+3, 5SS" etc (matching SmScheduleMaster format)
  def predecessor_display
    return "None" if predecessor_ids.empty?
    predecessor_ids.map { |pred| format_predecessor(pred) }.compact.join(", ")
  end

  private

  def format_predecessor(pred_data)
    return nil unless pred_data.is_a?(Hash)

    task_id = pred_data["id"] || pred_data[:id]
    return nil unless task_id

    dep_type = pred_data["type"] || pred_data[:type] || "FS"
    lag = pred_data["lag"] || pred_data[:lag] || 0

    result = "#{task_id}#{dep_type}"
    result += "+#{lag}" if lag.to_i > 0
    result
  end

  public

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

  # Task Viewers (for private task access control)
  has_many :task_viewers, dependent: :destroy
  has_many :viewers, through: :task_viewers, source: :user

  # Task Contacts (email participants, assigned contacts/users)
  # Links both internal Users and external Contacts to tasks
  has_many :task_contacts, dependent: :destroy
  has_many :contacts, through: :task_contacts
  has_many :contact_users, through: :task_contacts, source: :user

  # Action Items (checkable items within a task)
  has_many :action_items, class_name: "TaskActionItem", dependent: :destroy

  # Activity Logs (history of changes)
  has_many :activity_logs, class_name: "TaskActivityLog", dependent: :destroy

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

  # Task Contact helper methods
  # Add a contact or user to the task
  def add_contact(contact_or_user, role:, added_by: nil, is_sender: false, notes: nil)
    attrs = { role: role, added_by: added_by, is_sender: is_sender, notes: notes }

    if contact_or_user.is_a?(User)
      task_contacts.find_or_create_by!(user: contact_or_user, role: role) do |tc|
        tc.assign_attributes(attrs)
      end
    elsif contact_or_user.is_a?(Contact)
      task_contacts.find_or_create_by!(contact: contact_or_user, role: role) do |tc|
        tc.assign_attributes(attrs)
      end
    else
      raise ArgumentError, "Expected User or Contact, got #{contact_or_user.class}"
    end
  end

  # Get the sender (person who created task via email)
  def sender_contact
    task_contacts.senders.first
  end

  # Get all internal users linked to this task
  def internal_contacts
    task_contacts.internal.includes(:user)
  end

  # Get all external contacts linked to this task
  def external_contacts
    task_contacts.external.includes(:contact)
  end

  # Check if a user can view this task (for permission checks)
  def visible_to?(user)
    return true if user&.admin?
    return true unless is_private  # Non-private tasks visible to all
    # Private task - only owner, assigned user, or followers can see
    return true if created_by_id == user&.id
    return true if assigned_user_id == user&.id
    followed_by?(user)
  end

  # Check if user can manage (add action items, toggle privacy) this task
  # Allowed: admin, creator, assigned user, or follower
  def manageable_by?(user)
    return false if user.nil?
    return true if user.admin?
    return true if created_by_id == user.id
    return true if assigned_user_id == user.id
    return true if followed_by?(user)
    false
  end

  # Get the user who last assigned this task to someone
  # Returns nil if no assignment history exists
  def last_assigner
    activity_logs
      .where(activity_type: 'assignment_changed')
      .order(created_at: :desc)
      .first
      &.user
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

  # Show tasks the user can work on based on role assignment rules:
  # 1. Direct assignment (assigned_user_id = user)
  # 2. Job-specific roles: user is in Internal Team for that job+role (via JobContact)
  # 3. Department roles: all users with role see all tasks (not job-specific)
  # 4. Fallback: job-specific role with no one assigned on that job
  #
  # SSoT: User roles come from user_roles join table (user.roles), NOT user.assigned_roles
  # SmTask.assigned_role is an integer (Role.id)
  scope :for_user_roles, ->(user) {
    return none unless user.present?

    # SSoT: Get role IDs directly from user_roles join table
    user_role_ids = user.roles.pluck(:id)
    user_role_names = user.roles.pluck(:name)
    return where(assigned_user_id: user.id) if user_role_ids.empty?

    # Build role name → ID lookup
    role_id_map = user.roles.pluck(:name, :id).to_h

    # 1. Direct assignment
    direct = where(assigned_user_id: user.id)

    # 2. Job-specific roles (user is in Internal Team for that job+role)
    job_assignments = JobContact.where(user_id: user.id, role: JobContact::INTERNAL_ROLES)
    job_conditions = job_assignments.map do |jc|
      role_id = role_id_map[jc.role]
      next nil unless role_id
      where(construction_id: jc.job_id, assigned_role: role_id, assigned_user_id: nil)
    end.compact
    job_specific = job_conditions.any? ? job_conditions.reduce(:or) : none

    # 3. Department roles (all users with role see all tasks globally)
    dept_role_names = user_role_names - JobContact::INTERNAL_ROLES
    dept_role_ids = dept_role_names.map { |name| role_id_map[name] }.compact
    department = dept_role_ids.any? ? where(assigned_role: dept_role_ids, assigned_user_id: nil) : none

    # 4. Fallback for job-specific roles: tasks where role is INTERNAL but
    #    no JobContact exists for that job+role, and user has that role globally
    internal_user_roles = user_role_names & JobContact::INTERNAL_ROLES
    if internal_user_roles.any?
      # Find tasks with internal roles that have no JobContact assignment
      fallback_conditions = internal_user_roles.map do |role_name|
        role_id = role_id_map[role_name]
        next nil unless role_id
        # Jobs where someone IS assigned to this role
        assigned_job_ids = JobContact.where(role: role_name).where.not(user_id: nil).pluck(:job_id)
        # Tasks for this role on jobs where NO ONE is assigned
        where(assigned_role: role_id, assigned_user_id: nil).where.not(construction_id: assigned_job_ids)
      end.compact
      fallback = fallback_conditions.any? ? fallback_conditions.reduce(:or) : none
    else
      fallback = none
    end

    direct.or(job_specific).or(department).or(fallback)
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

  # ============================================
  # Privacy & Visibility Scopes
  # ============================================
  # User can see tasks that are:
  # 1. Not private (is_private = false or nil)
  # 2. Private AND created by them (owner)
  # 3. Private AND they are a follower
  # 4. Assigned to them directly
  scope :visible_to, ->(user) {
    return all if user&.admin?
    return none if user.nil?

    where(is_private: [false, nil])
      .or(where(is_private: true, created_by_id: user.id))
      .or(where(is_private: true, id: TaskFollower.where(user_id: user.id).select(:sm_task_id)))
      .or(where(assigned_user_id: user.id))
  }

  # Callbacks
  before_validation :set_task_number, on: :create
  before_validation :snap_start_date_to_working_day, if: -> { start_date_changed? }
  before_validation :snap_end_date_to_working_day, if: -> { end_date_changed? && !start_date_changed? && !duration_days_changed? }
  before_validation :calculate_end_date, if: -> { start_date_changed? || duration_days_changed? }
  before_save :clear_spawn_tasks_if_not_po

  # Activity logging callbacks
  after_create :log_task_created
  after_update :log_task_changes

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

  # Dependency accessors - now based on predecessor_ids jsonb column
  # Returns array of OpenStruct objects for backwards compatibility with old table-based code
  def active_predecessor_dependencies
    return [] if predecessor_ids.empty? || job_id.nil?

    predecessor_ids.map do |pred_data|
      task_number = pred_data["id"] || pred_data[:id]
      predecessor_task = SmTask.find_by(job_id: job_id, task_number: task_number)
      next unless predecessor_task

      OpenStruct.new(
        # Backwards compat: generate synthetic ID from task IDs
        id: "#{predecessor_task.id}_#{self.id}",
        predecessor_task_id: predecessor_task.id,
        successor_task_id: self.id,
        predecessor_task: predecessor_task,
        successor_task: self,
        dependency_type: pred_data["type"] || pred_data[:type] || "FS",
        lag_days: pred_data["lag"] || pred_data[:lag] || 0,
        active: true
      )
    end.compact
  end

  def active_successor_dependencies
    return [] if job_id.nil?

    # Find all tasks on this job that have this task in their predecessor_ids
    SmTask.where(job_id: job_id)
          .where("predecessor_ids @> ?", [{ id: task_number }].to_json)
          .map do |successor_task|
      # Find this task's entry in successor's predecessor_ids
      pred_data = successor_task.predecessor_ids.find { |p| (p["id"] || p[:id]).to_i == task_number }
      next unless pred_data

      OpenStruct.new(
        # Backwards compat: generate synthetic ID from task IDs
        id: "#{self.id}_#{successor_task.id}",
        predecessor_task_id: self.id,
        successor_task_id: successor_task.id,
        predecessor_task: self,
        successor_task: successor_task,
        dependency_type: pred_data["type"] || pred_data[:type] || "FS",
        lag_days: pred_data["lag"] || pred_data[:lag] || 0,
        active: true
      )
    end.compact
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

  # Snap start_date to the next working day if it falls on a weekend or holiday
  def snap_start_date_to_working_day
    return unless start_date.present?

    calendar = WorkingDaysCalculator.new(CorporateCompanySetting.instance)
    snapped = calendar.next_working_day(start_date)

    if snapped != start_date
      Rails.logger.info "[SmTask] Snapped start_date from #{start_date} to #{snapped} (holiday/weekend)"
      self.start_date = snapped
    end
  end

  # Snap end_date to the next working day if set directly (e.g., resize)
  def snap_end_date_to_working_day
    return unless end_date.present?

    calendar = WorkingDaysCalculator.new(CorporateCompanySetting.instance)
    snapped = calendar.next_working_day(end_date)

    if snapped != end_date
      Rails.logger.info "[SmTask] Snapped end_date from #{end_date} to #{snapped} (holiday/weekend)"
      self.end_date = snapped
      # Recalculate duration based on snapped dates
      self.duration_days = calendar.working_days_between(start_date, snapped)
    end
  end

  def calculate_end_date
    return unless start_date.present? && duration_days.present?
    # For 0-duration tasks (milestones), end_date = start_date
    if duration_days == 0
      self.end_date = start_date
      return
    end
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

  # ============================================
  # Activity Logging Methods
  # ============================================

  def log_task_created
    TaskActivityLog.log_created(self, created_by)
  rescue => e
    Rails.logger.error("[SmTask] Failed to log task creation: #{e.message}")
  end

  def log_task_changes
    # Log assignment changes
    if saved_change_to_assigned_user_id?
      old_id, new_id = saved_change_to_assigned_user_id
      old_user = old_id ? User.find_by(id: old_id) : nil
      new_user = new_id ? User.find_by(id: new_id) : nil
      TaskActivityLog.log_assignment_change(self, updated_by, old_user, new_user)
    end

    # Log status changes
    if saved_change_to_status?
      old_status, new_status = saved_change_to_status
      TaskActivityLog.log_status_change(self, updated_by, old_status, new_status)
    end

    # Log privacy changes
    if saved_change_to_is_private?
      old_private, new_private = saved_change_to_is_private
      TaskActivityLog.log_privacy_change(self, updated_by, old_private, new_private)
    end

    # Log hold changes
    if saved_change_to_hold?
      old_hold, new_hold = saved_change_to_hold
      TaskActivityLog.log_hold_change(self, updated_by, old_hold, new_hold)
    end

    # Log confirm changes
    if saved_change_to_confirm?
      old_confirm, new_confirm = saved_change_to_confirm
      TaskActivityLog.log_confirm_change(self, updated_by, 'confirm', old_confirm, new_confirm)
    end

    # Log supplier confirm changes
    if saved_change_to_supplier_confirm?
      old_confirm, new_confirm = saved_change_to_supplier_confirm
      TaskActivityLog.log_confirm_change(self, updated_by, 'supplier_confirm', old_confirm, new_confirm)
    end
  rescue => e
    Rails.logger.error("[SmTask] Failed to log task changes: #{e.message}")
  end

  # ============================================
  # Email Keywords - Auto-matching for email attachments
  # ============================================

  # Extract keywords from an email subject for auto-matching
  # Called when first email is attached to populate email_keywords
  def self.extract_keywords_from_subject(subject)
    return "" if subject.blank?

    # Common stop words to filter out
    stop_words = %w[
      re fw fwd the a an and or but in on at to for of with from by
      is are was were be been being have has had do does did
      will would could should may might must shall can
      this that these those it its
      hello hi dear thanks thank regards kind best
      please see attached find below
    ]

    # Extract meaningful words (3+ chars, not stop words)
    words = subject
      .gsub(/[^\w\s-]/, ' ')  # Keep hyphens (D-U-N-S)
      .split(/\s+/)
      .map(&:strip)
      .reject(&:blank?)
      .select { |w| w.length >= 3 }
      .reject { |w| stop_words.include?(w.downcase) }
      .reject { |w| w.match?(/^\d+$/) }  # Skip pure numbers
      .uniq

    # Also preserve hyphenated terms as-is (e.g., "D-U-N-S")
    hyphenated = subject.scan(/\b[\w]+-[\w-]+\b/).uniq

    (words + hyphenated).uniq.join(", ")
  end

  # Add keywords from an email subject (merges with existing)
  def add_keywords_from_email(email)
    return unless email.respond_to?(:subject)

    new_keywords = self.class.extract_keywords_from_subject(email.subject)
    return if new_keywords.blank?

    existing = (email_keywords || "").split(",").map(&:strip).reject(&:blank?)
    new_list = new_keywords.split(",").map(&:strip).reject(&:blank?)

    merged = (existing + new_list).uniq.join(", ")
    update_column(:email_keywords, merged) if merged != email_keywords
  end

  # Check if an email matches this task's keywords
  def matches_email_keywords?(email)
    return false if email_keywords.blank?
    return false unless email.respond_to?(:subject)

    keywords = email_keywords.split(",").map(&:strip).map(&:downcase).reject(&:blank?)
    return false if keywords.empty?

    subject_lower = email.subject&.downcase || ""
    body_lower = email.body_text&.downcase || ""

    keywords.any? do |keyword|
      subject_lower.include?(keyword) || body_lower.include?(keyword)
    end
  end

  # Get tasks that match an email's content by keywords
  def self.tasks_matching_email(email, scope: SmTask.all)
    return [] if email.blank?

    subject_lower = email.subject&.downcase || ""
    body_lower = email.body_text&.downcase || ""
    search_text = "#{subject_lower} #{body_lower}"

    scope.where.not(email_keywords: [nil, ""]).select do |task|
      keywords = task.email_keywords.split(",").map(&:strip).map(&:downcase).reject(&:blank?)
      keywords.any? { |kw| search_text.include?(kw) }
    end
  end
end

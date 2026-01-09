class PurchaseOrder < ApplicationRecord
  include Searchable

  # Searchable columns for full-text search (GIN index)
  searchable_columns :purchase_order_number, :description

  # SSoT Aliases - Backwards compatibility
  alias_attribute :po_number, :purchase_order_number
  alias_attribute :notes, :description

  # Metadata helper for templates (returns nil if not available)
  def metadata
    nil
  end

  # Associations
  belongs_to :job, counter_cache: true
  alias_method :construction, :job  # Backwards compatibility
  belongs_to :supplier, class_name: "Contact", optional: true
  alias_method :contact, :supplier  # Alias for backwards compatibility
  belongs_to :estimate, optional: true
  belongs_to :quote_response, optional: true
  has_many :line_items, class_name: "PurchaseOrderLineItem", dependent: :destroy

  # SSoT: PO-Task Link (Option B - Single Column)
  # THE ONE: PurchaseOrder.sm_task_id points to the linked task
  # No reverse column on SmTask - use sm_task.linked_purchase_order for reverse lookup
  belongs_to :sm_task, class_name: "SmTask", optional: true

  # Backwards compatibility: Frontend expects sm_tasks array
  def sm_tasks
    sm_task ? [sm_task] : []
  end

  # SSoT: PO Task name - used by Foundation column display
  def po_task_name
    sm_task&.name
  end

  # Virtual attribute for Foundation - returns the schedule master name via SmTask
  # Path: PO → SmTask → SmScheduleMaster.name
  def sm_schedule_master_name
    sm_task&.sm_schedule_master&.name
  end

  # Virtual attribute for Foundation - returns the schedule master ID via SmTask
  def sm_schedule_master_id_via_task
    sm_task&.sm_schedule_master_id
  end

  # Virtual attributes for Foundation - expose stage/trade via SmTask
  # Path: PO → SmTask.{stage, trade} (or SmScheduleMaster as fallback) → sm_stages/sm_trades.name
  # Used by Expenses tab for hierarchical grouping
  def stage_from_task
    # Try SmTask.stage first, then SmScheduleMaster.stage
    stage_id = sm_task&.stage || sm_task&.sm_schedule_master&.stage
    return nil unless stage_id
    # Look up stage name from sm_stages table
    ActiveRecord::Base.connection.select_value(
      "SELECT name FROM sm_stages WHERE id = #{stage_id.to_i}"
    )
  end

  def trade_from_task
    # Try SmTask.trade first, then SmScheduleMaster.trade
    trade_id = sm_task&.trade || sm_task&.sm_schedule_master&.trade
    return nil unless trade_id
    # Look up trade name from sm_trades table
    ActiveRecord::Base.connection.select_value(
      "SELECT name FROM sm_trades WHERE id = #{trade_id.to_i}"
    )
  end

  has_many :purchase_order_documents, dependent: :destroy
  has_many :document_tasks, through: :purchase_order_documents
  has_many :kudos_events, dependent: :destroy
  has_many :subcontractor_invoices, dependent: :destroy
  has_many :pay_now_requests, dependent: :destroy

  # Site Presence - Labour Cost Tracking
  has_many :labour_cost_entries, dependent: :nullify

  # Finance / Accounts Payable
  has_many :bill_inboxes, foreign_key: :matched_purchase_order_id, dependent: :nullify
  has_many :bill_payments, dependent: :nullify
  belongs_to :last_bill_inbox, class_name: "BillInbox", optional: true

  # Documents attached to this PO (via polymorphic documentable)
  has_many :corporate_company_documents, as: :documentable, dependent: :nullify

  # Nested attributes
  accepts_nested_attributes_for :line_items, allow_destroy: true

  # Validations
  # purchase_order_number is generated from ID after create, so only validate on update
  validates :purchase_order_number, presence: true, uniqueness: true, on: :update
  validates :job_id, presence: true
  validates :status, presence: true, inclusion: {
    in: %w[draft pending approved sent received invoiced paid cancelled]
  }
  validates :payment_status, allow_nil: true, inclusion: {
    in: %w[pending part_payment complete manual_review]
  }

  # Status enum
  enum :status, {
    draft: "draft",
    pending: "pending",
    approved: "approved",
    sent: "sent",
    received: "received",
    invoiced: "invoiced",
    paid: "paid",
    cancelled: "cancelled"
  }

  # Payment status enum (for Xero invoice matching)
  enum :payment_status, {
    pending: "pending",
    part_payment: "part_payment",
    complete: "complete",
    manual_review: "manual_review"
  }, prefix: :payment

  # Callbacks
  before_create :set_temporary_po_number
  after_create :generate_po_number_from_id
  before_save :calculate_totals
  before_save :calculate_variances
  after_create :log_po_created
  after_save :update_job_profit
  after_save :sync_supplier_to_sm_task
  after_destroy :update_job_profit

  # SSoT: Update contact's cached supplier flag when PO changes
  after_commit :refresh_supplier_cached_flag, on: [:create, :destroy]
  after_commit :refresh_supplier_cached_flag_on_supplier_change, on: :update, if: :saved_change_to_supplier_id?

  # Scopes
  scope :by_status, ->(status) { where(status: status) if status.present? }
  scope :by_construction, ->(job_id) { where(job_id: job_id) if job_id.present? }
  scope :recent, -> { order(created_at: :desc) }
  scope :overdue, -> { where("required_date < ? AND status NOT IN (?)", CorporateCompanySetting.today, [ "received", "cancelled" ]) }
  scope :pending_approval, -> { where(status: "pending") }
  scope :for_schedule, -> { where(creates_schedule_tasks: true) }
  scope :visible_to_suppliers, -> { where(visible_to_supplier: true) }
  scope :by_supplier, ->(supplier_id) { where(supplier_id: supplier_id) if supplier_id.present? }

  # Class methods
  def self.find_by_slug(slug)
    # Support finding by:
    # 1. Full PO number (PO-000123)
    # 2. Just the 6-digit number (000123)
    # 3. Numeric ID (fallback for backwards compatibility)

    if slug.match?(/^PO-\d{6}$/)
      # Full format: PO-000123
      find_by(purchase_order_number: slug)
    elsif slug.match?(/^\d{6}$/)
      # Just 6 digits: 000123
      find_by(purchase_order_number: "PO-#{slug}")
    elsif slug.match?(/^\d+$/)
      # Fallback: numeric ID (for backwards compatibility)
      find(slug)
    else
      nil
    end
  end

  # Instance methods
  def to_param
    # Use the 6-digit number as the slug
    purchase_order_number&.sub(/^PO-/, "")
  end

  def calculate_totals
    self.sub_total = line_items.reject(&:marked_for_destruction?).sum { |item|
      (item.quantity || 0) * (item.unit_price || 0)
    }
    # Calculate tax as 10% of subtotal (line item tax_amount may not be calculated yet during nested saves)
    self.tax = (sub_total * 0.10).round(2)
    self.total = sub_total + tax

    # Calculate amount still to be invoiced
    self.amount_still_to_be_invoiced = total - (amount_invoiced || 0)
  end

  def calculate_variances
    # Calculate total with allowance (can be customized based on business logic)
    self.total_with_allowance = total

    # Calculate budget variance
    if budget.present? && budget > 0
      self.diff_po_with_allowance_versus_budget = total_with_allowance - budget
    end

    # Calculate Xero variances
    if xero_amount_paid.present?
      self.xero_still_to_be_paid = total - xero_amount_paid

      if !xero_complete
        self.diff_xero_and_total_but_not_complete = xero_amount_paid - total
      end

      if budget.present? && budget > 0
        self.xero_budget_diff = xero_amount_paid - budget
      end
    end
  end

  def approve!(user_id = nil)
    result = update(
      status: "approved",
      approved_by_id: user_id,
      approved_at: Time.current
    )
    log_activity(:approved) if result
    result
  end

  def send_to_supplier!(document_url: nil)
    result = update(status: "sent", ordered_date: CorporateCompanySetting.today)
    log_activity(:sent, document_url: document_url) if result
    result
  end

  def mark_received!
    result = update(status: "received", received_date: CorporateCompanySetting.today)
    log_activity(:received) if result
    result
  end

  def can_edit?
    %w[draft pending].include?(status)
  end

  def can_approve?
    status == "pending"
  end

  def can_cancel?
    !%w[paid cancelled].include?(status)
  end

  # Calculate payment percentage relative to PO total
  def payment_percentage
    return 0 if total.nil? || total.zero?
    return 0 if invoiced_amount.nil? || invoiced_amount.zero?

    (invoiced_amount / total * 100).round(2)
  end

  # =============================================================================
  # Labour Cost Tracking (Site Presence Integration)
  # =============================================================================

  # Check if this PO is for labour/time tracking
  def labour_po?
    is_labour_po || labour_budget.present?
  end

  # Calculate total labour cost from linked entries
  def calculate_labour_actual
    labour_cost_entries.sum(:total_cost)
  end

  # Update cached labour_actual from entries
  def update_labour_actual!
    update_column(:labour_actual, calculate_labour_actual)
  end

  # Labour budget remaining
  def labour_remaining
    return nil unless labour_budget.present?
    labour_budget - (labour_actual || 0)
  end

  # Labour utilization percentage
  def labour_utilization_percent
    return 0 unless labour_budget.present? && labour_budget.positive?
    ((labour_actual || 0) / labour_budget * 100).round(1)
  end

  # Is labour over budget?
  def labour_over_budget?
    return false unless labour_budget.present?
    (labour_actual || 0) > labour_budget
  end

  # Labour tracking summary for API
  def labour_summary
    return nil unless labour_po?
    {
      budget: labour_budget,
      actual: labour_actual || 0,
      remaining: labour_remaining,
      utilization_percent: labour_utilization_percent,
      over_budget: labour_over_budget?,
      entry_count: labour_cost_entries.count
    }
  end

  # SSoT: Get effective required date (falls back to linked task's start_date)
  # Used for table display to show when materials are needed
  def effective_required_date
    return required_date if required_date.present?

    # Fallback: Use linked task's start_date (SSoT: sm_task_id)
    sm_task&.start_date
  end

  # Check if PO delivery timing aligns with linked task (SSoT: sm_task_id)
  def delivery_aligned_with_task?
    return true unless sm_task
    delivery_before_task_start?(sm_task)
  end

  # Alias for backwards compatibility
  alias_method :delivery_aligned_with_tasks?, :delivery_aligned_with_task?

  # Check if this PO's delivery date is before a specific task's start date
  def delivery_before_task_start?(task)
    return true if required_on_site_date.nil? || task.start_date.nil?
    required_on_site_date <= task.start_date
  end

  # Get timing warnings for linked task (SSoT: sm_task_id)
  def timing_warnings
    warnings = []
    return warnings unless sm_task

    unless delivery_before_task_start?(sm_task)
      days_late = (required_on_site_date - sm_task.start_date).to_i
      warnings << "PO delivery is #{days_late} days after #{sm_task.name} starts"
    end
    warnings
  end

  # Determine payment status based on invoice amount
  # Returns the appropriate payment_status based on invoice amount vs PO total
  def determine_payment_status(invoice_amount)
    return "pending" if invoice_amount.nil? || invoice_amount.zero?
    return "manual_review" if total.nil? || total.zero?

    # Check if invoice exceeds PO total by $1 or more FIRST
    if invoice_amount > total && (invoice_amount - total) >= 1.0
      return "manual_review"
    end

    percentage = (invoice_amount / total * 100).round(2)

    # Within 5% tolerance (95% - 105%)
    if percentage >= 95.0 && percentage <= 105.0
      "complete"
    # Partial payment (less than 95% of total)
    elsif percentage < 95.0
      "part_payment"
    else
      "pending"
    end
  end

  # Apply invoice details to this PO
  # Updates invoiced_amount, invoice_date, invoice_reference, and payment_status
  def apply_invoice!(invoice_amount:, invoice_date:, invoice_reference:)
    new_status = determine_payment_status(invoice_amount)

    update!(
      invoiced_amount: invoice_amount,
      invoice_date: invoice_date,
      invoice_reference: invoice_reference,
      payment_status: new_status
    )

    # Also update xero_invoice_id if invoice_reference looks like Xero ID
    if invoice_reference.present? && invoice_reference.match?(/^[A-Z0-9-]+$/)
      update_column(:xero_invoice_id, invoice_reference)
    end

    new_status
  end

  # Portal-specific methods
  def make_visible_to_supplier!
    update!(visible_to_supplier: true)
  end

  def hide_from_supplier!
    update!(visible_to_supplier: false)
  end

  # Subcontractor job tracking methods
  def mark_arrived!(time = Time.current)
    transaction do
      update!(arrived_at: time)
      # DISABLED: Kudos system temporarily disabled
      # KudosEvent.record_arrival(self, time) if contact&.subcontractor_account
    end
  end

  def mark_completed!(time = Time.current)
    transaction do
      update!(
        completed_at: time,
        status: "received"
      )
      # DISABLED: Kudos system temporarily disabled
      # KudosEvent.record_completion(self, time) if contact&.subcontractor_account
    end
  end

  def from_quote?
    quote_response_id.present?
  end

  def can_create_invoice?
    received? && contact&.accounting_connected?
  end

  def create_subcontractor_invoice!(amount: nil)
    raise "PO not yet received" unless received?
    raise "Invoice already exists" if subcontractor_invoices.any?

    invoice_amount = amount || total
    raise "Invoice amount (#{invoice_amount}) exceeds PO amount (#{total})" if invoice_amount > total

    SubcontractorInvoice.create!(
      purchase_order: self,
      contact: contact,
      accounting_integration: contact.accounting_integration,
      amount: invoice_amount,
      status: "draft"
    )
  end

  def payment_schedule_summary
    return [] unless payment_schedule.is_a?(Array)
    payment_schedule
  end

  def portal_summary
    {
      po_number: purchase_order_number,
      status: status,
      total: total,
      ordered_date: ordered_date,
      required_date: required_date,
      payment_status: payment_status,
      payments_received: bill_payments.sum(:amount),
      payment_schedule: payment_schedule_summary
    }
  end

  # JSON representation for API - includes virtual attributes for Foundation
  # SSoT: sm_task_id is the primary column, po_task_name is derived from linked SmTask
  def as_json(options = {})
    result = super(options).merge(
      'sm_task_name' => po_task_name,
      'sm_schedule_master_name' => sm_schedule_master_name,
      'sm_schedule_master_id_via_task' => sm_schedule_master_id_via_task
    )
    # Include labour summary if this is a labour PO
    result['labour_summary'] = labour_summary if labour_po?
    result
  end

  private

  # Set a temporary PO number to satisfy NOT NULL constraint
  # This will be replaced with the ID-based number in after_create
  def set_temporary_po_number
    return if purchase_order_number.present?

    # Use SecureRandom to create a unique temp value that satisfies NOT NULL
    self.purchase_order_number = "PO-TEMP-#{SecureRandom.hex(4)}"
  end

  # Generate PO number from the database ID (SSoT: id = PO number)
  # This ensures PO-002120 always corresponds to id 2120
  def generate_po_number_from_id
    return unless purchase_order_number&.start_with?("PO-TEMP-")

    # Use update_column to skip callbacks and validations (we're in after_create)
    update_column(:purchase_order_number, "PO-#{id.to_s.rjust(6, '0')}")
  end

  # Update the job's live profit when this PO changes
  def update_job_profit
    job&.calculate_and_update_profit!
  rescue StandardError => e
    Rails.logger.error "[PO] Failed to update job profit for PO #{id}: #{e.message}"
  end

  # Sync supplier changes to linked SmTask (One Entity concept)
  # When a PO's supplier changes, update the linked task to match
  # SSoT: PurchaseOrder.sm_task_id is THE ONE link
  def sync_supplier_to_sm_task
    return unless saved_change_to_supplier_id? && sm_task.present?

    # Update linked task with the new supplier
    # This implements the "One Entity" rule - PO and Task share supplier
    sm_task.update_column(:supplier_id, supplier_id)

    Rails.logger.info "[PO-Task Sync] Updated task #{sm_task.id} with supplier_id=#{supplier_id} for PO #{purchase_order_number}"
  rescue StandardError => e
    Rails.logger.error "[PO-Task Sync] Failed to sync supplier for PO #{id}: #{e.message}"
  end

  # NOTE: sync_sm_task_bidirectional removed as part of SSoT Option B
  # SSoT: PurchaseOrder.sm_task_id is THE ONE link - no reverse column to sync

  # Activity logging
  def log_po_created
    return unless job
    JobActivity.log_po_created(job, purchase_order: self, user: Current.user)
  rescue StandardError => e
    Rails.logger.error "Failed to log PO creation activity: #{e.message}"
  end

  def log_activity(action, document_url: nil)
    return unless job

    case action
    when :approved
      JobActivity.log_po_approved(job, purchase_order: self, user: Current.user)
    when :sent
      JobActivity.log_po_sent(job, purchase_order: self, document_url: document_url, user: Current.user)
    when :received
      JobActivity.log_po_received(job, purchase_order: self, user: Current.user)
    when :cancelled
      JobActivity.log_po_cancelled(job, purchase_order: self, user: Current.user)
    end
  rescue StandardError => e
    Rails.logger.error "Failed to log PO activity (#{action}): #{e.message}"
  end

  # SSoT: Refresh contact's is_supplier_cached flag
  def refresh_supplier_cached_flag
    return unless supplier_id.present?
    supplier&.refresh_supplier_flag!
  rescue StandardError => e
    Rails.logger.error("PurchaseOrder##{id}: Failed to refresh supplier flag - #{e.message}")
  end

  # SSoT: Handle supplier_id change - refresh both old and new supplier
  def refresh_supplier_cached_flag_on_supplier_change
    old_supplier_id, new_supplier_id = saved_change_to_supplier_id

    # Refresh old supplier (may no longer be a supplier)
    if old_supplier_id.present?
      Contact.find_by(id: old_supplier_id)&.refresh_supplier_flag!
    end

    # Refresh new supplier
    if new_supplier_id.present?
      Contact.find_by(id: new_supplier_id)&.refresh_supplier_flag!
    end
  rescue StandardError => e
    Rails.logger.error("PurchaseOrder##{id}: Failed to refresh supplier flag on change - #{e.message}")
  end
end

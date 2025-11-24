class PurchaseOrder < ApplicationRecord
  # Associations
  belongs_to :construction, counter_cache: true
  belongs_to :supplier, optional: true, counter_cache: true
  belongs_to :contact, foreign_key: :supplier_id, optional: true
  belongs_to :estimate, optional: true
  belongs_to :quote_response, optional: true
  has_many :line_items, class_name: 'PurchaseOrderLineItem', dependent: :destroy
  has_many :payments, dependent: :destroy
  has_many :project_tasks, dependent: :nullify
  has_many :schedule_tasks, dependent: :nullify
  has_many :workflow_instances, as: :subject, dependent: :destroy
  has_many :purchase_order_documents, dependent: :destroy
  has_many :document_tasks, through: :purchase_order_documents
  has_many :kudos_events, dependent: :destroy
  has_many :subcontractor_invoices, dependent: :destroy
  has_many :pay_now_requests, dependent: :destroy

  # Nested attributes
  accepts_nested_attributes_for :line_items, allow_destroy: true

  # Validations
  validates :purchase_order_number, presence: true, uniqueness: true
  validates :construction_id, presence: true
  validates :status, presence: true, inclusion: {
    in: %w[draft pending approved sent received invoiced paid cancelled]
  }
  validates :payment_status, allow_nil: true, inclusion: {
    in: %w[pending part_payment complete manual_review]
  }

  # Status enum
  enum :status, {
    draft: 'draft',
    pending: 'pending',
    approved: 'approved',
    sent: 'sent',
    received: 'received',
    invoiced: 'invoiced',
    paid: 'paid',
    cancelled: 'cancelled'
  }

  # Payment status enum (for Xero invoice matching)
  enum :payment_status, {
    pending: 'pending',
    part_payment: 'part_payment',
    complete: 'complete',
    manual_review: 'manual_review'
  }, prefix: :payment

  # Callbacks
  before_validation :generate_po_number, if: :new_record?
  before_save :calculate_totals
  before_save :calculate_variances
  after_save :update_construction_profit
  after_destroy :update_construction_profit

  # Scopes
  scope :by_status, ->(status) { where(status: status) if status.present? }
  scope :by_construction, ->(construction_id) { where(construction_id: construction_id) if construction_id.present? }
  scope :recent, -> { order(created_at: :desc) }
  scope :overdue, -> { where('required_date < ? AND status NOT IN (?)', CompanySetting.today, ['received', 'cancelled']) }
  scope :pending_approval, -> { where(status: 'pending') }
  scope :for_schedule, -> { where(creates_schedule_tasks: true) }
  scope :visible_to_suppliers, -> { where(visible_to_supplier: true) }
  scope :by_supplier, ->(supplier_id) { where(supplier_id: supplier_id) if supplier_id.present? }

  # Instance methods
  def calculate_totals
    self.sub_total = line_items.sum { |item| item.quantity * item.unit_price }
    self.tax = line_items.sum(&:tax_amount)
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
    update(
      status: 'approved',
      approved_by_id: user_id,
      approved_at: Time.current
    )
  end

  def send_to_supplier!
    update(status: 'sent', ordered_date: CompanySetting.today)
  end

  def mark_received!
    update(status: 'received', received_date: CompanySetting.today)
  end

  def can_edit?
    %w[draft pending].include?(status)
  end

  def can_approve?
    status == 'pending'
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

  # Check if PO delivery timing aligns with linked tasks
  def delivery_aligned_with_tasks?
    return true if project_tasks.empty?
    project_tasks.all? { |task| delivery_before_task_start?(task) }
  end

  # Check if this PO's delivery date is before a specific task's start date
  def delivery_before_task_start?(task)
    return true if required_on_site_date.nil? || task.planned_start_date.nil?
    required_on_site_date <= task.planned_start_date
  end

  # Get timing warnings for all linked tasks
  def timing_warnings
    warnings = []
    project_tasks.each do |task|
      unless delivery_before_task_start?(task)
        days_late = (required_on_site_date - task.planned_start_date).to_i
        warnings << "PO delivery is #{days_late} days after #{task.name} starts"
      end
    end
    warnings
  end

  # Workflow helper methods
  def active_workflow
    workflow_instances.find_by(status: ['pending', 'in_progress'])
  end

  def has_active_workflow?
    active_workflow.present?
  end

  def workflow_status
    active_workflow&.status || 'none'
  end

  def current_workflow_step
    active_workflow&.workflow_steps&.find_by(status: ['pending', 'in_progress'])
  end

  # Determine payment status based on invoice amount
  # Returns the appropriate payment_status based on invoice amount vs PO total
  def determine_payment_status(invoice_amount)
    return 'pending' if invoice_amount.nil? || invoice_amount.zero?
    return 'manual_review' if total.nil? || total.zero?

    # Check if invoice exceeds PO total by $1 or more FIRST
    if invoice_amount > total && (invoice_amount - total) >= 1.0
      return 'manual_review'
    end

    percentage = (invoice_amount / total * 100).round(2)

    # Within 5% tolerance (95% - 105%)
    if percentage >= 95.0 && percentage <= 105.0
      'complete'
    # Partial payment (less than 95% of total)
    elsif percentage < 95.0
      'part_payment'
    else
      'pending'
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
      KudosEvent.record_arrival(self, time) if contact&.subcontractor_account
    end
  end

  def mark_completed!(time = Time.current)
    transaction do
      update!(
        completed_at: time,
        status: 'received'
      )
      KudosEvent.record_completion(self, time) if contact&.subcontractor_account
    end
  end

  def from_quote?
    quote_response_id.present?
  end

  def can_create_invoice?
    received? && contact&.accounting_connected?
  end

  def create_subcontractor_invoice!(amount: nil)
    raise 'PO not yet received' unless received?
    raise 'Invoice already exists' if subcontractor_invoices.any?

    invoice_amount = amount || total
    raise "Invoice amount (#{invoice_amount}) exceeds PO amount (#{total})" if invoice_amount > total

    SubcontractorInvoice.create!(
      purchase_order: self,
      contact: contact,
      accounting_integration: contact.accounting_integration,
      amount: invoice_amount,
      status: 'draft'
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
      payments_received: payments.sum(:amount),
      payment_schedule: payment_schedule_summary
    }
  end

  private

  def generate_po_number
    return if purchase_order_number.present?

    # Use an advisory lock to prevent race conditions
    # The lock ensures only one transaction can generate a PO number at a time
    PurchaseOrder.transaction do
      # Acquire exclusive lock (lock ID: arbitrary large number for PO generation)
      PurchaseOrder.connection.execute("SELECT pg_advisory_xact_lock(123456789)")

      # Find the highest PO number within the locked transaction
      max_number = PurchaseOrder.where("purchase_order_number LIKE 'PO-%'")
                                 .pluck(:purchase_order_number)
                                 .map { |num| num.match(/PO-(\d+)/)&.captures&.first&.to_i }
                                 .compact
                                 .max || 0

      next_number = max_number + 1
      self.purchase_order_number = "PO-#{next_number.to_s.rjust(6, '0')}"

      # Lock is automatically released at end of transaction
    end
  end

  # Update the construction's live profit when this PO changes
  def update_construction_profit
    construction&.calculate_and_update_profit!
  end
end

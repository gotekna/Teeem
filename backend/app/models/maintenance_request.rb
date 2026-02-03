class MaintenanceRequest < ApplicationRecord
  # Associations
  belongs_to :job
  belongs_to :supplier_contact, class_name: "Contact", optional: true
  belongs_to :reported_by_user, class_name: "User", optional: true
  belongs_to :purchase_order, optional: true

  # Constants
  STATUSES = %w[open in_progress resolved closed].freeze
  PRIORITIES = %w[low medium high urgent].freeze
  CATEGORIES = %w[
    plumbing electrical structural hvac flooring
    painting roofing windows doors landscaping other
  ].freeze

  # Validations
  validates :request_number, presence: true, uniqueness: true
  validates :title, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :priority, inclusion: { in: PRIORITIES }, allow_nil: true
  validates :category, inclusion: { in: CATEGORIES }, allow_nil: true
  validates :reported_date, presence: true

  # Callbacks
  before_validation :generate_request_number, on: :create
  before_validation :set_reported_date, on: :create

  # Scopes
  scope :open, -> { where(status: "open") }
  scope :in_progress, -> { where(status: "in_progress") }
  scope :resolved, -> { where(status: "resolved") }
  scope :closed, -> { where(status: "closed") }
  scope :active, -> { where(status: %w[open in_progress]) }
  scope :completed, -> { where(status: %w[resolved closed]) }
  scope :assigned_to_supplier, ->(supplier_id) { where(supplier_contact_id: supplier_id) }
  scope :by_construction, ->(construction_id) { where(job_id: construction_id) }
  scope :by_priority, ->(priority) { where(priority: priority) }
  scope :warranty_claims, -> { where(warranty_claim: true) }
  scope :overdue, -> { where("due_date < ? AND status NOT IN (?)", TenantSetting.today, %w[resolved closed]) }
  scope :recent, -> { order(created_at: :desc) }

  # Instance methods
  def open?
    status == "open"
  end

  def in_progress?
    status == "in_progress"
  end

  def resolved?
    status == "resolved"
  end

  def closed?
    status == "closed"
  end

  def overdue?
    due_date.present? && due_date < TenantSetting.today && !completed?
  end

  def completed?
    resolved? || closed?
  end

  def mark_in_progress!(notes: nil)
    update!(
      status: "in_progress",
      resolution_notes: notes
    )
  end

  def mark_resolved!(notes: nil, actual_cost: nil)
    update!(
      status: "resolved",
      resolved_date: TenantSetting.today,
      resolution_notes: notes || resolution_notes,
      actual_cost: actual_cost || self.actual_cost
    )
  end

  def mark_closed!(notes: nil)
    update!(
      status: "closed",
      resolution_notes: notes || resolution_notes
    )
  end

  def reopen!(notes: nil)
    update!(
      status: "open",
      resolved_date: nil,
      resolution_notes: [ resolution_notes, notes ].compact.join("\n\n---\n\n")
    )
  end

  def days_open
    if completed? && resolved_date
      (resolved_date - reported_date).to_i
    else
      (TenantSetting.today - reported_date).to_i
    end
  end

  def status_badge
    case status
    when "open" then { text: "Open", color: "red" }
    when "in_progress" then { text: "In Progress", color: "yellow" }
    when "resolved" then { text: "Resolved", color: "green" }
    when "closed" then { text: "Closed", color: "gray" }
    end
  end

  def priority_badge
    case priority
    when "urgent" then { text: "Urgent", color: "red" }
    when "high" then { text: "High", color: "orange" }
    when "medium" then { text: "Medium", color: "yellow" }
    when "low" then { text: "Low", color: "green" }
    else { text: "None", color: "gray" }
    end
  end

  def cost_summary
    {
      estimated: estimated_cost,
      actual: actual_cost,
      variance: actual_cost && estimated_cost ? (actual_cost - estimated_cost) : nil
    }
  end

  private

  def generate_request_number
    return if request_number.present?

    date_str = TenantSetting.today.strftime("%Y%m%d")
    last_request = MaintenanceRequest.where("request_number LIKE ?", "MR-#{date_str}-%").order(:request_number).last

    if last_request
      last_sequence = last_request.request_number.split("-").last.to_i
      sequence = (last_sequence + 1).to_s.rjust(3, "0")
    else
      sequence = "001"
    end

    self.request_number = "MR-#{date_str}-#{sequence}"
  end

  def set_reported_date
    self.reported_date ||= TenantSetting.today
  end
end

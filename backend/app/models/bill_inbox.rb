# frozen_string_literal: true

class BillInbox < ApplicationRecord
  # Associations
  belongs_to :corporate_company, optional: true
  belongs_to :detected_company, class_name: "CorporateCompany", optional: true
  belongs_to :supplier, class_name: "Contact", optional: true
  belongs_to :matched_purchase_order, class_name: "PurchaseOrder", optional: true
  belongs_to :approved_by, class_name: "User", optional: true
  belongs_to :external_invoice, optional: true
  belongs_to :email_warehouse, class_name: "EmailWarehouse", optional: true
  belongs_to :bpmn_process_instance, class_name: "BpmnProcessInstance", optional: true

  has_many :bill_payments, dependent: :destroy
  has_one_attached :invoice_file
  has_many_attached :supporting_documents

  # Validations
  validates :source, presence: true
  validates :status, presence: true
  validates :total_amount, numericality: { greater_than: 0 }, allow_nil: true

  # Status constants
  STATUSES = %w[pending extracting extracted matching matched approval_pending
                approved rejected processing paid cancelled error].freeze
  MATCH_STATUSES = %w[unmatched matched variance no_po_required].freeze
  SOURCES = %w[email upload api].freeze

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :awaiting_extraction, -> { where(status: %w[pending extracting]) }
  scope :awaiting_match, -> { where(status: "extracted", match_status: "unmatched") }
  scope :awaiting_approval, -> { where(status: "approval_pending") }
  scope :ready_for_payment, -> { where(status: "approved") }
  scope :for_company, ->(company_id) { where(corporate_company_id: company_id) }
  scope :with_variance, -> { where(match_status: "variance") }
  scope :recent, -> { order(created_at: :desc) }
  scope :by_status, ->(status) { where(status: status) if status.present? }

  # Callbacks
  before_validation :set_defaults, on: :create

  # Instance methods
  def extract_invoice_data!
    update!(status: "extracting")
    result = InvoiceParsingService.new(self).extract!
    update!(
      status: "extracted",
      ai_extraction_result: result,
      extracted_at: Time.current
    )
    result
  end

  def match_to_po!
    BillMatchingService.new(self).match!
  end

  def start_approval_workflow!
    BillApprovalWorkflowService.new(self).start!
  end

  def approve!(user)
    update!(
      status: "approved",
      approved_by: user,
      approved_at: Time.current
    )
  end

  def reject!(user, reason)
    update!(
      status: "rejected",
      approved_by: user,
      rejection_reason: reason
    )
  end

  def payable?
    status == "approved" && total_amount.present? && total_amount > 0
  end

  def remaining_balance
    total_amount.to_d - bill_payments.where(status: "paid").sum(:amount)
  end

  def fully_paid?
    remaining_balance <= 0
  end

  def sender_domain
    return nil unless email_warehouse.present?

    from_email = email_warehouse.from_email
    return nil unless from_email.present?

    from_email.split("@").last&.downcase
  end

  def internal_sender?
    sender_domain == "tekna.com.au"
  end

  def variance_percent
    return nil unless matched_purchase_order && variance_amount
    return nil if matched_purchase_order.total.to_d.zero?

    (variance_amount / matched_purchase_order.total * 100).round(2)
  end

  def status_display
    status.humanize.titleize
  end

  def status_color
    case status
    when "pending", "extracting" then "gray"
    when "extracted", "matching" then "blue"
    when "matched", "approval_pending" then "yellow"
    when "approved" then "green"
    when "rejected", "error", "cancelled" then "red"
    when "processing", "paid" then "indigo"
    else "gray"
    end
  end

  def has_invoice_file?
    invoice_file.attached?
  end

  def invoice_file_content_type
    invoice_file.attached? ? invoice_file.content_type : nil
  end

  def invoice_file_filename
    invoice_file.attached? ? invoice_file.filename.to_s : nil
  end

  private

  def set_defaults
    self.source ||= "email"
    self.status ||= "pending"
    self.match_status ||= "unmatched"
    self.currency ||= "AUD"
  end
end

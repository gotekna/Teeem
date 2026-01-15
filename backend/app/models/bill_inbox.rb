# frozen_string_literal: true

class BillInbox < ApplicationRecord
  include StorageUploadable

  # Associations
  belongs_to :corporate_company, optional: true
  belongs_to :detected_company, class_name: "CorporateCompany", optional: true
  belongs_to :supplier, class_name: "Contact", optional: true
  belongs_to :matched_purchase_order, class_name: "PurchaseOrder", optional: true
  belongs_to :approved_by, class_name: "User", optional: true
  belongs_to :external_invoice, optional: true
  belongs_to :email_warehouse, class_name: "EmailWarehouse", optional: true
  belongs_to :bpmn_process_instance, class_name: "BpmnProcessInstance", optional: true

  # SSoT: Link to deduplicated file storage (Jan 2026)
  belongs_to :storage_blob, optional: true

  has_many :bill_payments, dependent: :destroy

  # ActiveStorage has_one_attached :invoice_file was REMOVED (Jan 2026) - SSoT is storage_blob
  # ActiveStorage has_many_attached :supporting_documents was REMOVED - use separate association
  # Files stored via StorageBlob with deduplication via content_hash

  # Allowed content types (used by upload validation in services)
  ALLOWED_INVOICE_TYPES = %w[application/pdf image/jpeg image/png image/tiff].freeze
  ALLOWED_SUPPORTING_TYPES = %w[
    application/pdf image/jpeg image/png image/tiff
    application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    application/vnd.ms-excel text/csv
  ].freeze

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
  after_commit :upload_to_storage, on: [:create, :update], if: :should_upload_to_storage?

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
    # SSoT: Use CorporateCompanySetting for internal domains
    CorporateCompanySetting.internal_email_domains.include?(sender_domain)
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
    storage_reference.present?
  end

  # Provider-agnostic storage reference (SSoT: storage_item_id)
  # Falls back to sharepoint_file_id for backwards compatibility
  def storage_reference
    storage_item_id.presence || sharepoint_file_id
  end

  def set_storage_reference(item_id, provider: "sharepoint")
    self.storage_item_id = item_id
  end

  def invoice_file_content_type
    # Return stored mime type or detect from filename
    return nil unless has_invoice_file?
    case invoice_file_filename&.downcase
    when /\.pdf$/ then "application/pdf"
    when /\.png$/ then "image/png"
    when /\.jpe?g$/ then "image/jpeg"
    else "application/octet-stream"
    end
  end

  def invoice_file_filename
    # SSoT: Use original_filename column or storage_blob
    return original_filename if original_filename.present?
    storage_blob&.original_filename
  end

  # Download invoice file from storage (SSoT)
  def download_invoice_file
    file_ref = storage_path.presence || sharepoint_file_id
    return nil unless file_ref.present?

    result = download_from_storage(file_ref)
    result[:success] ? result[:content] : nil
  rescue StandardError => e
    Rails.logger.error("[BillInbox] Storage download failed for #{id}: #{e.message}")
    nil
  end

  private

  def set_defaults
    self.source ||= "email"
    self.status ||= "pending"
    self.match_status ||= "unmatched"
    self.currency ||= "AUD"
  end

  def should_upload_to_storage?
    # Upload only happens when storage_blob is assigned but not yet uploaded
    storage_blob.present? && storage_blob.storage_path.blank?
  end

  def upload_to_storage
    BillInboxStorageUploadJob.perform_later(id)
  end
end

class ExternalInvoice < ApplicationRecord
  include ExternalSyncConstants

  belongs_to :contact, optional: true
  belongs_to :job, optional: true
  # LIM (Jan 2026): xero_contact association removed - ContactExternalLink is THE ONE SSoT
  # XeroContact table had 0 records, ContactExternalLink has 1,018 records

  # Documents attached to this invoice (PDF attachments from Xero, etc.)
  has_many :corporate_company_documents, as: :documentable, dependent: :nullify

  # SSoT: Callbacks to maintain PDF eligibility when invoice state changes
  # PDFs are only "eligible" when invoice has a contact AND is not draft
  after_save :update_pdf_eligibility_on_state_change

  # SSoT: Update contact's cached supplier flag when bill changes
  # Only bills (ACCPAY) affect is_supplier_cached
  after_commit :refresh_supplier_cached_flag, on: [:create, :destroy], if: :bill?
  after_commit :refresh_supplier_cached_flag_on_contact_change, on: :update, if: :should_refresh_supplier_flag?

  # SSoT: ACCOUNTING_SYSTEMS, RECORD_SYNC_DIRECTIONS defined in ExternalSyncConstants concern

  # Normalized invoice types (across all systems)
  # - sales_invoice: Customer-facing invoice (Xero ACCREC)
  # - bill: Supplier bill/purchase invoice (Xero ACCPAY)
  # - credit_note: Credit note (Xero ACCRECREDIT or ACCPAYCREDIT)
  # - quote: Quote/Estimate (Xero Quote)
  INVOICE_TYPES = %w[sales_invoice bill credit_note quote].freeze

  # Normalized statuses (across all systems)
  # Note: quotes have their own status set: draft, sent, accepted, declined, invoiced
  STATUSES = %w[draft submitted approved paid voided deleted sent accepted declined invoiced].freeze

  validates :source, presence: true, inclusion: { in: ACCOUNTING_SYSTEMS }
  validates :invoice_type, presence: true, inclusion: { in: INVOICE_TYPES }
  validates :sync_direction, inclusion: { in: RECORD_SYNC_DIRECTIONS }

  # SSoT: source scopes (xero, myob, quickbooks, for_source) defined in ExternalSyncConstants

  # Scopes by type
  scope :sales_invoices, -> { where(invoice_type: "sales_invoice") }
  scope :bills, -> { where(invoice_type: "bill") }
  scope :credit_notes, -> { where(invoice_type: "credit_note") }
  scope :quotes, -> { where(invoice_type: "quote") }
  scope :invoices_and_bills, -> { where(invoice_type: %w[sales_invoice bill]) }

  # Scopes by status
  scope :draft, -> { where(status: "draft") }
  scope :approved, -> { where(status: "approved") }
  scope :paid, -> { where(status: "paid") }
  scope :unpaid, -> { where.not(status: "paid") }
  scope :active, -> { where.not(status: %w[voided deleted]) }

  # Sync scopes
  scope :enabled, -> { where(sync_enabled: true) }
  scope :pending_push, -> { where(pending_push: true) }
  scope :created_in_teeem, -> { where(created_in_teeem: true) }
  scope :with_errors, -> { where.not(sync_error: nil) }
  scope :for_tenant, ->(tenant_id) { where(tenant_id: tenant_id) }

  # Find by tracking option name (for job linking)
  scope :with_tracking, ->(tracking_name) {
    where("tracking_data @> ?", [ { "Option" => tracking_name } ].to_json)
  }

  # Status mappings from Xero to normalized
  XERO_STATUS_MAP = {
    "DRAFT" => "draft",
    "SUBMITTED" => "submitted",
    "AUTHORISED" => "approved",
    "PAID" => "paid",
    "VOIDED" => "voided",
    "DELETED" => "deleted"
  }.freeze

  # Type mappings from Xero to normalized
  XERO_TYPE_MAP = {
    "ACCREC" => "sales_invoice",       # Accounts Receivable = Sales Invoice
    "ACCPAY" => "bill",                # Accounts Payable = Bill/Purchase
    "ACCRECREDIT" => "credit_note",    # Sales Credit Note
    "ACCPAYCREDIT" => "credit_note",   # Supplier Credit Note
    "QUOTE" => "quote"                 # Quote/Estimate
  }.freeze

  # Credit note type mappings (sales vs supplier)
  XERO_CREDIT_NOTE_TYPES = {
    "ACCRECREDIT" => "sales_credit",    # Credit given to customer
    "ACCPAYCREDIT" => "supplier_credit" # Credit from supplier
  }.freeze

  # Reverse mappings for export
  NORMALIZED_TO_XERO_STATUS = XERO_STATUS_MAP.invert.freeze
  NORMALIZED_TO_XERO_TYPE = XERO_TYPE_MAP.invert.freeze

  # Quote status mappings from Xero
  XERO_QUOTE_STATUS_MAP = {
    "DRAFT" => "draft",
    "SENT" => "sent",
    "ACCEPTED" => "accepted",
    "DECLINED" => "declined",
    "INVOICED" => "invoiced",
    "DELETED" => "deleted"
  }.freeze

  # Class method to normalize Xero status
  def self.normalize_xero_status(xero_status)
    XERO_STATUS_MAP[xero_status] || "draft"
  end

  # Class method to normalize Xero type
  def self.normalize_xero_type(xero_type)
    XERO_TYPE_MAP[xero_type] || "sales_invoice"
  end

  # Convert back to Xero status for export
  def xero_status
    NORMALIZED_TO_XERO_STATUS[status] || "DRAFT"
  end

  # Convert back to Xero type for export
  def xero_type
    NORMALIZED_TO_XERO_TYPE[invoice_type] || "ACCREC"
  end

  # Is this a sales invoice?
  def sales_invoice?
    invoice_type == "sales_invoice"
  end

  # Is this a bill?
  def bill?
    invoice_type == "bill"
  end

  # Is this a credit note?
  def credit_note?
    invoice_type == "credit_note"
  end

  # Is this a quote?
  def quote?
    invoice_type == "quote"
  end

  # Is this an invoice or bill (not credit note or quote)?
  def invoice_or_bill?
    sales_invoice? || bill?
  end

  # Has this been synced to external system?
  def synced?
    external_id.present?
  end

  # Needs to be pushed to external system?
  def needs_push?
    pending_push? && can_export?
  end

  # Mark as needing push
  def mark_for_push!
    update!(pending_push: true, teeem_updated_at: Time.current)
  end

  # Mark as synced
  def mark_synced!(external_modified_at = nil)
    update!(
      last_synced_at: Time.current,
      external_updated_at: external_modified_at,
      pending_push: false,
      sync_error: nil
    )
  end

  # Record sync error
  def record_error!(message)
    update!(sync_error: message)
  end

  # Clear sync error
  def clear_error!
    update!(sync_error: nil)
  end

  # Check if this invoice has sync conflicts
  def has_conflicts?
    conflict_fields.present? && conflict_fields.any?
  end

  # Add a conflict field
  def add_conflict(field_name, teeem_value, external_value)
    conflicts = conflict_fields || {}
    conflicts[field_name] = {
      "teeem_value" => teeem_value,
      "external_value" => external_value,
      "detected_at" => Time.current.iso8601
    }
    update!(conflict_fields: conflicts)
  end

  # Resolve a conflict
  def resolve_conflict(field_name)
    conflicts = conflict_fields || {}
    conflicts.delete(field_name)
    update!(conflict_fields: conflicts)
  end

  # Can import from external system?
  def can_import?
    sync_enabled? && (sync_direction == "import_only" || sync_direction == "bidirectional")
  end

  # Can export to external system?
  def can_export?
    sync_enabled? && (sync_direction == "export_only" || sync_direction == "bidirectional")
  end

  # Extract tracking option names from tracking_data
  def tracking_option_names
    return [] unless tracking_data.present?
    tracking_data.map { |t| t["Option"] }.compact.uniq
  end

  # Link to job based on tracking category
  def link_to_job!
    return if job_id.present?

    tracking_option_names.each do |name|
      job = Job.find_by(xero_tracking_option_name: name)
      if job
        update!(job: job)
        break
      end
    end
  end

  # Link to contact based on external_contact_id
  def link_to_contact!
    return if contact_id.present?
    return unless external_contact_id.present?

    link = ContactExternalLink.find_by(
      source: source,
      tenant_id: tenant_id,
      external_contact_id: external_contact_id
    )

    update!(contact: link.contact) if link&.contact
  end

  # Helper to get supplier contact (for bills)
  def supplier
    bill? ? contact : nil
  end

  # Helper to get customer contact (for sales invoices)
  def customer
    sales_invoice? ? contact : nil
  end

  # Formatted display name
  def display_name
    case invoice_type
    when "bill"
      "Bill #{invoice_number} from #{contact_name}"
    when "sales_invoice"
      "Invoice #{invoice_number} to #{contact_name}"
    when "credit_note"
      "Credit Note #{invoice_number} - #{contact_name}"
    when "quote"
      "Quote #{invoice_number} - #{contact_name}"
    else
      "#{invoice_type.titleize} #{invoice_number}"
    end
  end

  # Is this invoice eligible for PDF sync?
  # SSoT: Invoice must have a contact AND not be draft
  def pdf_eligible?
    contact_id.present? && status != "draft"
  end

  private

  # SSoT: Update PDF eligibility when invoice state changes
  # Called after_save to keep CorporateCompanyDocument.is_pdf_eligible in sync
  def update_pdf_eligibility_on_state_change
    # Only process if contact_id or status changed
    return unless saved_change_to_contact_id? || saved_change_to_status?

    # Determine if we're becoming eligible or ineligible
    was_eligible = contact_id_before_last_save.present? && status_before_last_save != "draft"
    now_eligible = pdf_eligible?

    # No change in eligibility
    return if was_eligible == now_eligible

    if now_eligible
      # Became eligible - restore PDFs
      corporate_company_documents.where(source: "xero").update_all(
        is_pdf_eligible: true,
        orphaned_at: nil,
        orphan_reason: nil
      )
      Rails.logger.info("[PDF_ELIGIBILITY] Invoice #{id} became eligible, restored #{corporate_company_documents.where(source: 'xero').count} PDFs")
    else
      # Became ineligible - orphan PDFs
      reason = if !contact_id.present? && contact_id_before_last_save.present?
        "contact_removed"
      elsif status == "draft" && status_before_last_save != "draft"
        "became_draft"
      else
        "eligibility_lost"
      end

      corporate_company_documents.where(source: "xero").update_all(
        is_pdf_eligible: false,
        orphaned_at: Time.current,
        orphan_reason: reason
      )
      Rails.logger.info("[PDF_ELIGIBILITY] Invoice #{id} became ineligible (#{reason}), orphaned #{corporate_company_documents.where(source: 'xero').count} PDFs")
    end
  end

  # SSoT: Check if supplier flag should be refreshed on update
  def should_refresh_supplier_flag?
    bill? && saved_change_to_contact_id?
  end

  # SSoT: Refresh contact's is_supplier_cached flag
  def refresh_supplier_cached_flag
    return unless contact_id.present?
    contact&.refresh_supplier_flag!
  rescue StandardError => e
    Rails.logger.error("ExternalInvoice##{id}: Failed to refresh supplier flag - #{e.message}")
  end

  # SSoT: Handle contact_id change - refresh both old and new contact
  def refresh_supplier_cached_flag_on_contact_change
    old_contact_id, new_contact_id = saved_change_to_contact_id

    # Refresh old contact (may no longer be a supplier)
    if old_contact_id.present?
      Contact.find_by(id: old_contact_id)&.refresh_supplier_flag!
    end

    # Refresh new contact
    if new_contact_id.present?
      Contact.find_by(id: new_contact_id)&.refresh_supplier_flag!
    end
  rescue StandardError => e
    Rails.logger.error("ExternalInvoice##{id}: Failed to refresh supplier flag on change - #{e.message}")
  end
end

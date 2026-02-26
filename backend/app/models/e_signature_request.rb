# frozen_string_literal: true

# ESignatureRequest represents an e-signature envelope containing a document
# that needs to be signed by one or more people.
#
# Compliance Standards:
# - eIDAS (EU) - Electronic Identification and Trust Services
# - ESIGN Act (US) - Electronic Signatures in Global and National Commerce
# - Australian Electronic Transactions Act
#
class ESignatureRequest < ApplicationRecord
  # Constants
  STATUSES = %w[draft sent in_progress completed declined expired cancelled].freeze
  SIGNING_ORDERS = { parallel: 0, sequential: 1 }.freeze

  # Associations
  belongs_to :documentable, polymorphic: true, optional: true
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :document_type, optional: true

  has_many :signers, class_name: "ESignatureSigner", dependent: :destroy
  has_many :events, class_name: "ESignatureEvent", dependent: :destroy
  has_many :fields, class_name: "ESignatureField", dependent: :destroy
  has_one :certificate, class_name: "ESignatureCertificate", dependent: :destroy

  # Nested attributes
  accepts_nested_attributes_for :signers, allow_destroy: true
  accepts_nested_attributes_for :fields, allow_destroy: true

  # Validations
  validates :title, presence: true
  validates :request_number, presence: true, uniqueness: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  # Callbacks
  before_validation :generate_request_number, on: :create
  after_create :log_created_event

  # Scopes
  scope :by_status, ->(status) { where(status: status) }
  scope :pending_signatures, -> { where(status: %w[sent in_progress]) }
  scope :expired, -> { where("status IN (?) AND expires_at < ?", %w[sent in_progress], Time.current) }
  scope :awaiting_reminders, -> {
    where(send_reminders: true)
      .where(status: %w[sent in_progress])
      .where("last_reminder_sent_at IS NULL OR last_reminder_sent_at < ?", 3.days.ago)
  }

  # State machine methods
  def can_send?
    status == "draft" && signers.any?
  end

  def can_cancel?
    status.in?(%w[draft sent in_progress])
  end

  def send_for_signing!(ip_address: nil, user_agent: nil)
    return false unless can_send?

    transaction do
      update!(
        status: "sent",
        sent_at: Time.current,
        expires_at: 30.days.from_now
      )

      if sequential_signing?
        # Only notify the first signer - subsequent signers get notified
        # after the previous signer completes (see ESignatureSigner#sign!)
        first_signer = signers.order(:signing_order).first
        first_signer&.send_notification!
      else
        signers.each(&:send_notification!)
      end

      log_event("sent",
        description: "Request sent for signing",
        ip_address: ip_address,
        user_agent: user_agent
      )
    end

    true
  end

  def mark_in_progress!
    return if status == "in_progress"
    return unless status == "sent"

    update!(status: "in_progress")
    log_event("in_progress", description: "First signer has viewed the document")
  end

  def check_completion!
    return unless status.in?(%w[sent in_progress])

    if signers.all?(&:signed?)
      complete!
    elsif signers.any?(&:declined?)
      decline!(signers.find(&:declined?))
    end
  end

  def complete!
    return unless status.in?(%w[sent in_progress])

    transaction do
      update!(
        status: "completed",
        completed_at: Time.current,
        signed_document_hash: calculate_current_document_hash
      )

      generate_certificate!
      store_signed_document!
      log_event("completed", description: "All signers have signed")

      # Send completion notifications
      ESignatureEmailService.deliver(ESignatureMailer.completion_notification(self))
    end

    # Wake up any BPMN workflows waiting for this signature to complete.
    # Without this, workflows poll every 60 minutes via BpmnRetryWaitingTaskJob.
    wake_up_waiting_bpmn_tokens
  end

  def decline!(signer)
    return unless status.in?(%w[sent in_progress])

    update!(
      status: "declined",
      declined_at: Time.current
    )

    log_event("declined",
      description: "Request declined by #{signer.name}",
      signer: signer,
      event_data: { reason: signer.decline_reason }
    )

    # Notify creator
    ESignatureEmailService.deliver(ESignatureMailer.decline_notification(self, signer))
  end

  def cancel!(reason: nil)
    return false unless can_cancel?

    update!(status: "cancelled")
    log_event("cancelled", description: reason || "Request cancelled")

    # Notify all signers and the creator that the request was cancelled
    begin
      ESignatureEmailService.deliver(
        ESignatureMailer.cancellation_notification(self, reason: reason)
      )
    rescue => e
      Rails.logger.error "[ESignature] Cancellation notification failed: #{e.message}"
      # Don't fail the cancellation if notification fails
    end

    true
  end

  def expire!
    return unless status.in?(%w[sent in_progress])
    return unless expires_at && expires_at < Time.current

    update!(status: "expired")
    log_event("expired", description: "Request expired")

    # Notify all parties
    ESignatureEmailService.deliver(ESignatureMailer.expiration_notification(self))
  end

  # Progress tracking
  def progress_percentage
    return 0 if signers.empty?
    (signers.signed.count.to_f / signers.count * 100).round
  end

  def signed_count
    signers.signed.count
  end

  def pending_count
    signers.pending.count
  end

  # Get the next signer (for sequential signing)
  def next_signer
    return nil if signing_order.zero?  # Parallel signing

    signers
      .where.not(status: "signed")
      .order(:signing_order)
      .first
  end

  def parallel_signing?
    signing_order.zero?
  end

  def sequential_signing?
    signing_order.positive?
  end

  # Document hash for integrity
  def calculate_original_document_hash
    return nil unless original_storage_file_id

    # This would download and hash the document
    # Implementation depends on your document storage
    Digest::SHA256.hexdigest(Time.current.to_s + request_number)
  end

  def calculate_current_document_hash
    # Build hash chain from all signature events
    chain = signers.signed.order(:signed_at).map do |signer|
      {
        signer_id: signer.id,
        signed_at: signer.signed_at.iso8601,
        signature_hash: Digest::SHA256.hexdigest(signer.signature_data.to_s)
      }
    end

    Digest::SHA256.hexdigest(original_document_hash.to_s + chain.to_json)
  end

  # Event logging
  def log_event(event_type, description: nil, signer: nil, event_data: {}, ip_address: nil, user_agent: nil)
    events.create!(
      event_type: event_type,
      event_description: description,
      e_signature_signer: signer,
      event_data: event_data,
      ip_address: ip_address,
      user_agent: user_agent,
      document_hash: calculate_current_document_hash,
      occurred_at: Time.current,
      actor_type: signer ? "signer" : "system",
      actor_name: signer&.name,
      actor_email: signer&.email
    )
  end

  # Reminders
  def send_reminder!
    return unless status.in?(%w[sent in_progress])
    return unless send_reminders?

    signers.pending.each do |signer|
      ESignatureEmailService.deliver(ESignatureMailer.reminder(self, signer))
    end

    update!(last_reminder_sent_at: Time.current)
    log_event("reminder_sent", description: "Reminder sent to pending signers")
  end

  # Summary for API
  def to_summary
    {
      id: id,
      request_number: request_number,
      title: title,
      status: status,
      progress: progress_percentage,
      signed_count: signed_count,
      total_signers: signers.count,
      sent_at: sent_at,
      expires_at: expires_at,
      completed_at: completed_at,
      signers: signers.map(&:to_summary)
    }
  end

  # Generate a random download token stored in the database.
  #
  # ⚠️ DO NOT SIMPLIFY - Environment-independent token (2026-02-26)
  # ════════════════════════════════════════════════════════════════
  # Why: Staging/beta/production share the same DB but have different SECRET_KEY_BASE.
  #      MessageVerifier tokens signed on staging can't be verified on production.
  #      DB-stored tokens work regardless of which environment generates or verifies them.
  # ❌ WRONG: Rails.application.message_verifier(:esign_download).generate(...)
  # ✅ CORRECT: Random token stored in DB, verified by lookup
  # ════════════════════════════════════════════════════════════════
  def generate_download_token
    return download_token if download_token.present?

    token = SecureRandom.urlsafe_base64(32)
    update!(download_token: token)
    token
  end

  def download_url
    token = generate_download_token
    # Always point to production - external signers access the download link from email
    api_url = InfrastructureUrls.production_backend_url
    "#{api_url}/api/v1/esign_download?token=#{CGI.escape(token)}"
  end

  # Provider-agnostic storage references (SSoT: original/signed_storage_item_id)
  # SSoT: Uses storage_file_id columns
  def original_storage_reference
    original_storage_item_id.presence || original_storage_file_id
  end

  def signed_storage_reference
    signed_storage_item_id.presence || signed_storage_file_id
  end

  def set_original_storage_reference(item_id)
    self.original_storage_item_id = item_id
  end

  def set_signed_storage_reference(item_id)
    self.signed_storage_item_id = item_id
  end

  # Generate filename for the signed document.
  # Uses document type naming template if available, otherwise falls back to title.
  # Public because used by download_signed_document controller action.
  def generate_signed_filename
    if document_type&.download_name.present? && documentable.is_a?(Job)
      document_type.generate_proposed_name(job: documentable, file_extension: "pdf", description: "Signed")
    else
      date = TenantSetting.in_company_timezone { Date.current }.strftime("%d-%m-%Y")
      sanitized_title = title.to_s.gsub(/[<>:"\/\\|?*]/, "_").strip[0..60]
      "#{sanitized_title} - Signed #{date}.pdf"
    end
  end

  private

  # Immediately retry any BPMN tokens waiting on this e-signature request.
  # Finds waiting tokens via the documentable (e.g., Corporate) subject link.
  def wake_up_waiting_bpmn_tokens
    return unless documentable.present?

    waiting_tokens = BpmnToken.waiting
      .joins(:bpmn_process_instance)
      .where(
        bpmn_process_instances: {
          subject_type: documentable_type,
          subject_id: documentable_id,
          status: "active"
        }
      )

    waiting_tokens.find_each do |token|
      Rails.logger.info("ESignatureRequest##{id}: Waking up BPMN token #{token.id} (was waiting for signatures)")
      BpmnRetryWaitingTaskJob.perform_later(token.id)
    end
  rescue StandardError => e
    Rails.logger.error("ESignatureRequest##{id}: Failed to wake BPMN tokens: #{e.message}")
  end

  def generate_request_number
    return if request_number.present?

    year = Date.current.year
    prefix = "ESR-#{year}-"

    # Find highest number for this year
    max = ESignatureRequest
      .where("request_number LIKE ?", "#{prefix}%")
      .pluck(:request_number)
      .map { |n| n.sub(prefix, "").to_i }
      .max || 0

    self.request_number = "#{prefix}#{(max + 1).to_s.rjust(5, '0')}"
  end

  def log_created_event
    log_event("created", description: "E-signature request created")
  end

  def generate_certificate!
    ESignatureCertificate.generate_for!(self)
  end

  # Store the signed document as a WarehouseDocument in the File Warehouse.
  # Follows the Form43CertificateGenerator pattern (SSoT: GeneratePdfJob lines 229-252).
  #
  # Downloads the original PDF from storage, creates a StorageBlob (deduplicated),
  # and creates a WarehouseDocument linked to the documentable (Job, Corporate, etc.).
  # ⚠️ FAIL FAST - No silent error swallowing (2026-02-26)
  # ════════════════════════════════════════════════════════════════
  # Why: Silent rescue hid storage failures for W2G Assets director change.
  #      Signed PDF was never stored, nobody knew until workflow got stuck.
  # ❌ WRONG: rescue => e; Rails.logger.error  → errors invisible
  # ✅ CORRECT: Let errors propagate → visible, fixable
  # ════════════════════════════════════════════════════════════════
  def store_signed_document!
    storage_ref = original_storage_reference
    raise "[ESignature] No original_storage_reference for #{request_number}" unless storage_ref.present?

    # Download original document content from storage
    blob_source = StorageBlob.find_by(id: storage_ref)
    if blob_source
      content = blob_source.download
    else
      storage_service = DocumentStorageService.new
      provider = storage_service.send(:s3_provider)
      raise "[ESignature] No S3 provider available to download #{storage_ref} for #{request_number}" unless provider
      content = provider.download_file(storage_ref)
    end
    raise "[ESignature] Empty content downloaded for #{request_number} (ref: #{storage_ref})" if content.blank?

    # Stamp signatures onto the PDF before storing.
    # The stamper overlays actual signature images, timestamps, metadata,
    # and a certificate of completion page onto the original PDF.
    stamper = ESignaturePdfStamper.new(self)
    stamped_content = stamper.stamp!
    raise "[ESignature] PDF stamper returned blank content for #{request_number}" if stamped_content.blank?
    content = stamped_content

    filename = generate_signed_filename
    source_type = resolve_source_type

    # Always create a new blob for the stamped content (don't reuse original)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: "application/pdf"
    )

    # Store the signed blob reference so downstream consumers
    # (e.g. DirectorChangeService#complete_signing!) can find it
    set_signed_storage_reference(blob.id.to_s)
    save!

    # Create WarehouseDocument via standard service (SSoT: WarehouseDocumentCreator)
    metadata = {
      "version_status" => "signed",
      "e_signature_request_id" => id,
      "request_number" => request_number,
      "signed_at" => completed_at&.iso8601,
      "source" => "e_signature",
      # Auto-validate: TEEEM-generated signed documents are pre-validated by the platform
      "user_validated_at" => Time.current.iso8601,
      "user_validated_by_name" => "TEEEM Platform"
    }
    metadata["document_type_id"] = document_type_id if document_type_id.present?
    metadata["document_type"] = document_type.name if document_type.present?

    # Resolve warehouse folder from document type (for precise path materialization)
    warehouse_folder_id = document_type&.primary_warehouse_folder&.id

    WarehouseDocumentCreator.create!(
      filename: filename,
      source_type: source_type,
      linkable: documentable,
      storage_blob: blob,
      warehouse_folder_id: warehouse_folder_id,
      file_size: content.bytesize,
      content_type: "application/pdf",
      metadata: metadata
    )

    Rails.logger.info "[ESignature] Stored signed document for #{request_number} as WarehouseDocument (blob: #{blob.id})"
  end

  # Map documentable_type to WarehouseDocument source_type
  def resolve_source_type
    case documentable_type
    when "Job" then "job"
    when "Corporate" then "corporate"
    when "Contact" then "contact"
    else "corporate"
    end
  end
end

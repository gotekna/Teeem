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

  def send_for_signing!
    return false unless can_send?

    transaction do
      update!(
        status: "sent",
        sent_at: Time.current,
        expires_at: 30.days.from_now
      )

      signers.each(&:send_notification!)
      log_event("sent", description: "Request sent for signing")
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
      log_event("completed", description: "All signers have signed")

      # Send completion notifications
      ESignatureMailer.completion_notification(self).deliver_later
    end
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
    ESignatureMailer.decline_notification(self, signer).deliver_later
  end

  def cancel!(reason: nil)
    return false unless can_cancel?

    update!(status: "cancelled")
    log_event("cancelled", description: reason || "Request cancelled")
    true
  end

  def expire!
    return unless status.in?(%w[sent in_progress])
    return unless expires_at && expires_at < Time.current

    update!(status: "expired")
    log_event("expired", description: "Request expired")

    # Notify all parties
    ESignatureMailer.expiration_notification(self).deliver_later
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
      ESignatureMailer.reminder(self, signer).deliver_later
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

  private

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
end

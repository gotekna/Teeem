# frozen_string_literal: true

# ESignatureEvent provides a complete audit trail for e-signature requests.
# Every action on a request or by a signer is recorded for legal compliance.
#
# This audit trail is critical for compliance with:
# - eIDAS (EU) - requires demonstrable audit trail
# - ESIGN Act (US) - requires retention of electronic records
# - Australian ETA - requires evidence of electronic consent
#
class ESignatureEvent < ApplicationRecord
  # Constants
  EVENT_TYPES = %w[
    created
    sent
    viewed
    verified
    verification_failed
    verification_locked
    signed
    declined
    completed
    expired
    cancelled
    reminder_sent
    document_downloaded
    access_attempt
    in_progress
  ].freeze

  ACTOR_TYPES = %w[user signer system].freeze

  # Associations
  belongs_to :e_signature_request
  belongs_to :e_signature_signer, optional: true
  belongs_to :actor_user, class_name: "User", optional: true

  # Validations
  validates :event_type, presence: true, inclusion: { in: EVENT_TYPES }
  validates :occurred_at, presence: true
  validates :actor_type, inclusion: { in: ACTOR_TYPES }, allow_nil: true

  # Scopes
  scope :chronological, -> { order(occurred_at: :asc) }
  scope :reverse_chronological, -> { order(occurred_at: :desc) }
  scope :by_type, ->(type) { where(event_type: type) }
  scope :by_signer, ->(signer) { where(e_signature_signer: signer) }
  scope :recent, ->(limit = 10) { reverse_chronological.limit(limit) }

  # Class methods
  def self.log(request, event_type, **options)
    request.events.create!(
      event_type: event_type,
      event_description: options[:description],
      e_signature_signer: options[:signer],
      event_data: options[:event_data] || {},
      ip_address: options[:ip_address],
      user_agent: options[:user_agent],
      document_hash: options[:document_hash],
      occurred_at: Time.current,
      actor_type: options[:actor_type] || "system",
      actor_name: options[:actor_name],
      actor_email: options[:actor_email],
      actor_user: options[:actor_user]
    )
  end

  # Instance methods
  def human_description
    event_description || default_description
  end

  def to_audit_entry
    {
      timestamp: occurred_at.iso8601,
      event: event_type,
      description: human_description,
      actor: {
        type: actor_type,
        name: actor_name,
        email: actor_email
      },
      signer: e_signature_signer ? {
        id: e_signature_signer.id,
        name: e_signature_signer.name,
        email: e_signature_signer.email
      } : nil,
      forensic_data: {
        ip_address: ip_address,
        user_agent: user_agent,
        document_hash: document_hash
      },
      metadata: event_data
    }.compact
  end

  private

  def default_description
    case event_type
    when "created"
      "E-signature request created"
    when "sent"
      "Request sent for signing"
    when "viewed"
      signer_name = e_signature_signer&.name || "Unknown"
      "Document viewed by #{signer_name}"
    when "verified"
      signer_name = e_signature_signer&.name || "Unknown"
      "Email verified by #{signer_name}"
    when "verification_failed"
      "Email verification failed"
    when "verification_locked"
      "Too many verification attempts - account locked"
    when "signed"
      signer_name = e_signature_signer&.name || "Unknown"
      "Document signed by #{signer_name}"
    when "declined"
      signer_name = e_signature_signer&.name || "Unknown"
      "Request declined by #{signer_name}"
    when "completed"
      "All signatures collected - request completed"
    when "expired"
      "Request expired"
    when "cancelled"
      "Request cancelled"
    when "reminder_sent"
      "Reminder notification sent"
    when "document_downloaded"
      "Document downloaded"
    when "access_attempt"
      "Access attempt recorded"
    when "in_progress"
      "Signing in progress"
    else
      event_type.humanize
    end
  end
end

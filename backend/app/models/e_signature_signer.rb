# frozen_string_literal: true

# ESignatureSigner represents a person who needs to sign an e-signature request.
# Handles access token generation, email verification, and signature capture.
#
class ESignatureSigner < ApplicationRecord
  # Constants
  STATUSES = %w[pending notified viewed signed declined].freeze
  SIGNATURE_TYPES = %w[drawn typed uploaded positioned].freeze
  ROLES = %w[client builder witness guarantor director partner solicitor accountant other].freeze

  # Associations
  belongs_to :e_signature_request
  belongs_to :contact, optional: true
  has_many :events, class_name: "ESignatureEvent", dependent: :destroy
  has_many :fields, class_name: "ESignatureField", dependent: :destroy

  # Validations
  validates :name, presence: true
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :signature_type, inclusion: { in: SIGNATURE_TYPES }, allow_nil: true
  validates :role, inclusion: { in: ROLES }, allow_nil: true

  # Scopes
  scope :pending, -> { where(status: %w[pending notified viewed]) }
  scope :signed, -> { where(status: "signed") }
  scope :declined, -> { where(status: "declined") }
  scope :by_signing_order, -> { order(:signing_order) }

  # Status predicates
  def pending?
    status.in?(%w[pending notified viewed])
  end

  def signed?
    status == "signed"
  end

  def declined?
    status == "declined"
  end

  def can_sign?
    return false unless pending?

    # For sequential signing, check if it's this signer's turn
    if e_signature_request.sequential_signing?
      e_signature_request.next_signer == self
    else
      true
    end
  end

  # Access token management
  def generate_access_token!
    token = SecureRandom.urlsafe_base64(32)
    update!(
      access_token_hash: Digest::SHA256.hexdigest(token),
      access_token_expires_at: 30.days.from_now
    )
    token
  end

  def valid_access_token?(token)
    return false if access_token_hash.blank?
    return false if access_token_expires_at && access_token_expires_at < Time.current

    Digest::SHA256.hexdigest(token) == access_token_hash
  end

  # Email verification (6-digit code)
  def generate_verification_code!
    code = format("%06d", SecureRandom.random_number(1_000_000))
    update!(
      email_verification_code: code,
      email_verification_expires_at: 15.minutes.from_now,
      email_verification_attempts: 0
    )
    code
  end

  def verify_code!(code)
    return false if email_verification_code.blank?
    return false if email_verification_expires_at && email_verification_expires_at < Time.current

    # Increment attempts
    increment!(:email_verification_attempts)

    # Lock after 5 failed attempts
    if email_verification_attempts >= 5
      log_event("verification_locked", description: "Too many failed verification attempts")
      return false
    end

    if code == email_verification_code
      update!(
        email_verified_at: Time.current,
        email_verification_code: nil
      )
      log_event("verified", description: "Email verified successfully")
      true
    else
      log_event("verification_failed", description: "Incorrect verification code")
      false
    end
  end

  def email_verified?
    email_verified_at.present?
  end

  # Signing flow
  def send_notification!(force: false)
    return if notified_at.present? && !force

    # Token is generated inside the mailer (signing_url_for) so it appears in the email link.
    # Do NOT call generate_access_token! here - it would be overwritten by the mailer.
    begin
      ESignatureEmailService.deliver(
        ESignatureMailer.signing_request(e_signature_request, self)
      )
    rescue ESignatureEmailService::DeliveryError, Net::ReadTimeout, Net::OpenTimeout, Errno::ECONNREFUSED, Errno::ECONNRESET => e
      log_event("notification_failed", description: "Email delivery failed: #{e.message}")
      raise DirectorChangeService::GenerationError, "Failed to send email to #{email}: #{e.class.name} - check E-Signature Outbox in Settings > Email Setup"
    end

    update!(status: "notified", notified_at: Time.current)
    log_event("notified", description: "Signing notification #{force ? 're-' : ''}sent to #{email}")
  end

  def mark_viewed!(ip_address: nil, user_agent: nil)
    return if viewed_at.present?

    update!(
      status: "viewed",
      viewed_at: Time.current,
      ip_address: ip_address,
      user_agent: user_agent
    )

    log_event("viewed",
      description: "Document viewed",
      ip_address: ip_address,
      user_agent: user_agent
    )

    # Update request status
    e_signature_request.mark_in_progress!

    # Log certified_delivered when the last pending signer views the document.
    # This mirrors DocuSign's "Certified Delivered" status: all recipients have received the envelope.
    remaining_unviewed = e_signature_request.signers.where(viewed_at: nil).where.not(id: id)
    if remaining_unviewed.empty? && !e_signature_request.events.exists?(event_type: "certified_delivered")
      e_signature_request.log_event("certified_delivered",
        description: "Envelope delivered to all recipients"
      )
    end
  end

  def sign!(signature_data:, signature_type:, ip_address: nil, user_agent: nil, typed_font: nil, device: nil, skip_email_verification: false)
    return false unless can_sign?
    return false unless skip_email_verification || email_verified?

    transaction do
      update!(
        status: "signed",
        signed_at: Time.current,
        signature_data: signature_data,
        signature_type: signature_type,
        typed_signature_font: typed_font,
        ip_address: ip_address,
        user_agent: user_agent,
        signing_device: device
      )

      # Auto-complete any associated positioned fields for this signer
      # (e.g., fields created by DirectorChangeService for badge replacement)
      fields.incomplete.each do |field|
        case field.field_type
        when "signature", "initials"
          field.complete!(signature_data)
        when "date"
          field.complete!(Time.current.strftime(field.effective_date_format))
        when "text"
          field.complete!(name)
        end
      end

      log_event("signed",
        description: "Document signed",
        ip_address: ip_address,
        user_agent: user_agent,
        event_data: {
          signature_type: signature_type,
          device: device
        }
      )

      # Check if all signers have signed
      e_signature_request.check_completion!

      # For sequential signing, notify next signer
      if e_signature_request.sequential_signing?
        next_signer = e_signature_request.next_signer
        next_signer&.send_notification!
      end
    end

    true
  end

  def decline!(reason: nil, ip_address: nil, user_agent: nil)
    return false unless pending?

    update!(
      status: "declined",
      declined_at: Time.current,
      decline_reason: reason,
      ip_address: ip_address,
      user_agent: user_agent
    )

    log_event("declined",
      description: "Signer declined to sign",
      ip_address: ip_address,
      user_agent: user_agent,
      event_data: { reason: reason }
    )

    # This will trigger the request decline
    e_signature_request.check_completion!
    true
  end

  # Event logging
  def log_event(event_type, description: nil, ip_address: nil, user_agent: nil, event_data: {})
    e_signature_request.events.create!(
      e_signature_signer: self,
      event_type: event_type,
      event_description: description,
      ip_address: ip_address || self.ip_address,
      user_agent: user_agent || self.user_agent,
      event_data: event_data,
      actor_type: "signer",
      actor_name: name,
      actor_email: email,
      occurred_at: Time.current
    )
  end

  # Summary for API
  def to_summary
    {
      id: id,
      name: name,
      email: email,
      role: role,
      status: status,
      signed_at: signed_at,
      signing_order: signing_order,
      can_sign: can_sign?
    }
  end

  # Generate signing URL
  def signing_url
    return nil unless access_token_hash.present?

    token = nil  # Token is stored hashed, so we can't retrieve it
    # The URL is generated when sending notifications using the raw token
    nil
  end
end

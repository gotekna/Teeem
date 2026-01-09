# frozen_string_literal: true

# ESignatureMailer handles all email notifications for the e-signature system.
#
class ESignatureMailer < ApplicationMailer
  default from: -> { ENV.fetch("ESIGNATURE_FROM_EMAIL", "esign@teeem.com.au") }

  # Sent when a signer is asked to sign a document
  def signing_request(request, signer)
    @request = request
    @signer = signer
    @signing_url = signing_url_for(signer)
    @expires_at = request.expires_at&.strftime("%d %B %Y")

    mail(
      to: signer.email,
      subject: "Please sign: #{request.title}"
    )
  end

  # Sent when email verification code is requested
  def verification_code(signer)
    @signer = signer
    @request = signer.e_signature_request
    @code = signer.email_verification_code
    @expires_in = "15 minutes"

    mail(
      to: signer.email,
      subject: "Your verification code for #{@request.title}"
    )
  end

  # Sent to remind a signer who hasn't signed yet
  def reminder(request, signer)
    @request = request
    @signer = signer
    @signing_url = signing_url_for(signer)
    @days_remaining = (request.expires_at.to_date - Date.current).to_i if request.expires_at

    mail(
      to: signer.email,
      subject: "Reminder: Please sign #{request.title}"
    )
  end

  # Sent to all parties when signing is complete
  def completion_notification(request)
    @request = request
    @certificate = request.certificate

    recipients = [ request.created_by&.email ]
    recipients += request.signers.pluck(:email)
    recipients = recipients.compact.uniq

    mail(
      to: recipients,
      subject: "Signing complete: #{request.title}"
    )
  end

  # Sent to request creator when a signer declines
  def decline_notification(request, signer)
    @request = request
    @signer = signer

    mail(
      to: request.created_by&.email || ENV.fetch("ESIGNATURE_ADMIN_EMAIL", nil),
      subject: "Signature declined: #{request.title}"
    )
  end

  # Sent when a request expires
  def expiration_notification(request)
    @request = request

    recipients = [ request.created_by&.email ]
    recipients += request.signers.pending.pluck(:email)
    recipients = recipients.compact.uniq

    mail(
      to: recipients,
      subject: "Signing request expired: #{request.title}"
    )
  end

  private

  def signing_url_for(signer)
    token = signer.generate_access_token!
    frontend_url = ENV.fetch("FRONTEND_URL", "https://teeemlive.vercel.app")
    "#{frontend_url}/sign/#{token}"
  end
end

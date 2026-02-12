# frozen_string_literal: true

# ESignatureEmailService delivers e-signature emails via Microsoft Graph API
# so emails come from the client's own domain (e.g., esign@tekna.com.au),
# not from TEEEM's SMTP relay.
#
# SaaS-ready: Each client sends from their own Office 365 shared mailbox.
# Falls back to SMTP if no Microsoft credential is available.
#
# Usage:
#   ESignatureEmailService.deliver(
#     ESignatureMailer.signing_request(request, signer)
#   )
#
class ESignatureEmailService
  class DeliveryError < StandardError; end

  def self.deliver(mail_delivery)
    new.deliver(mail_delivery)
  end

  def deliver(mail_delivery)
    mail = mail_delivery.message
    from_email = Array(mail.from).first
    to_emails = Array(mail.to)
    subject = mail.subject
    body = extract_html_body(mail)

    Rails.logger.info "[ESignatureEmail] Attempting delivery from #{from_email} to #{to_emails.join(', ')} (subject: #{subject})"

    begin
      client = MicrosoftAppGraphClient.new
      client.send_email(from: from_email, to: to_emails, subject: subject, body: body)
      Rails.logger.info "[ESignatureEmail] Sent via Graph API from #{from_email} to #{to_emails.join(', ')}"
    rescue MicrosoftAppGraphClient::NotConnectedError, MicrosoftAppGraphClient::DeadTokenError => e
      Rails.logger.warn "[ESignatureEmail] Graph API unavailable (#{e.message}), falling back to direct SMTP"
      # Use mail.deliver! directly on the Mail::Message to bypass ActiveJob/SolidQueue.
      # mail_delivery.deliver_now goes through the job queue which may not process immediately.
      # E-signature emails (especially verification codes) must be sent synchronously.
      mail.deliver!
      Rails.logger.info "[ESignatureEmail] Sent via SMTP from #{from_email} to #{to_emails.join(', ')}"
    rescue MicrosoftAppGraphClient::ApiError => e
      Rails.logger.error "[ESignatureEmail] Graph API send failed: #{e.message}"
      raise DeliveryError, "Failed to send e-signature email from #{from_email}: #{e.message}"
    rescue => e
      Rails.logger.error "[ESignatureEmail] Unexpected error: #{e.class} - #{e.message}"
      raise DeliveryError, "Failed to send e-signature email: #{e.message}"
    end
  end

  private

  def extract_html_body(mail)
    if mail.html_part
      mail.html_part.body.to_s
    elsif mail.content_type&.include?("text/html")
      mail.body.to_s
    else
      "<html><body>#{mail.body.to_s}</body></html>"
    end
  end
end

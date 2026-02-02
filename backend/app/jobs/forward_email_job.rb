# frozen_string_literal: true

# ForwardEmailJob - Forwards an email to a specified address
#
# Used by email rules to automatically forward matching emails.
# Handles all account types through EmailSendingService.
#
# Usage:
#   ForwardEmailJob.perform_later(email_id, forward_to_address)
#
class ForwardEmailJob < ApplicationJob
  queue_as :default

  retry_on StandardError, wait: 5.seconds, attempts: 3

  def perform(email_id, forward_to_address)
    email = SyncedEmail.find_by(id: email_id)
    unless email
      Rails.logger.warn("[ForwardEmailJob] Email #{email_id} not found, skipping")
      return
    end

    unless forward_to_address.present?
      Rails.logger.warn("[ForwardEmailJob] No forward address for email #{email_id}, skipping")
      return
    end

    # Build forwarded message
    forward_body = build_forward_body(email)
    forward_subject = email.subject&.start_with?("Fwd:") ? email.subject : "Fwd: #{email.subject}"

    # Determine which account to send from (use the same account that received the email)
    result = send_forward(email, forward_to_address, forward_subject, forward_body)

    if result.success?
      Rails.logger.info("[ForwardEmailJob] Successfully forwarded email #{email_id} to #{forward_to_address}")
      # Record the forward in email metadata
      email.update(forwarded_at: Time.current, forwarded_to: forward_to_address)
    else
      Rails.logger.error("[ForwardEmailJob] Failed to forward email #{email_id}: #{result.error}")
      raise StandardError, "Forward failed: #{result.error}"
    end
  end

  private

  def build_forward_body(email)
    original_body = email.body_html.presence || email.body_text.presence || ""

    # Build forward header
    forward_header = <<~HTML
      <br><br>
      <hr style="border: 1px solid #ccc; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">
        <strong>---------- Forwarded message ----------</strong><br>
        From: #{email.from_name.presence || email.from_email}<br>
        Date: #{email.received_at&.strftime('%B %d, %Y at %I:%M %p')}<br>
        Subject: #{email.subject}<br>
        To: #{Array(email.to_emails).join(', ')}<br>
      </p>
      <br>
    HTML

    forward_header + original_body
  end

  def send_forward(email, forward_to_address, subject, body)
    # Determine account type and credential from the original email
    account_type = determine_account_type(email)
    credential_id = determine_credential_id(email, account_type)

    # If we can't determine the account, try the default org MS365 account
    if credential_id.blank?
      # FRC (Feb 2026): Changed from .connected to .refreshable_app for 24/7 availability
      ms365_cred = MicrosoftCredential.refreshable_app.first
      if ms365_cred
        account_type = "ms365"
        credential_id = ms365_cred.id
      else
        return EmailSendingService::Result.new(
          success: false,
          error: "No email account available to send forward"
        )
      end
    end

    EmailSendingService.send(
      account_type: account_type,
      credential_id: credential_id,
      to: [forward_to_address],
      subject: subject,
      body: body,
      mailbox_email: email.to_emails&.first # Use original recipient as sender for MS365
    )
  end

  def determine_account_type(email)
    case email.source_type
    when "imap" then "imap"
    when "outlook" then "outlook"
    when "ms365", "microsoft", "graph" then "ms365"
    else "ms365" # Default to MS365
    end
  end

  def determine_credential_id(email, account_type)
    case account_type
    when "imap"
      email.imap_credential_id
    when "ms365"
      # Find the credential for this mailbox
      if email.to_emails.present?
        cred = MicrosoftCredential.active.app_credentials
          .where("mailboxes @> ?", [email.to_emails.first].to_json)
          .first
        cred&.id
      end
    else
      nil
    end
  end
end

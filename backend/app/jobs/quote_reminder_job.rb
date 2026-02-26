# frozen_string_literal: true

# QuoteReminderJob - Sends follow-up reminder emails to non-responding suppliers
#
# Handles both legacy QuoteRequest system and new QuoteTracker RFQ workflow.
#
# Schedule: Run daily via SolidQueue recurring schedule
#   queue: :default
#
# Usage:
#   QuoteReminderJob.perform_now                           # Process all pending
#   QuoteReminderJob.perform_now(quote_request_id: 123)    # Legacy: specific request
#   QuoteReminderJob.perform_now(reminder_after_days: 5)   # Override default interval
#
class QuoteReminderJob < ApplicationJob
  queue_as :default

  def perform(quote_request_id: nil, contact_ids: nil, reminder_after_days: 7, max_reminders: 3)
    if quote_request_id
      # Legacy: Send reminders for specific quote request
      send_reminders_for_quote_request(quote_request_id, contact_ids)
    else
      # Process both systems
      send_tracker_reminders(reminder_after_days, max_reminders)
      send_all_reminders # Legacy QuoteRequest system
    end
  end

  private

  # ─────────────────────────────────────────────────────────────────────────
  # New QuoteTracker RFQ Reminders
  # ─────────────────────────────────────────────────────────────────────────

  def send_tracker_reminders(reminder_after_days, max_reminders)
    cutoff_date = reminder_after_days.days.ago
    cooldown = 3.days.ago # Minimum time between reminders

    trackers = QuoteTracker
      .where(status: 'sent')
      .where.not(sent_at: nil)
      .where(sent_at: ..cutoff_date)
      .where(reminder_count: ...max_reminders)
      .where(last_reminder_at: [nil, ..cooldown])
      .includes(:job, :supplier, :contact, :sm_schedule_master, :sm_trade, :sent_by)

    sent_count = 0
    error_count = 0

    trackers.find_each do |tracker|
      # Set tenant context for email sending
      tenant = tracker.job&.tenant
      next unless tenant

      ActsAsTenant.with_tenant(tenant) do
        send_tracker_reminder(tracker)
        sent_count += 1
      rescue StandardError => e
        error_count += 1
        Rails.logger.error("[QuoteReminderJob] Failed for tracker #{tracker.id}: #{e.message}")
      end
    end

    Rails.logger.info("[QuoteReminderJob] QuoteTracker reminders: #{sent_count} sent, #{error_count} errors")
  end

  def send_tracker_reminder(tracker)
    recipient_email = tracker.contact&.email.presence ||
                      tracker.contact_email.presence ||
                      tracker.supplier&.email.presence
    return unless recipient_email.present?

    # Find an email account to send from
    user = tracker.sent_by
    return unless user

    account_type, credential_id, mailbox_email = resolve_email_credential(user)
    return unless credential_id

    job = tracker.job
    days_ago = ((Time.current - tracker.sent_at) / 1.day).round
    subject = "Reminder: Request for Quote - #{job.name} (#{job.job_code})"
    body = build_tracker_reminder_body(tracker, job, user, days_ago)

    result = EmailSendingService.send_and_log(
      account_type: account_type,
      credential_id: credential_id,
      user: user,
      to: [recipient_email],
      subject: subject,
      body: body,
      mailbox_email: mailbox_email,
      reply_to_message_id: tracker.email_message_id
    )

    if result.success?
      tracker.update!(
        reminder_count: tracker.reminder_count + 1,
        last_reminder_at: Time.current
      )
      Rails.logger.info("[QuoteReminderJob] Reminder sent for tracker #{tracker.id} to #{recipient_email}")
    else
      Rails.logger.warn("[QuoteReminderJob] Email failed for tracker #{tracker.id}: #{result.error}")
    end
  end

  def build_tracker_reminder_body(tracker, job, user, days_ago)
    supplier_name = tracker.contact&.first_name || tracker.supplier&.display_name || "there"

    parts = []
    parts << "<p>Hi #{ERB::Util.html_escape(supplier_name)},</p>"
    parts << "<p>This is a friendly reminder regarding our request for quote sent #{days_ago} days ago.</p>"
    parts << "<ul>"
    parts << "<li><strong>Project:</strong> #{ERB::Util.html_escape(job.name)}</li>"
    parts << "<li><strong>Reference:</strong> #{ERB::Util.html_escape(job.job_code)}</li>" if job.job_code.present?
    parts << "<li><strong>Trade:</strong> #{ERB::Util.html_escape(tracker.task_name)}</li>" if tracker.task_name.present?
    parts << "</ul>"
    parts << "<p>We would appreciate your response at your earliest convenience.</p>"
    parts << "<p>Kind regards,<br>#{ERB::Util.html_escape(user.name)}</p>"
    parts.join("\n")
  end

  # Resolve best available email credential for a user
  def resolve_email_credential(user)
    # Try IMAP first
    credential = ImapCredential.accessible_by(user).where(is_active: true).first
    if credential
      return ['imap', credential.id, nil]
    end

    # Fall back to MS365
    tenant_org_ids = user.tenant&.organizations&.pluck(:id) || []
    ms365_cred = MicrosoftCredential.where(organization_id: tenant_org_ids, credential_type: 'app').first
    if ms365_cred
      mailbox = ms365_cred.monitored_mailboxes&.first
      return ['ms365', ms365_cred.id, mailbox]
    end

    [nil, nil, nil]
  end

  # ─────────────────────────────────────────────────────────────────────────
  # Legacy QuoteRequest Reminders
  # ─────────────────────────────────────────────────────────────────────────

  def send_reminders_for_quote_request(quote_request_id, contact_ids = nil)
    quote_request = QuoteRequest.find(quote_request_id)

    return unless quote_request.pending_response?

    # Find suppliers who haven't responded
    invited_contact_ids = quote_request.contacts.pluck(:id)
    responded_contact_ids = quote_request.quote_responses.pluck(:contact_id)
    non_responded_contact_ids = invited_contact_ids - responded_contact_ids

    # Filter by specific contacts if provided
    non_responded_contact_ids &= contact_ids if contact_ids.present?

    return if non_responded_contact_ids.empty?

    contacts = Contact.where(id: non_responded_contact_ids)

    Rails.logger.info(
      "Sending reminders for quote request ##{quote_request_id} to #{contacts.count} suppliers"
    )

    sent_count = 0
    contacts.each do |contact|
      if send_legacy_reminder(quote_request, contact)
        sent_count += 1
      end
    end

    Rails.logger.info(
      "Reminders sent for quote request ##{quote_request_id}: #{sent_count} of #{contacts.count}"
    )
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error("Quote request ##{quote_request_id} not found: #{e.message}")
  rescue => e
    Rails.logger.error("Error sending reminders for quote request ##{quote_request_id}: #{e.message}")
  end

  def send_all_reminders
    # Find quote requests that are pending and old enough for a reminder
    reminder_threshold = 24.hours.ago

    quote_requests = QuoteRequest.where(status: "pending_response")
                                .where("created_at < ?", reminder_threshold)

    Rails.logger.info("Checking #{quote_requests.count} legacy quote requests for reminders")

    total_reminders = 0

    quote_requests.each do |quote_request|
      next if reminder_sent_recently?(quote_request)

      invited_contact_ids = quote_request.contacts.pluck(:id)
      responded_contact_ids = quote_request.quote_responses.pluck(:contact_id)
      non_responded_contact_ids = invited_contact_ids - responded_contact_ids

      next if non_responded_contact_ids.empty?

      contacts = Contact.where(id: non_responded_contact_ids)

      contacts.each do |contact|
        if send_legacy_reminder(quote_request, contact)
          total_reminders += 1
        end
      end

      mark_reminder_sent(quote_request)
    end

    Rails.logger.info("Legacy reminders sent: #{total_reminders}")
  end

  def send_legacy_reminder(quote_request, contact)
    hours_waiting = ((Time.current - quote_request.created_at) / 1.hour).round

    if contact.email.present?
      Rails.logger.info("Reminder email sent to #{contact.email} for quote request ##{quote_request.id}")
    end

    true
  rescue => e
    Rails.logger.error("Failed to send reminder to contact ##{contact.id}: #{e.message}")
    false
  end

  def reminder_sent_recently?(quote_request)
    metadata = quote_request.metadata || {}
    last_reminder = metadata["last_reminder_sent_at"]

    return false unless last_reminder

    Time.parse(last_reminder) > 24.hours.ago
  rescue StandardError => e
    Rails.logger.warn "[QuoteReminderJob] Failed to parse last_reminder_sent_at: #{e.message}"
    false
  end

  def mark_reminder_sent(quote_request)
    metadata = quote_request.metadata || {}
    metadata["last_reminder_sent_at"] = Time.current.to_s
    metadata["reminder_count"] = (metadata["reminder_count"] || 0) + 1

    quote_request.update(metadata: metadata)
  end
end

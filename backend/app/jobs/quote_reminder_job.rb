class QuoteReminderJob < ApplicationJob
  queue_as :default

  # Send reminders to suppliers who haven't responded to quote requests
  def perform(quote_request_id = nil, contact_ids = nil)
    if quote_request_id
      # Send reminders for specific quote request
      send_reminders_for_quote_request(quote_request_id, contact_ids)
    else
      # Send reminders for all pending quote requests
      send_all_reminders
    end
  end

  private

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
      if send_reminder(quote_request, contact)
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
    reminder_threshold = 24.hours.ago # Send reminder if no response after 24 hours

    quote_requests = QuoteRequest.where(status: 'pending_response')
                                .where('created_at < ?', reminder_threshold)

    Rails.logger.info("Checking #{quote_requests.count} quote requests for reminders")

    total_reminders = 0

    quote_requests.each do |quote_request|
      # Check if reminder was already sent recently
      next if reminder_sent_recently?(quote_request)

      invited_contact_ids = quote_request.contacts.pluck(:id)
      responded_contact_ids = quote_request.quote_responses.pluck(:contact_id)
      non_responded_contact_ids = invited_contact_ids - responded_contact_ids

      next if non_responded_contact_ids.empty?

      contacts = Contact.where(id: non_responded_contact_ids)

      contacts.each do |contact|
        if send_reminder(quote_request, contact)
          total_reminders += 1
        end
      end

      # Mark reminder as sent
      mark_reminder_sent(quote_request)
    end

    Rails.logger.info("Total reminders sent: #{total_reminders}")
  end

  def send_reminder(quote_request, contact)
    # Calculate how long the quote has been waiting
    hours_waiting = ((Time.current - quote_request.created_at) / 1.hour).round

    # Send email
    if contact.email.present?
      # TODO: SubcontractorMailer.quote_reminder(quote_request, contact, hours_waiting).deliver_now
      Rails.logger.info("Reminder email sent to #{contact.email} for quote request ##{quote_request.id}")
    end

    # Send SMS if urgent (more than 48 hours old) and phone available
    if hours_waiting > 48 && contact.phone.present? && twilio_configured?
      send_sms_reminder(quote_request, contact, hours_waiting)
    end

    true
  rescue => e
    Rails.logger.error("Failed to send reminder to contact ##{contact.id}: #{e.message}")
    false
  end

  def send_sms_reminder(quote_request, contact, hours_waiting)
    message = "REMINDER: Quote request from #{quote_request.construction.business_name || 'Builder'}\n" \
              "Waiting #{hours_waiting} hours for response\n" \
              "Job: #{quote_request.construction.job_name}\n" \
              "Login to respond: #{portal_url}"

    # TODO: Implement Twilio SMS sending
    # TwilioService.send_sms(
    #   to: contact.phone,
    #   body: message
    # )

    Rails.logger.info("Reminder SMS sent to #{contact.phone} for quote request ##{quote_request.id}")
  end

  def reminder_sent_recently?(quote_request)
    # Check if reminder was sent in last 24 hours
    metadata = quote_request.metadata || {}
    last_reminder = metadata['last_reminder_sent_at']

    return false unless last_reminder

    Time.parse(last_reminder) > 24.hours.ago
  rescue
    false
  end

  def mark_reminder_sent(quote_request)
    metadata = quote_request.metadata || {}
    metadata['last_reminder_sent_at'] = Time.current.to_s
    metadata['reminder_count'] = (metadata['reminder_count'] || 0) + 1

    quote_request.update(metadata: metadata)
  end

  def twilio_configured?
    ENV['TWILIO_ACCOUNT_SID'].present? && ENV['TWILIO_AUTH_TOKEN'].present?
  end

  def portal_url
    ENV['PORTAL_URL'] || 'https://portal.trapid.com'
  end
end

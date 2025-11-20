class QuoteRequestNotificationJob < ApplicationJob
  queue_as :default

  def perform(quote_request_id, contact_ids = nil)
    quote_request = QuoteRequest.find(quote_request_id)

    # Determine which contacts to notify
    contacts = if contact_ids.present?
                Contact.where(id: contact_ids)
              else
                quote_request.contacts
              end

    contacts.each do |contact|
      send_notification(quote_request, contact)
    end
  end

  private

  def send_notification(quote_request, contact)
    # Update notification timestamp
    qrc = quote_request.quote_request_contacts.find_by(contact: contact)

    # Send email if contact has email
    if contact.email.present?
      # TODO: SubcontractorMailer.quote_request_notification(quote_request, contact).deliver_now
      qrc&.update(notified_at: Time.current, notification_method: 'email')
      Rails.logger.info("Email notification sent to #{contact.email} for quote request ##{quote_request.id}")
    end

    # Send SMS if contact has phone and Twilio is configured
    if contact.phone.present? && twilio_configured?
      send_sms_notification(quote_request, contact)
      qrc&.update(
        notified_at: Time.current,
        notification_method: qrc&.notification_method == 'email' ? 'email_and_sms' : 'sms'
      )
    end
  rescue => e
    Rails.logger.error("Failed to send notification to contact ##{contact.id}: #{e.message}")
    # Don't raise - continue with other contacts
  end

  def send_sms_notification(quote_request, contact)
    message = "New Quote Request from #{quote_request.construction.business_name || 'Builder'}\n" \
              "Job: #{quote_request.construction.job_name}\n" \
              "Trade: #{quote_request.trade_category}\n" \
              "Login to view details: #{portal_url}"

    # TODO: Implement Twilio SMS sending
    # TwilioService.send_sms(
    #   to: contact.phone,
    #   body: message
    # )

    Rails.logger.info("SMS notification sent to #{contact.phone} for quote request ##{quote_request.id}")
  end

  def twilio_configured?
    ENV['TWILIO_ACCOUNT_SID'].present? && ENV['TWILIO_AUTH_TOKEN'].present?
  end

  def portal_url
    ENV['PORTAL_URL'] || 'https://portal.trapid.com'
  end
end

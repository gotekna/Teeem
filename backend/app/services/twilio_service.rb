class TwilioService
  class << self
    def send_sms(to:, body:, contact:, user: nil)
      settings = CorporateCompanySetting.first

      unless settings&.twilio_enabled?
        return { success: false, error: "Twilio is not configured. Please configure Twilio in Settings." }
      end

      unless settings.twilio_account_sid.present? && settings.twilio_auth_token.present? && settings.twilio_phone_number.present?
        return { success: false, error: "Twilio credentials are incomplete. Please check your settings." }
      end

      begin
        client = Twilio::REST::Client.new(settings.twilio_account_sid, settings.twilio_auth_token)

        message = client.messages.create(
          from: settings.twilio_phone_number,
          to: normalize_phone_number(to),
          body: body
        )

        sms = SmsMessage.create!(
          contact: contact,
          user: user,
          from_phone: settings.twilio_phone_number,
          to_phone: to,
          body: body,
          direction: "outbound",
          status: message.status,
          twilio_sid: message.sid,
          sent_at: Time.current
        )

        { success: true, sms: sms, twilio_message: message }
      rescue Twilio::REST::RestError => e
        Rails.logger.error "Twilio error: #{e.message}"

        sms = SmsMessage.create(
          contact: contact,
          user: user,
          from_phone: settings.twilio_phone_number,
          to_phone: to,
          body: body,
          direction: "outbound",
          status: "failed",
          error_message: e.message,
          sent_at: Time.current
        )

        { success: false, error: e.message, sms: sms }
      rescue => e
        Rails.logger.error "Unexpected error sending SMS: #{e.message}"
        { success: false, error: "Failed to send SMS: #{e.message}" }
      end
    end

    def process_incoming_sms(params)
      # Twilio webhook parameters
      from_phone = params[:From]
      to_phone = params[:To]
      body = params[:Body]
      message_sid = params[:MessageSid]

      # Find contact by phone number
      contact = find_contact_by_phone(from_phone)

      unless contact
        Rails.logger.warn "Received SMS from unknown number: #{from_phone}"
        return { success: false, error: "Contact not found for this phone number" }
      end

      sms = SmsMessage.create!(
        contact: contact,
        from_phone: from_phone,
        to_phone: to_phone,
        body: body,
        direction: "inbound",
        status: "received",
        twilio_sid: message_sid,
        received_at: Time.current
      )

      { success: true, sms: sms }
    rescue => e
      Rails.logger.error "Error processing incoming SMS: #{e.message}"
      { success: false, error: e.message }
    end

    def update_message_status(message_sid, status)
      sms = SmsMessage.find_by(twilio_sid: message_sid)
      return unless sms

      sms.update(status: status)
    end

    def test_connection
      settings = CorporateCompanySetting.first

      unless settings&.twilio_enabled?
        return { success: false, error: "Twilio is not enabled" }
      end

      unless settings.twilio_account_sid.present? && settings.twilio_auth_token.present?
        return { success: false, error: "Twilio credentials are missing" }
      end

      begin
        client = Twilio::REST::Client.new(settings.twilio_account_sid, settings.twilio_auth_token)
        account = client.api.accounts(settings.twilio_account_sid).fetch

        {
          success: true,
          account: {
            friendly_name: account.friendly_name,
            status: account.status,
            type: account.type
          }
        }
      rescue Twilio::REST::RestError => e
        { success: false, error: e.message }
      rescue => e
        { success: false, error: "Connection test failed: #{e.message}" }
      end
    end

    private

    def find_contact_by_phone(phone_number)
      normalized = normalize_phone_number(phone_number)

      # Try exact match first
      contact = Contact.find_by(mobile_phone: normalized) ||
                Contact.find_by(office_phone: normalized)

      return contact if contact

      # Try partial match (last 9 digits for Australian numbers)
      last_digits = normalized.gsub(/\D/, "").last(9)

      Contact.where("mobile_phone LIKE ? OR office_phone LIKE ?", "%#{last_digits}", "%#{last_digits}").first
    end

    def normalize_phone_number(phone)
      return phone unless phone

      # Remove all non-digit characters
      digits = phone.gsub(/\D/, "")

      # Convert Australian numbers to +61 format
      if digits.length == 10 && digits.start_with?("04")
        # 0412345678 -> +61412345678
        "+61#{digits[1..]}"
      elsif digits.length == 11 && digits.start_with?("614")
        # 61412345678 -> +61412345678
        "+#{digits}"
      elsif digits.start_with?("61")
        # Assume it's already in correct format
        "+#{digits}"
      else
        # Return as-is if not Australian format
        phone
      end
    end
  end
end

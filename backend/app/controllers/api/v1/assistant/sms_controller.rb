# frozen_string_literal: true

# SMS webhook controller for TEEEM AI Assistant (Phase 2)
#
# Intercepts inbound SMS that are directed to the TEEEM assistant
# (vs regular contact SMS handled by SmsMessagesController).
# Routes to AssistantService and replies via Twilio SMS.
#
# If the sender is a known TEEEM user, route to AssistantService.
# If the sender is a known contact (not a user), route to regular SMS handler.
#
module Api
  module V1
    module Assistant
      class SmsController < ApplicationController
        skip_before_action :authorize_request, only: [:webhook, :status_webhook]

        # POST /api/v1/assistant/sms/webhook
        # Twilio SMS inbound webhook (assistant-routed)
        def webhook
          from_number = params[:From]
          to_number = params[:To]
          body = params[:Body]
          message_sid = params[:MessageSid]

          Rails.logger.info "[AssistantSMS] Inbound from #{from_number}: #{body&.truncate(100)}"

          # Validate Twilio signature
          unless valid_twilio_signature?
            Rails.logger.warn "[AssistantSMS] Invalid Twilio signature"
            return head :forbidden
          end

          # Find user by phone number
          user = find_user_by_phone(from_number)

          if user
            handle_assistant_message(user, from_number, body, message_sid)
          else
            # Not a TEEEM user - fall through to regular SMS processing
            TwilioService.process_incoming_sms(params)
            render xml: twiml_response, content_type: "text/xml"
          end
        rescue StandardError => e
          Rails.logger.error "[AssistantSMS] Error: #{e.message}"
          respond_twiml("Sorry, I encountered an error. Please try again.")
        end

        # POST /api/v1/assistant/sms/status
        def status_webhook
          TwilioService.update_message_status(params[:MessageSid], params[:MessageStatus])
          render xml: twiml_response, content_type: "text/xml"
        end

        private

        def handle_assistant_message(user, from_number, body, message_sid)
          return respond_twiml("Please send a message.") if body.blank?

          ActsAsTenant.with_tenant(user.tenant) do
            conversation = AssistantConversation.find_or_create_active(
              user: user,
              channel: "sms"
            )

            service = AssistantService.new(user: user, tenant: user.tenant)
            result = service.chat(message: body, conversation: conversation)

            # Log metadata
            conversation.update(
              metadata: (conversation.metadata || {}).merge(
                last_sms_from: from_number,
                last_sms_sid: message_sid
              )
            )

            # Send response via SMS
            send_sms_reply(from_number, result[:content])

            # Notify about pending actions
            if result[:actions].any?
              send_sms_reply(
                from_number,
                "Actions pending your approval in TEEEM app: #{result[:actions].map(&:description).join(', ')}"
              )
            end
          end

          render xml: twiml_response, content_type: "text/xml"
        end

        def send_sms_reply(to_number, message)
          settings = TenantSetting.instance
          return unless settings&.twilio_enabled?

          client = Twilio::REST::Client.new(
            settings.twilio_account_sid,
            settings.twilio_auth_token
          )

          # SMS has 1600 char limit (Twilio auto-segments, but be mindful)
          client.messages.create(
            from: settings.twilio_phone_number,
            to: to_number,
            body: message.truncate(1500)
          )
        rescue Twilio::REST::RestError => e
          Rails.logger.error "[AssistantSMS] Send error: #{e.message}"
        end

        def find_user_by_phone(phone)
          normalized = TwilioService.send(:normalize_phone_number, phone)
          last_digits = normalized.gsub(/\D/, "").last(9)
          User.where("mobile_phone LIKE ? OR phone LIKE ?", "%#{last_digits}", "%#{last_digits}").first
        end

        def valid_twilio_signature?
          return true if Rails.env.development? || Rails.env.test?

          settings = TenantSetting.instance
          return false unless settings&.twilio_auth_token.present?

          validator = Twilio::Security::RequestValidator.new(settings.twilio_auth_token)
          url = request.original_url
          signature = request.headers["X-Twilio-Signature"] || ""

          validator.validate(url, params.to_unsafe_h.except(:controller, :action), signature)
        end

        def respond_twiml(message)
          render xml: <<~XML, content_type: "text/xml"
            <?xml version="1.0" encoding="UTF-8"?>
            <Response>
              <Message>#{ERB::Util.html_escape(message)}</Message>
            </Response>
          XML
        end

        def twiml_response
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
        end
      end
    end
  end
end

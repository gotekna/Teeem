# frozen_string_literal: true

# WhatsApp webhook controller for TEEEM AI Assistant (Phase 2)
#
# Receives inbound WhatsApp messages via Twilio WhatsApp API.
# Routes messages to AssistantService for AI processing.
# Responds back via Twilio WhatsApp.
#
# Twilio WhatsApp webhook URL: POST /api/v1/assistant/whatsapp/webhook
#
module Api
  module V1
    module Assistant
      class WhatsappController < ApplicationController
        # Twilio webhooks don't include our auth token
        skip_before_action :authorize_request, only: [:webhook, :status_webhook]

        # POST /api/v1/assistant/whatsapp/webhook
        # Twilio WhatsApp inbound message webhook
        def webhook
          from_number = params[:From]&.gsub("whatsapp:", "")
          to_number = params[:To]&.gsub("whatsapp:", "")
          body = params[:Body]
          message_sid = params[:MessageSid]
          num_media = params[:NumMedia].to_i

          Rails.logger.info "[AssistantWhatsApp] Inbound from #{from_number}: #{body&.truncate(100)}"

          # Validate Twilio signature
          unless valid_twilio_signature?
            Rails.logger.warn "[AssistantWhatsApp] Invalid Twilio signature"
            return head :forbidden
          end

          # Find user by phone number
          user = find_user_by_phone(from_number)
          unless user
            Rails.logger.warn "[AssistantWhatsApp] Unknown phone: #{from_number}"
            return respond_twiml("Sorry, this number isn't registered with TEEEM. Please contact your admin.")
          end

          # Handle voice notes (media with audio content type)
          if num_media > 0 && voice_note?(params)
            handle_voice_note(user, from_number, params)
          else
            handle_text_message(user, from_number, body, message_sid)
          end
        rescue StandardError => e
          Rails.logger.error "[AssistantWhatsApp] Error: #{e.message}"
          respond_twiml("Sorry, I encountered an error. Please try again.")
        end

        # POST /api/v1/assistant/whatsapp/status
        # Twilio WhatsApp delivery status webhook
        def status_webhook
          message_sid = params[:MessageSid]
          status = params[:MessageStatus]

          Rails.logger.info "[AssistantWhatsApp] Status update: #{message_sid} → #{status}"

          render xml: twiml_response, content_type: "text/xml"
        end

        private

        def handle_text_message(user, from_number, body, message_sid)
          return respond_twiml("Please send a message.") if body.blank?

          ActsAsTenant.with_tenant(user.tenant) do
            conversation = AssistantConversation.find_or_create_active(
              user: user,
              channel: "whatsapp"
            )

            service = AssistantService.new(user: user, tenant: user.tenant)
            result = service.chat(message: body, conversation: conversation)

            # Log inbound message metadata
            conversation.update(
              metadata: (conversation.metadata || {}).merge(
                last_whatsapp_from: from_number,
                last_whatsapp_sid: message_sid
              )
            )

            # Send response back via WhatsApp
            send_whatsapp_reply(from_number, result[:content])

            # If there are pending actions, notify the user
            if result[:actions].any?
              action_summary = result[:actions].map { |a| "- #{a.description}" }.join("\n")
              send_whatsapp_reply(
                from_number,
                "I've prepared some actions for your approval. Please review in the TEEEM app:\n#{action_summary}"
              )
            end
          end

          render xml: twiml_response, content_type: "text/xml"
        end

        def handle_voice_note(user, from_number, webhook_params)
          media_url = webhook_params[:MediaUrl0]
          media_content_type = webhook_params[:MediaContentType0]

          unless media_url
            return respond_twiml("I couldn't process that voice note. Please try again.")
          end

          ActsAsTenant.with_tenant(user.tenant) do
            # Transcribe the voice note using Deepgram
            transcript = DeepgramTranscriptionService.transcribe_url(
              url: media_url,
              content_type: media_content_type || "audio/ogg"
            )

            if transcript.blank?
              return respond_twiml("I couldn't understand that voice note. Could you try again or type your message?")
            end

            # Process the transcribed message
            conversation = AssistantConversation.find_or_create_active(
              user: user,
              channel: "whatsapp"
            )

            service = AssistantService.new(user: user, tenant: user.tenant)
            result = service.chat(message: transcript, conversation: conversation)

            # Add voice metadata
            conversation.add_user_message(
              transcript,
              content_type: "voice_transcript",
              metadata: { original_media_url: media_url, media_content_type: media_content_type }
            )

            send_whatsapp_reply(from_number, result[:content])
          end

          render xml: twiml_response, content_type: "text/xml"
        end

        def send_whatsapp_reply(to_number, message)
          settings = TenantSetting.instance
          return unless settings&.twilio_enabled?

          client = Twilio::REST::Client.new(
            settings.twilio_account_sid,
            settings.twilio_auth_token
          )

          # Twilio WhatsApp requires "whatsapp:" prefix
          from = "whatsapp:#{settings.twilio_phone_number}"
          to = "whatsapp:#{to_number}"

          # WhatsApp messages have a 4096 char limit
          message.truncate(4000).scan(/.{1,4000}/m).each do |chunk|
            client.messages.create(
              from: from,
              to: to,
              body: chunk
            )
          end
        rescue Twilio::REST::RestError => e
          Rails.logger.error "[AssistantWhatsApp] Send error: #{e.message}"
        end

        def voice_note?(webhook_params)
          content_type = webhook_params[:MediaContentType0]
          return false unless content_type

          content_type.start_with?("audio/") || content_type == "application/ogg"
        end

        def find_user_by_phone(phone)
          normalized = TwilioService.send(:normalize_phone_number, phone)
          last_digits = normalized.gsub(/\D/, "").last(9)

          # Try to find user by mobile phone
          User.where("mobile_phone LIKE ? OR phone LIKE ?", "%#{last_digits}", "%#{last_digits}").first
        end

        def valid_twilio_signature?
          # In development, skip validation
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

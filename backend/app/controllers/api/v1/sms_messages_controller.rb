module Api
  module V1
    class SmsMessagesController < ApplicationController
      before_action :set_contact, only: [ :index, :create ]

      # GET /api/v1/contacts/:contact_id/sms_messages
      def index
        messages = @contact.sms_messages.recent

        render json: {
          success: true,
          sms_messages: messages.as_json(include: :user)
        }
      end

      # POST /api/v1/contacts/:contact_id/sms_messages
      def create
        unless params[:body].present?
          return render json: { success: false, error: "Message body is required" }, status: :unprocessable_entity
        end

        # SSoT: Use primary_mobile from contact_phones table
        to_phone = params[:to_phone] || @contact.primary_mobile

        unless to_phone.present?
          return render json: { success: false, error: "No phone number available for this contact" }, status: :unprocessable_entity
        end

        result = TwilioService.send_sms(
          to: to_phone,
          body: params[:body],
          contact: @contact,
          user: current_user
        )

        if result[:success]
          render json: {
            success: true,
            sms_message: result[:sms].as_json(include: :user)
          }
        else
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sms/webhook
      # Twilio webhook for incoming SMS
      def webhook
        result = TwilioService.process_incoming_sms(params)

        if result[:success]
          # Respond with TwiML (Twilio Markup Language)
          render xml: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>', content_type: "text/xml"
        else
          render xml: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>', content_type: "text/xml", status: :ok
        end
      end

      # POST /api/v1/sms/status
      # Twilio webhook for message status updates
      def status_webhook
        message_sid = params[:MessageSid]
        status = params[:MessageStatus]

        TwilioService.update_message_status(message_sid, status) if message_sid && status

        render xml: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>', content_type: "text/xml"
      end

      private

      def set_contact
        @contact = Contact.find(params[:contact_id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end
    end
  end
end

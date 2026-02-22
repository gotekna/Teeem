# frozen_string_literal: true

# SignalPollJob - Poll for incoming Signal messages (Phase 4)
#
# Signal has no webhook API. This job polls signal-cli every 30 seconds
# for new messages and routes them to AssistantService.
#
# Only runs if Signal is configured (SIGNAL_CLI_PATH + SIGNAL_PHONE_NUMBER).
#
class SignalPollJob < ApplicationJob
  queue_as :low

  def perform
    unless SignalIntegrationService.configured?
      Rails.logger.debug "[SignalPoll] Signal not configured, skipping"
      return
    end

    messages = SignalIntegrationService.receive_messages
    return if messages.empty?

    Rails.logger.info "[SignalPoll] Processing #{messages.size} message(s)"

    messages.each do |msg|
      process_message(msg)
    rescue StandardError => e
      Rails.logger.error "[SignalPoll] Error processing message from #{msg[:from]}: #{e.message}"
    end
  end

  private

  def process_message(msg)
    from_number = msg[:from]
    body = msg[:body]

    # Find user by phone number
    user = find_user_by_phone(from_number)
    unless user
      Rails.logger.info "[SignalPoll] Message from unknown number: #{from_number}"
      SignalIntegrationService.send_message(
        to: from_number,
        message: "This number isn't registered with TEEEM. Please contact your admin."
      )
      return
    end

    ActsAsTenant.with_tenant(user.tenant) do
      # Handle voice notes
      voice_attachment = msg[:attachments]&.find { |a| a[:is_voice_note] }
      if voice_attachment && body.blank?
        handle_voice_note(user, from_number, voice_attachment)
        return
      end

      return if body.blank?

      conversation = AssistantConversation.find_or_create_active(
        user: user,
        channel: "signal"
      )

      service = AssistantService.new(user: user, tenant: user.tenant)
      result = service.chat(message: body, conversation: conversation)

      # Send response back via Signal
      SignalIntegrationService.send_message(
        to: from_number,
        message: result[:content]
      )

      # Notify about pending actions
      if result[:actions].any?
        action_summary = result[:actions].map { |a| "- #{a.description}" }.join("\n")
        SignalIntegrationService.send_message(
          to: from_number,
          message: "Actions pending your approval in TEEEM:\n#{action_summary}"
        )
      end
    end
  end

  def handle_voice_note(user, from_number, attachment)
    # Download and transcribe the voice note
    file_path = SignalIntegrationService.download_attachment(attachment[:id])
    unless file_path && File.exist?(file_path)
      SignalIntegrationService.send_message(
        to: from_number,
        message: "I couldn't process that voice note. Please try again or type your message."
      )
      return
    end

    content = File.binread(file_path)
    transcript = DeepgramTranscriptionService.transcribe(
      content: content,
      content_type: attachment[:content_type] || "audio/mp4"
    )

    unless transcript.present?
      SignalIntegrationService.send_message(
        to: from_number,
        message: "I couldn't understand that voice note. Could you type your message instead?"
      )
      return
    end

    conversation = AssistantConversation.find_or_create_active(
      user: user,
      channel: "signal"
    )

    service = AssistantService.new(user: user, tenant: user.tenant)
    result = service.chat(message: transcript, conversation: conversation)

    SignalIntegrationService.send_message(
      to: from_number,
      message: result[:content]
    )
  ensure
    File.delete(file_path) if file_path && File.exist?(file_path)
  end

  def find_user_by_phone(phone)
    normalized = TwilioService.send(:normalize_phone_number, phone)
    last_digits = normalized.gsub(/\D/, "").last(9)
    User.where("mobile_phone LIKE ? OR phone LIKE ?", "%#{last_digits}", "%#{last_digits}").first
  end
end

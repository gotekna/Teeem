# frozen_string_literal: true

# SlackCommandJob - Process /teeem slash commands asynchronously (Phase 3)
#
# Slack slash commands must be acknowledged within 3 seconds.
# The actual AI processing happens here, and the response is sent
# back via the response_url.
#
class SlackCommandJob < ApplicationJob
  queue_as :default

  def perform(user_id:, text:, channel_id:, response_url:)
    user = User.find(user_id)

    ActsAsTenant.with_tenant(user.tenant) do
      conversation = AssistantConversation.find_or_create_active(
        user: user,
        channel: "slack"
      )

      service = AssistantService.new(user: user, tenant: user.tenant)
      result = service.chat(message: text, conversation: conversation)

      response_text = result[:content]
      if result[:actions].any?
        response_text += "\n\n_#{result[:actions].size} action(s) pending approval in the TEEEM app._"
      end

      # Send response back to Slack
      SlackIntegrationService.send_response(
        response_url: response_url,
        text: response_text,
        response_type: "ephemeral"
      )
    end
  rescue StandardError => e
    Rails.logger.error "[SlackCommandJob] Error: #{e.message}"

    if response_url.present?
      SlackIntegrationService.send_response(
        response_url: response_url,
        text: "Sorry, I encountered an error processing your request."
      )
    end
  end
end

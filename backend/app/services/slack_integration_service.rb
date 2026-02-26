# frozen_string_literal: true

# SlackIntegrationService - Slack integration for TEEEM AI Assistant (Phase 3)
#
# Handles Slack events, slash commands, and bot mentions.
# Routes messages to AssistantService and sends responses back to Slack.
#
# Setup:
#   1. Create Slack App at https://api.slack.com/apps
#   2. Set Bot Token scopes: chat:write, commands, app_mentions:read, channels:history, im:history
#   3. Set Event Subscriptions URL: https://your-api/api/v1/assistant/slack/events
#   4. Set Slash Command URL: https://your-api/api/v1/assistant/slack/command
#   5. Store SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET in env vars
#
# Usage:
#   SlackIntegrationService.handle_event(event_data)
#   SlackIntegrationService.handle_slash_command(command_data)
#   SlackIntegrationService.send_message(channel_id: "C123", text: "Hello")
#
class SlackIntegrationService
  SLACK_API_BASE = "https://slack.com/api"

  class << self
    # Handle a Slack event (app_mention, message, etc.)
    def handle_event(event)
      event_type = event["type"]
      Rails.logger.info "[Slack] Event: #{event_type}"

      case event_type
      when "app_mention"
        handle_mention(event)
      when "message"
        handle_direct_message(event) if event["channel_type"] == "im"
      end
    end

    # Handle /teeem slash command
    def handle_slash_command(params)
      text = params[:text]
      user_id = params[:user_id]
      channel_id = params[:channel_id]
      response_url = params[:response_url]

      Rails.logger.info "[Slack] Command from #{user_id}: #{text&.truncate(100)}"

      return { text: "Please include a message. Usage: `/teeem What's due this week?`" } if text.blank?

      user = find_user_by_slack_id(user_id)
      unless user
        return { text: "Your Slack account isn't linked to TEEEM. Please link it in Settings > Connections." }
      end

      # Process asynchronously since Slack expects response within 3 seconds
      SlackCommandJob.perform_later(
        user_id: user.id,
        text: text,
        channel_id: channel_id,
        response_url: response_url
      )

      # Immediate acknowledgment
      {
        response_type: "ephemeral",
        text: "Processing your request..."
      }
    end

    # Send a message to a Slack channel or DM
    def send_message(channel_id:, text:, blocks: nil, thread_ts: nil)
      bot_token = resolve_bot_token
      unless bot_token.present?
        Rails.logger.warn "[Slack] SLACK_BOT_TOKEN not configured (checked TenantSetting + ENV)"
        return nil
      end

      payload = {
        channel: channel_id,
        text: text
      }
      payload[:blocks] = blocks if blocks
      payload[:thread_ts] = thread_ts if thread_ts

      response = HTTParty.post(
        "#{SLACK_API_BASE}/chat.postMessage",
        headers: {
          "Authorization" => "Bearer #{bot_token}",
          "Content-Type" => "application/json"
        },
        body: payload.to_json,
        timeout: 10
      )

      data = JSON.parse(response.body)
      unless data["ok"]
        Rails.logger.error "[Slack] Send message failed: #{data['error']}"
        return nil
      end

      data
    rescue StandardError => e
      Rails.logger.error "[Slack] Send error: #{e.message}"
      nil
    end

    # Send a response to a slash command response_url
    def send_response(response_url:, text:, response_type: "ephemeral")
      HTTParty.post(
        response_url,
        headers: { "Content-Type" => "application/json" },
        body: { response_type: response_type, text: text }.to_json,
        timeout: 10
      )
    rescue StandardError => e
      Rails.logger.error "[Slack] Response URL error: #{e.message}"
    end

    # Verify Slack request signature
    def valid_signature?(request)
      return true if Rails.env.development? || Rails.env.test?

      signing_secret = resolve_signing_secret
      return false unless signing_secret.present?

      timestamp = request.headers["X-Slack-Request-Timestamp"]
      signature = request.headers["X-Slack-Signature"]

      return false unless timestamp && signature

      # Prevent replay attacks (5 min window)
      return false if (Time.current.to_i - timestamp.to_i).abs > 300

      body = request.body.read
      request.body.rewind

      sig_basestring = "v0:#{timestamp}:#{body}"
      my_sig = "v0=#{OpenSSL::HMAC.hexdigest('SHA256', signing_secret, sig_basestring)}"

      ActiveSupport::SecurityUtils.secure_compare(my_sig, signature)
    end

    # Monitor a Slack channel for action items and commitments
    def analyze_channel_message(event)
      text = event["text"]
      return unless text.present?

      # Quick check for action-like keywords before spending AI tokens
      action_keywords = /\b(need to|must|should|will|please|asap|urgent|deadline|by \w+day|tomorrow|next week)\b/i
      return unless text.match?(action_keywords)

      user = find_user_by_slack_id(event["user"])
      return unless user

      # Use Haiku (cheap) for quick classification
      ActsAsTenant.with_tenant(user.tenant) do
        service = AssistantService.new(user: user, tenant: user.tenant)
        # This is monitoring - don't create a conversation, just check for action items
        Rails.logger.info "[Slack] Detected potential action item from #{user.name}: #{text.truncate(100)}"
      end
    end

    # Check if Slack is configured
    def configured?
      resolve_bot_token.present? && resolve_signing_secret.present?
    end

    private

    # Resolve bot token: TenantSetting (per-tenant) → ENV (platform-level)
    def resolve_bot_token
      tenant_token = begin
        TenantSetting.instance&.slack_bot_token
      rescue StandardError
        nil
      end
      tenant_token.presence || ENV["SLACK_BOT_TOKEN"]
    end

    # Resolve signing secret: TenantSetting (per-tenant) → ENV (platform-level)
    def resolve_signing_secret
      tenant_secret = begin
        TenantSetting.instance&.slack_signing_secret
      rescue StandardError
        nil
      end
      tenant_secret.presence || ENV["SLACK_SIGNING_SECRET"]
    end

    def handle_mention(event)
      text = event["text"]&.gsub(/<@\w+>/, "")&.strip
      channel_id = event["channel"]
      thread_ts = event["thread_ts"] || event["ts"]
      slack_user_id = event["user"]

      return if text.blank?

      user = find_user_by_slack_id(slack_user_id)
      unless user
        send_message(
          channel_id: channel_id,
          text: "I don't recognize your Slack account. Please link it in TEEEM Settings > Connections.",
          thread_ts: thread_ts
        )
        return
      end

      ActsAsTenant.with_tenant(user.tenant) do
        conversation = AssistantConversation.find_or_create_active(
          user: user,
          channel: "slack"
        )

        service = AssistantService.new(user: user, tenant: user.tenant)
        result = service.chat(message: text, conversation: conversation)

        # Reply in thread
        response_text = result[:content]
        if result[:actions].any?
          response_text += "\n\n_#{result[:actions].size} action(s) pending your approval in the TEEEM app._"
        end

        send_message(
          channel_id: channel_id,
          text: response_text,
          thread_ts: thread_ts
        )
      end
    end

    def handle_direct_message(event)
      # Ignore bot's own messages
      return if event["bot_id"].present?

      text = event["text"]
      channel_id = event["channel"]
      slack_user_id = event["user"]

      return if text.blank?

      user = find_user_by_slack_id(slack_user_id)
      unless user
        send_message(channel_id: channel_id, text: "Please link your Slack account in TEEEM Settings.")
        return
      end

      ActsAsTenant.with_tenant(user.tenant) do
        conversation = AssistantConversation.find_or_create_active(
          user: user,
          channel: "slack"
        )

        service = AssistantService.new(user: user, tenant: user.tenant)
        result = service.chat(message: text, conversation: conversation)

        response_text = result[:content]
        if result[:actions].any?
          response_text += "\n\n_#{result[:actions].size} action(s) pending approval in TEEEM._"
        end

        send_message(channel_id: channel_id, text: response_text)
      end
    end

    def find_user_by_slack_id(slack_user_id)
      return nil unless slack_user_id.present?

      # Look up user by slack_user_id field
      User.find_by(slack_user_id: slack_user_id)
    end
  end
end

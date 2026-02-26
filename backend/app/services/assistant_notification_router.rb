# frozen_string_literal: true

# AssistantNotificationRouter - Routes alerts to user's preferred channel (Phase 5)
#
# When the monitor job detects something requiring attention, this service
# sends the alert to the user's preferred notification channel(s).
#
# Channels:
#   - web: In-app alert (always, default)
#   - whatsapp: WhatsApp message via Twilio
#   - sms: SMS via Twilio
#   - slack: Slack DM via bot
#   - signal: Signal message via signal-cli
#   - email: Email notification (not implemented yet)
#
# User preferences stored in user.assistant_preferences JSONB:
#   {
#     "notification_channels": ["web", "whatsapp"],
#     "quiet_hours": { "start": "21:00", "end": "07:00" },
#     "priority_threshold": "medium",
#     "autopilot_enabled": false,
#     "autopilot_actions": ["mark_task_started"]
#   }
#
class AssistantNotificationRouter
  PRIORITY_LEVELS = { "low" => 0, "medium" => 1, "high" => 2, "critical" => 3 }.freeze

  def initialize(user:)
    @user = user
    @preferences = (user.respond_to?(:assistant_preferences) ? user.assistant_preferences : nil) || {}
  end

  # Route an alert to the user's preferred channels
  #
  # @param alert [AssistantAlert] The alert to route
  def route_alert(alert)
    return unless should_notify?(alert)

    channels = notification_channels
    Rails.logger.info "[NotificationRouter] Routing alert ##{alert.id} (#{alert.priority}) to: #{channels.join(', ')}"

    channels.each do |channel|
      send_to_channel(channel, alert)
    rescue StandardError => e
      Rails.logger.error "[NotificationRouter] Failed to send to #{channel}: #{e.message}"
    end
  end

  # Check if autopilot should handle this action automatically
  #
  # @param action_type [String] The type of action
  # @return [Boolean] true if autopilot should handle it
  def autopilot_enabled_for?(action_type)
    return false unless @preferences["autopilot_enabled"]

    allowed = @preferences["autopilot_actions"] || []
    allowed.include?(action_type)
  end

  private

  def notification_channels
    channels = @preferences["notification_channels"] || ["web"]
    channels = ["web"] if channels.empty?

    # Always include web
    channels.unshift("web") unless channels.include?("web")
    channels.uniq
  end

  def should_notify?(alert)
    # Check priority threshold
    threshold = @preferences["priority_threshold"] || "low"
    alert_level = PRIORITY_LEVELS[alert.priority] || 0
    threshold_level = PRIORITY_LEVELS[threshold] || 0

    return false if alert_level < threshold_level

    # Check quiet hours
    return false if in_quiet_hours?

    true
  end

  def in_quiet_hours?
    quiet = @preferences["quiet_hours"]
    return false unless quiet && quiet["start"] && quiet["end"]

    now = Time.current.in_time_zone("Australia/Brisbane")
    start_time = Time.parse(quiet["start"])
    end_time = Time.parse(quiet["end"])

    if start_time > end_time
      # Overnight quiet hours (e.g., 21:00 - 07:00)
      now.strftime("%H:%M") >= quiet["start"] || now.strftime("%H:%M") < quiet["end"]
    else
      now.strftime("%H:%M") >= quiet["start"] && now.strftime("%H:%M") < quiet["end"]
    end
  end

  def send_to_channel(channel, alert)
    message = format_alert_message(alert)

    case channel
    when "web"
      # Already created as AssistantAlert - nothing to do
      nil
    when "whatsapp"
      send_whatsapp(message)
    when "sms"
      send_sms(message)
    when "slack"
      send_slack(message)
    when "signal"
      send_signal(message)
    end
  end

  def format_alert_message(alert)
    priority_emoji = { "critical" => "!!!", "high" => "!!", "medium" => "!", "low" => "" }
    prefix = priority_emoji[alert.priority] || ""

    "#{prefix} #{alert.title}\n#{alert.summary}".strip
  end

  def send_whatsapp(message)
    phone = @user.mobile_phone || @user.phone
    return unless phone.present?

    settings = TenantSetting.instance
    return unless settings&.twilio_enabled?

    client = Twilio::REST::Client.new(settings.twilio_account_sid, settings.twilio_auth_token)
    client.messages.create(
      from: "whatsapp:#{settings.twilio_phone_number}",
      to: "whatsapp:#{TwilioService.send(:normalize_phone_number, phone)}",
      body: message.truncate(4000)
    )
  end

  def send_sms(message)
    phone = @user.mobile_phone || @user.phone
    return unless phone.present?

    settings = TenantSetting.instance
    return unless settings&.twilio_enabled?

    client = Twilio::REST::Client.new(settings.twilio_account_sid, settings.twilio_auth_token)
    client.messages.create(
      from: settings.twilio_phone_number,
      to: TwilioService.send(:normalize_phone_number, phone),
      body: message.truncate(1500)
    )
  end

  def send_slack(message)
    return unless SlackIntegrationService.configured? && @user.slack_user_id.present?

    SlackIntegrationService.send_message(
      channel_id: @user.slack_user_id, # DM to user
      text: message
    )
  end

  def send_signal(message)
    return unless SignalIntegrationService.configured?

    phone = @user.mobile_phone || @user.phone
    return unless phone.present?

    SignalIntegrationService.send_message(
      to: TwilioService.send(:normalize_phone_number, phone),
      message: message
    )
  end
end

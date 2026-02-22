# frozen_string_literal: true

# SignalIntegrationService - Signal messenger integration (Phase 4)
#
# Wraps signal-cli (unofficial Java CLI tool) for Signal messaging.
# Supports sending/receiving text messages and voice notes.
#
# Prerequisites:
#   1. Install signal-cli: https://github.com/AsamK/signal-cli
#   2. Register a phone number: signal-cli -u +61400000000 register
#   3. Verify: signal-cli -u +61400000000 verify CODE
#   4. Set SIGNAL_CLI_PATH and SIGNAL_PHONE_NUMBER env vars
#
# WARNING: Signal has NO official business API. This uses an unofficial tool.
# Signal Foundation could break this at any time.
#
# Usage:
#   SignalIntegrationService.send_message(to: "+61412345678", message: "Hello")
#   messages = SignalIntegrationService.receive_messages
#
class SignalIntegrationService
  DEFAULT_CLI_PATH = "/usr/local/bin/signal-cli"
  RECEIVE_TIMEOUT = 5 # seconds to wait for messages

  class << self
    # Send a text message via Signal
    #
    # @param to [String] Phone number in +61 format
    # @param message [String] Message text
    # @return [Hash] { success: true/false, error: String? }
    def send_message(to:, message:)
      unless configured?
        return { success: false, error: "Signal is not configured" }
      end

      cmd = build_command("send", "-m", message, to)
      stdout, stderr, status = execute_command(cmd)

      if status.success?
        Rails.logger.info "[Signal] Sent message to #{to}: #{message.truncate(50)}"
        { success: true }
      else
        Rails.logger.error "[Signal] Send failed: #{stderr}"
        { success: false, error: stderr.truncate(200) }
      end
    rescue StandardError => e
      Rails.logger.error "[Signal] Send error: #{e.message}"
      { success: false, error: e.message }
    end

    # Receive pending messages from Signal
    #
    # @return [Array<Hash>] Array of received messages
    #   Each: { from: "+61...", timestamp: Time, body: "text", attachments: [...] }
    def receive_messages
      unless configured?
        Rails.logger.warn "[Signal] Not configured, skipping receive"
        return []
      end

      cmd = build_command("receive", "--json", "-t", RECEIVE_TIMEOUT.to_s)
      stdout, stderr, status = execute_command(cmd, timeout: RECEIVE_TIMEOUT + 5)

      unless status.success?
        Rails.logger.error "[Signal] Receive failed: #{stderr}" unless stderr.blank?
        return []
      end

      parse_received_messages(stdout)
    rescue StandardError => e
      Rails.logger.error "[Signal] Receive error: #{e.message}"
      []
    end

    # Send a reaction to a message
    def send_reaction(to:, emoji:, target_timestamp:)
      return unless configured?

      cmd = build_command(
        "sendReaction", "-e", emoji,
        "-a", phone_number,
        "-t", target_timestamp.to_s,
        to
      )
      execute_command(cmd)
    end

    # Download an attachment to a temp file
    #
    # @param attachment_id [String] Signal attachment ID
    # @return [String, nil] Path to downloaded file
    def download_attachment(attachment_id)
      attachments_dir = ENV.fetch("SIGNAL_ATTACHMENTS_DIR", "/tmp/signal-attachments")
      FileUtils.mkdir_p(attachments_dir)

      path = File.join(attachments_dir, attachment_id)
      return path if File.exist?(path)

      nil
    end

    # Check if Signal CLI is installed and configured
    def configured?
      cli_path.present? && phone_number.present? && File.executable?(cli_path)
    end

    # Get connection status
    def status
      return { connected: false, reason: "CLI not found" } unless File.executable?(cli_path.to_s)
      return { connected: false, reason: "Phone number not set" } unless phone_number.present?

      # Try a listIdentities command to verify the account
      cmd = build_command("listIdentities")
      _, stderr, status = execute_command(cmd, timeout: 10)

      if status.success?
        { connected: true, phone_number: phone_number }
      else
        { connected: false, reason: stderr.truncate(200) }
      end
    rescue StandardError => e
      { connected: false, reason: e.message }
    end

    private

    def cli_path
      ENV.fetch("SIGNAL_CLI_PATH", DEFAULT_CLI_PATH)
    end

    def phone_number
      ENV["SIGNAL_PHONE_NUMBER"]
    end

    def build_command(*args)
      [cli_path, "-u", phone_number] + args
    end

    def execute_command(cmd, timeout: 30)
      Open3.capture3(*cmd, timeout: timeout)
    rescue Errno::ENOENT
      ["", "signal-cli not found at #{cli_path}", OpenStruct.new(success?: false)]
    rescue Timeout::Error
      ["", "Command timed out", OpenStruct.new(success?: false)]
    end

    def parse_received_messages(json_output)
      messages = []

      json_output.each_line do |line|
        next if line.blank?

        begin
          data = JSON.parse(line)
          envelope = data["envelope"]
          next unless envelope

          # Only process data messages (not receipts, typing indicators, etc.)
          data_message = envelope["dataMessage"]
          next unless data_message

          msg = {
            from: envelope["source"],
            source_name: envelope["sourceName"],
            timestamp: Time.at(envelope["timestamp"].to_f / 1000),
            body: data_message["message"],
            attachments: parse_attachments(data_message["attachments"]),
            group_id: data_message.dig("groupInfo", "groupId"),
            quote: data_message["quote"]
          }

          messages << msg if msg[:body].present? || msg[:attachments].any?
        rescue JSON::ParserError
          next
        end
      end

      Rails.logger.info "[Signal] Received #{messages.size} message(s)"
      messages
    end

    def parse_attachments(attachments)
      return [] unless attachments.is_a?(Array)

      attachments.map do |att|
        {
          content_type: att["contentType"],
          filename: att["filename"],
          id: att["id"],
          size: att["size"],
          is_voice_note: att["voiceNote"] == true
        }
      end
    end
  end
end

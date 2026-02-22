# frozen_string_literal: true

# Multi-turn conversation with the TEEEM AI Assistant
# Each user can have multiple conversations (one per channel, or multiple web sessions)
#
# Channels: web, whatsapp, sms, slack, signal (Phase 1: web only)
#
class AssistantConversation < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :user
  has_many :assistant_messages, dependent: :destroy
  has_many :assistant_actions, dependent: :nullify

  CHANNELS = %w[web whatsapp sms slack signal].freeze
  STATUSES = %w[active archived].freeze

  validates :channel, inclusion: { in: CHANNELS }
  validates :status, inclusion: { in: STATUSES }

  scope :active, -> { where(status: "active") }
  scope :for_channel, ->(channel) { where(channel: channel) }
  scope :recent, -> { order(last_message_at: :desc) }

  # Get or create the active conversation for a user+channel
  def self.find_or_create_active(user:, channel: "web")
    active.for_channel(channel).where(user: user).order(last_message_at: :desc).first ||
      create!(
        user: user,
        tenant_id: user.tenant_id,
        channel: channel,
        title: "New conversation",
        last_message_at: Time.current
      )
  end

  # Build messages array for Claude API (multi-turn)
  def messages_for_claude(limit: 40)
    assistant_messages
      .order(created_at: :asc)
      .last(limit)
      .filter_map do |msg|
        case msg.role
        when "user"
          { role: "user", content: msg.content }
        when "assistant"
          if msg.tool_calls.present? && msg.tool_calls.any?
            # Assistant message with tool use
            content = []
            content << { type: "text", text: msg.content } if msg.content.present?
            msg.tool_calls.each do |tc|
              content << {
                type: "tool_use",
                id: tc["id"],
                name: tc["name"],
                input: tc["input"]
              }
            end
            { role: "assistant", content: content }
          else
            { role: "assistant", content: msg.content }
          end
        when "tool_result"
          # Tool results go as user messages with tool_result content blocks
          {
            role: "user",
            content: msg.tool_results.map do |tr|
              {
                type: "tool_result",
                tool_use_id: tr["tool_use_id"],
                content: tr["content"].to_s
              }
            end
          }
        end
      end
  end

  # Add a user message and return it
  def add_user_message(content, content_type: "text")
    msg = assistant_messages.create!(
      role: "user",
      content: content,
      content_type: content_type
    )
    update!(last_message_at: Time.current)
    msg
  end

  # Add an assistant message and return it
  def add_assistant_message(content, tool_calls: [], metadata: {})
    assistant_messages.create!(
      role: "assistant",
      content: content,
      tool_calls: tool_calls,
      metadata: metadata
    )
  end

  # Add tool results and return the message
  def add_tool_results(results)
    assistant_messages.create!(
      role: "tool_result",
      content: "Tool results",
      tool_results: results
    )
  end
end

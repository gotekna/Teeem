# frozen_string_literal: true

# CrossChannelContextService - Unified cross-channel message intelligence (Phase 5)
#
# Detects when the same person/topic appears across multiple channels:
#   "The plumber texted on WhatsApp, emailed, AND sent a Signal message about the same thing"
#
# This creates a unified view so the construction manager sees ONE conversation
# thread instead of juggling 7 apps.
#
# Usage:
#   service = CrossChannelContextService.new(user: current_user, tenant: current_tenant)
#   context = service.unified_context_for(contact: plumber)
#   # => { channels: ["email", "whatsapp", "sms"], messages: [...], topic_clusters: [...] }
#
class CrossChannelContextService
  include AnthropicClient

  self.default_claude_model = CLAUDE_HAIKU
  self.default_max_tokens = 1024

  def initialize(user:, tenant:)
    @user = user
    @tenant = tenant
  end

  # Get unified context for a contact across all channels
  #
  # @param contact [Contact] The contact to look up
  # @param hours [Integer] How far back to look (default 72 hours)
  # @return [Hash] Unified cross-channel context
  def unified_context_for(contact:, hours: 72)
    since = hours.hours.ago
    messages = collect_messages(contact, since)

    return { channels: [], messages: [], topic_clusters: [], summary: nil } if messages.empty?

    channels = messages.map { |m| m[:channel] }.uniq
    topic_clusters = cluster_by_topic(messages) if messages.size > 1

    {
      channels: channels,
      messages: messages.sort_by { |m| m[:timestamp] },
      topic_clusters: topic_clusters || [],
      summary: messages.size >= 3 ? generate_summary(contact, messages) : nil
    }
  end

  # Detect duplicate/related messages across channels
  # (e.g., same person sent SMS AND emailed about same thing)
  #
  # @param hours [Integer] Lookback window
  # @return [Array<Hash>] Groups of related cross-channel messages
  def detect_cross_channel_duplicates(hours: 24)
    since = hours.hours.ago
    duplicates = []

    # Get all recent inbound communications
    emails = recent_emails(since)
    sms_messages = recent_sms(since)
    whatsapp_messages = recent_whatsapp_conversations(since)

    # Group by contact
    by_contact = {}

    emails.each do |email|
      contact = email.primary_contact
      next unless contact

      by_contact[contact.id] ||= { contact: contact, items: [] }
      by_contact[contact.id][:items] << {
        channel: "email",
        content: "#{email.subject}: #{email.body_preview&.truncate(200)}",
        timestamp: email.received_at,
        source_id: email.id,
        source_type: "SyncedEmail"
      }
    end

    sms_messages.each do |sms|
      next unless sms.contact

      by_contact[sms.contact_id] ||= { contact: sms.contact, items: [] }
      by_contact[sms.contact_id][:items] << {
        channel: "sms",
        content: sms.body,
        timestamp: sms.received_at || sms.created_at,
        source_id: sms.id,
        source_type: "SmsMessage"
      }
    end

    # Find contacts with messages on 2+ channels
    by_contact.each do |_contact_id, data|
      channels = data[:items].map { |i| i[:channel] }.uniq
      next unless channels.size >= 2

      duplicates << {
        contact: {
          id: data[:contact].id,
          name: data[:contact].display_name
        },
        channels: channels,
        message_count: data[:items].size,
        items: data[:items].sort_by { |i| i[:timestamp] },
        likely_same_topic: same_topic?(data[:items])
      }
    end

    duplicates
  end

  private

  def collect_messages(contact, since)
    messages = []

    # Emails
    emails = SyncedEmail.where(primary_contact: contact)
                        .where("received_at > ?", since)
                        .order(received_at: :desc)
                        .limit(20)
    emails.each do |e|
      messages << {
        channel: "email",
        content: "#{e.subject}: #{e.body_preview&.truncate(300)}",
        timestamp: e.received_at,
        from: e.from_name || e.from_email,
        source_id: e.id,
        source_type: "SyncedEmail"
      }
    end

    # SMS
    sms = SmsMessage.where(contact: contact)
                    .where("created_at > ?", since)
                    .order(created_at: :desc)
                    .limit(20)
    sms.each do |s|
      messages << {
        channel: "sms",
        content: s.body,
        timestamp: s.created_at,
        from: s.inbound? ? contact.display_name : @user.name,
        direction: s.direction,
        source_id: s.id,
        source_type: "SmsMessage"
      }
    end

    # WhatsApp conversations (from assistant conversations with whatsapp channel)
    whatsapp_convos = AssistantConversation.where(user: @user, channel: "whatsapp")
                                           .where("last_message_at > ?", since)
    whatsapp_convos.each do |conv|
      conv.assistant_messages.where(role: "user").where("created_at > ?", since).each do |msg|
        messages << {
          channel: "whatsapp",
          content: msg.content,
          timestamp: msg.created_at,
          from: @user.name,
          source_id: msg.id,
          source_type: "AssistantMessage"
        }
      end
    end

    # Signal conversations
    signal_convos = AssistantConversation.where(user: @user, channel: "signal")
                                         .where("last_message_at > ?", since)
    signal_convos.each do |conv|
      conv.assistant_messages.where(role: "user").where("created_at > ?", since).each do |msg|
        messages << {
          channel: "signal",
          content: msg.content,
          timestamp: msg.created_at,
          from: @user.name,
          source_id: msg.id,
          source_type: "AssistantMessage"
        }
      end
    end

    messages
  end

  def cluster_by_topic(messages)
    # Simple keyword-based clustering (avoids expensive LLM call for every check)
    clusters = []
    used = Set.new

    messages.each_with_index do |msg, i|
      next if used.include?(i)

      cluster = [msg]
      used.add(i)

      messages.each_with_index do |other, j|
        next if i == j || used.include?(j)

        if messages_related?(msg, other)
          cluster << other
          used.add(j)
        end
      end

      if cluster.size > 1
        clusters << {
          messages: cluster,
          channels: cluster.map { |m| m[:channel] }.uniq,
          timespan_hours: ((cluster.last[:timestamp] - cluster.first[:timestamp]) / 3600.0).round(1)
        }
      end
    end

    clusters
  end

  def messages_related?(msg1, msg2)
    return false unless msg1[:content].present? && msg2[:content].present?

    # Extract significant words (3+ chars, not common words)
    stop_words = Set.new(%w[the and for are but not you all any can had her was one our out day has his how its may new now old see way who did get let say she too use])

    words1 = msg1[:content].downcase.scan(/\b\w{3,}\b/) - stop_words.to_a
    words2 = msg2[:content].downcase.scan(/\b\w{3,}\b/) - stop_words.to_a

    return false if words1.empty? || words2.empty?

    # Jaccard similarity - shared words / total unique words
    shared = (words1 & words2).size.to_f
    total = (words1 | words2).size.to_f

    shared / total > 0.25 # 25% word overlap = likely related
  end

  def same_topic?(items)
    return false if items.size < 2

    contents = items.map { |i| i[:content] }.compact
    return false if contents.size < 2

    # Check if any pair of messages has significant word overlap
    contents.combination(2).any? do |a, b|
      messages_related?(
        { content: a },
        { content: b }
      )
    end
  end

  def generate_summary(contact, messages)
    channel_list = messages.map { |m| m[:channel] }.uniq.join(", ")
    message_texts = messages.sort_by { |m| m[:timestamp] }.last(10).map do |m|
      "[#{m[:channel]}] #{m[:content]&.truncate(200)}"
    end.join("\n")

    prompt = <<~PROMPT
      Summarize this cross-channel communication with #{contact.display_name} in 2-3 sentences.
      Channels used: #{channel_list}

      Messages:
      #{message_texts}

      Focus on: What are they asking about? What action is needed? Are they getting frustrated by lack of response?
    PROMPT

    response = call_claude(prompt: prompt)
    extract_claude_text(response)
  rescue StandardError => e
    Rails.logger.error "[CrossChannel] Summary generation failed: #{e.message}"
    nil
  end

  def recent_emails(since)
    SyncedEmail.where("received_at > ?", since)
               .where.not(primary_contact_id: nil)
               .order(received_at: :desc)
               .limit(100)
  end

  def recent_sms(since)
    SmsMessage.inbound.where("created_at > ?", since).limit(100)
  end

  def recent_whatsapp_conversations(since)
    AssistantConversation.where(channel: "whatsapp")
                         .where("last_message_at > ?", since)
  end
end

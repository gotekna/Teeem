# frozen_string_literal: true

# EmailIntelligenceService - Batch AI processing for email intelligence
#
# Processes business emails with Claude Haiku to generate:
# - 2-line AI summaries (populates synced_emails.ai_summary)
# - Action items with deadlines (populates synced_emails.action_items JSONB)
# - Follow-up flags and dates (populates follow_up_required, follow_up_date, follow_up_reason)
#
# Cost: ~$1.20/month (100 Haiku calls/day x $0.000375/call)
#
# Usage:
#   EmailIntelligenceService.new(tenant: tenant).process_batch(limit: 50)
#
# Architecture:
#   - Uses AnthropicClient concern with Haiku (cheap, fast)
#   - Processes 5 emails per API call for efficiency
#   - Only processes business emails (skips spam/marketing/transactional)
#   - Only processes last 30 days, newest first
#   - Uses Claude tool_use for structured JSON output
#
class EmailIntelligenceService
  include AnthropicClient

  # Use Haiku for cost efficiency (~$0.000375/call)
  self.default_claude_model = CLAUDE_HAIKU
  self.default_max_tokens = 2048

  BATCH_SIZE = 5 # Emails per API call
  MAX_BODY_LENGTH = 1500 # Truncate long emails
  MAX_AGE_DAYS = 30 # Only process recent emails

  def initialize(tenant:)
    @tenant = tenant
  end

  # Process a batch of unprocessed emails
  # @param limit [Integer] Max emails to process in this run
  # @return [Hash] { processed: Integer, skipped: Integer, errors: Integer }
  def process_batch(limit: 50)
    stats = { processed: 0, skipped: 0, errors: 0 }

    emails = unprocessed_emails(limit)
    return stats if emails.empty?

    Rails.logger.info "[EmailIntelligence] Processing #{emails.size} emails for tenant #{@tenant.id}"

    # Process in batches of BATCH_SIZE for API efficiency
    emails.each_slice(BATCH_SIZE) do |batch|
      process_email_batch(batch, stats)
    end

    Rails.logger.info "[EmailIntelligence] Done: #{stats.inspect}"
    stats
  end

  private

  # Get unprocessed business emails, newest first
  def unprocessed_emails(limit)
    SyncedEmail
      .needs_ai_processing
      .not_spam
      .where("received_at > ?", MAX_AGE_DAYS.days.ago)
      .where.not(body_text: [nil, ""])
      .order(received_at: :desc)
      .limit(limit)
      .to_a
      .select(&:is_business_email?) # Double-check classification
  end

  # Process a batch of emails in a single API call
  def process_email_batch(emails, stats)
    # Build the batch prompt
    email_data = emails.map.with_index do |email, idx|
      {
        index: idx,
        id: email.id,
        subject: email.subject || "(no subject)",
        from: "#{email.from_name} <#{email.from_email}>",
        to: email.to_emails&.first(3)&.join(", ") || "",
        date: email.received_at&.strftime("%d/%m/%Y"),
        body: (email.body_text || "").truncate(MAX_BODY_LENGTH)
      }
    end

    response = call_claude_for_batch(email_data)
    return unless response

    # Parse and apply results
    results = parse_batch_results(response)
    return if results.nil?

    results.each do |result|
      email = emails.find { |e| e.id == result[:email_id] }
      next unless email

      apply_intelligence(email, result, stats)
    end
  rescue StandardError => e
    Rails.logger.error "[EmailIntelligence] Batch error: #{e.message}"
    Rails.logger.error e.backtrace.first(3).join("\n")
    # Mark all as processed to avoid infinite retry on bad batches
    emails.each do |email|
      email.update_columns(ai_processed_at: Time.current)
      stats[:errors] += 1
    end
  end

  # Call Claude with tool_use for structured output
  def call_claude_for_batch(email_data)
    client = anthropic_client

    emails_text = email_data.map do |e|
      <<~EMAIL
        --- EMAIL #{e[:index]} (ID: #{e[:id]}) ---
        Subject: #{e[:subject]}
        From: #{e[:from]}
        To: #{e[:to]}
        Date: #{e[:date]}
        Body:
        #{e[:body]}
      EMAIL
    end.join("\n")

    response = client.messages(parameters: {
      model: default_claude_model,
      max_tokens: default_max_tokens,
      system: system_prompt,
      messages: [{ role: "user", content: "Analyze these #{email_data.size} emails:\n\n#{emails_text}" }],
      tools: [analysis_tool_definition],
      tool_choice: { type: "tool", name: "analyze_emails" }
    })

    response
  rescue StandardError => e
    Rails.logger.error "[EmailIntelligence] Claude API error: #{e.message}"
    nil
  end

  # Parse the tool_use response from Claude
  def parse_batch_results(response)
    content_blocks = response["content"] || []

    tool_block = content_blocks.find { |b| b["type"] == "tool_use" && b["name"] == "analyze_emails" }
    return nil unless tool_block

    input = tool_block["input"]
    analyses = input["analyses"]
    return nil unless analyses.is_a?(Array)

    analyses.map do |a|
      {
        email_id: a["email_id"].to_i,
        summary: a["summary"],
        action_items: a["action_items"] || [],
        follow_up_required: a["follow_up_required"] == true,
        follow_up_date: parse_date(a["follow_up_date"]),
        follow_up_reason: a["follow_up_reason"]
      }
    end
  rescue StandardError => e
    Rails.logger.error "[EmailIntelligence] Parse error: #{e.message}"
    nil
  end

  # Apply AI analysis to a single email
  def apply_intelligence(email, result, stats)
    updates = {
      ai_summary: result[:summary]&.truncate(500),
      action_items: result[:action_items].presence,
      follow_up_required: result[:follow_up_required],
      follow_up_date: result[:follow_up_date],
      follow_up_reason: result[:follow_up_reason]&.truncate(255),
      ai_processed_at: Time.current
    }

    email.update_columns(updates)
    stats[:processed] += 1
  rescue StandardError => e
    Rails.logger.error "[EmailIntelligence] Failed to update email #{email.id}: #{e.message}"
    email.update_columns(ai_processed_at: Time.current) # Mark processed to avoid retry
    stats[:errors] += 1
  end

  def parse_date(date_str)
    return nil if date_str.blank?
    Date.parse(date_str)
  rescue ArgumentError
    nil
  end

  # ========================================
  # Prompt & Tool Definition
  # ========================================

  def system_prompt
    <<~PROMPT
      You are an AI email analyst for a construction management company in Australia.
      You analyze business emails and extract actionable intelligence.

      Context: The company manages residential and commercial construction projects.
      Common topics: delays, deliveries, approvals, inspections, quotes, invoices,
      site access, council requests, subcontractor coordination, material orders.

      For each email, provide:
      1. A concise 2-line summary (what it's about + what action is needed)
      2. Specific action items with deadlines if mentioned
      3. Whether follow-up is required and by when

      Rules:
      - Use Australian date format (DD/MM/YYYY)
      - Be specific about actions: "Reply to Jason about plumbing quote" not "Follow up"
      - Set follow_up_date to the deadline mentioned, or 2 business days from email date if urgent but no deadline
      - Only flag follow_up_required for emails that genuinely need a response or action
      - Skip generic "thank you" or "noted" emails - they don't need follow-up
    PROMPT
  end

  def analysis_tool_definition
    {
      name: "analyze_emails",
      description: "Provide structured analysis for a batch of business emails",
      input_schema: {
        type: "object",
        properties: {
          analyses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                email_id: { type: "integer", description: "The email ID from the input" },
                summary: { type: "string", description: "Concise 2-line summary of the email" },
                action_items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      action: { type: "string", description: "Specific action to take" },
                      deadline: { type: "string", description: "Deadline in DD/MM/YYYY format, or null" },
                      priority: { type: "string", enum: %w[low medium high], description: "Action priority" }
                    },
                    required: %w[action priority]
                  }
                },
                follow_up_required: { type: "boolean", description: "Whether this email needs a follow-up response or action" },
                follow_up_date: { type: "string", description: "Suggested follow-up date in YYYY-MM-DD format, or null" },
                follow_up_reason: { type: "string", description: "Brief reason for follow-up, or null" }
              },
              required: %w[email_id summary action_items follow_up_required]
            }
          }
        },
        required: ["analyses"]
      }
    }
  end
end

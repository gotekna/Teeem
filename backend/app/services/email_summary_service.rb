require "anthropic"

# AI-powered email summarization service
# Generates summaries, extracts action items, and identifies entities for linking
class EmailSummaryService
  include AnthropicClient
  # SSoT: Use AnthropicClient constants for model names
  MAX_TOKENS = 1000

  class AIError < StandardError; end

  def initialize(email_warehouse)
    @email = email_warehouse
  end

  # Main entry point - summarizes email and extracts entities
  def summarize!
    return if @email.body_text.blank?

    begin
      result = call_ai

      @email.update!(
        ai_summary: result[:summary],
        action_items: result[:action_items] || [],
        extracted_entities: result[:entities] || {}
      )

      Rails.logger.info "[EmailSummary] Summarized email #{@email.id}: #{result[:summary].truncate(100)}"

      result
    rescue StandardError => e
      Rails.logger.error "[EmailSummary] Failed to summarize email #{@email.id}: #{e.message}"
      raise AIError, "Failed to summarize email: #{e.message}"
    end
  end

  # Link detected entities to actual records in the database
  def link_entities!
    return unless @email.extracted_entities.present?

    entities = @email.extracted_entities.with_indifferent_access
    links = {}

    # Try to link mentioned jobs
    if entities[:job_references].present?
      links[:jobs] = entities[:job_references].map do |ref|
        find_job(ref)
      end.compact
    end

    # Try to link mentioned contacts
    if entities[:contacts].present?
      links[:contacts] = entities[:contacts].map do |contact_ref|
        find_contact(contact_ref)
      end.compact
    end

    # Try to link mentioned companies
    if entities[:companies].present?
      links[:companies] = entities[:companies].map do |company_ref|
        find_company(company_ref)
      end.compact
    end

    # Update extracted_entities with linked IDs
    @email.update!(
      extracted_entities: @email.extracted_entities.merge(linked: links)
    )

    links
  end

  private

  def call_ai
    client = Anthropic::Client.new

    prompt = build_prompt

    response = client.messages(
      parameters: {
        model: CLAUDE_SONNET,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "user", content: prompt }
        ]
      }
    )

    # Parse the response
    response_text = response.dig("content", 0, "text") || ""

    parse_ai_response(response_text)
  end

  def build_prompt
    <<~PROMPT
      Analyze this email and provide a structured summary. Return JSON only.

      Email Subject: #{@email.subject}
      From: #{@email.from_name} <#{@email.from_email}>
      To: #{@email.to_emails&.join(', ')}
      Date: #{@email.received_at}

      Body:
      #{@email.body_text.to_s.truncate(3000)}

      Return ONLY valid JSON in this exact format:
      {
        "summary": "2-3 sentence summary focusing on key information and purpose",
        "action_items": [
          {"task": "what needs to be done", "assignee_hint": "who might need to do it", "deadline_hint": "any deadline mentioned"}
        ],
        "entities": {
          "job_references": ["any job IDs, addresses, or project names mentioned"],
          "contacts": [{"name": "person name", "email": "if mentioned", "role": "their role if mentioned"}],
          "companies": ["company names mentioned"],
          "key_dates": [{"date": "YYYY-MM-DD or description", "context": "what the date relates to"}],
          "monetary_values": [{"amount": "dollar amount", "context": "what it relates to"}]
        },
        "sentiment": "positive|negative|neutral|urgent",
        "category": "business|inquiry|quote_request|approval|complaint|information|follow_up|other"
      }
    PROMPT
  end

  def parse_ai_response(text)
    # Extract JSON from response (might be wrapped in markdown code blocks)
    json_match = text.match(/\{[\s\S]*\}/)
    return { summary: "Failed to parse AI response", action_items: [], entities: {} } unless json_match

    data = JSON.parse(json_match[0])

    {
      summary: data["summary"],
      action_items: data["action_items"] || [],
      entities: {
        job_references: data.dig("entities", "job_references") || [],
        contacts: data.dig("entities", "contacts") || [],
        companies: data.dig("entities", "companies") || [],
        key_dates: data.dig("entities", "key_dates") || [],
        monetary_values: data.dig("entities", "monetary_values") || []
      },
      sentiment: data["sentiment"],
      category: data["category"]
    }
  rescue JSON::ParserError => e
    Rails.logger.error "[EmailSummary] Failed to parse AI JSON: #{e.message}"
    { summary: text.truncate(500), action_items: [], entities: {} }
  end

  def find_job(reference)
    return nil if reference.blank?

    # Try exact ID match first
    if reference.to_s.match?(/^\d+$/)
      job = Job.find_by(id: reference.to_i)
      return { id: job.id, title: job.title } if job
    end

    # Try title/address match
    job = Job.where("title ILIKE ?", "%#{reference}%").first
    return { id: job.id, title: job.title } if job

    nil
  end

  def find_contact(reference)
    return nil if reference.blank?

    # Reference might be a hash with name/email
    if reference.is_a?(Hash)
      if reference["email"].present?
        # SSoT: find_by_email uses contact_emails table
        contact = Contact.find_by_email(reference["email"])
        return { id: contact.id, name: contact.display_name } if contact
      end

      if reference["name"].present?
        contact = Contact.where("display_name ILIKE ? OR first_name ILIKE ? OR last_name ILIKE ?",
                               "%#{reference['name']}%", "%#{reference['name']}%", "%#{reference['name']}%").first
        return { id: contact.id, name: contact.display_name } if contact
      end
    elsif reference.is_a?(String)
      # Try email match (SSoT: find_by_email uses contact_emails table)
      if reference.include?("@")
        contact = Contact.find_by_email(reference)
        return { id: contact.id, name: contact.display_name } if contact
      end

      # Try name match
      contact = Contact.where("display_name ILIKE ?", "%#{reference}%").first
      return { id: contact.id, name: contact.display_name } if contact
    end

    nil
  end

  def find_company(reference)
    return nil if reference.blank?

    company = Corporate.where("name ILIKE ?", "%#{reference}%").first
    return { id: company.id, name: company.name } if company

    nil
  end
end

require "anthropic"

class JobEstimatorService
  CLAUDE_MODEL = "claude-3-haiku-20240307"
  MAX_TOKENS = 2000

  class AIExtractionError < StandardError; end

  def initialize(job)
    @job = job
  end

  # Generate AI analysis of the job
  def analyze
    prompt = build_analysis_prompt

    start_time = Time.current
    response = call_claude_api(prompt)
    processing_time = ((Time.current - start_time) * 1000).to_i

    # Parse JSON response
    analysis = parse_json_response(response)

    {
      success: true,
      analysis: analysis,
      processing_time_ms: processing_time,
      ai_model_used: CLAUDE_MODEL
    }
  rescue JSON::ParserError => e
    Rails.logger.error "Claude returned invalid JSON: #{e.message}"
    {
      success: false,
      error: "AI returned invalid response",
      raw_response: response
    }
  rescue StandardError => e
    Rails.logger.error "Job analysis error: #{e.class} - #{e.message}"
    {
      success: false,
      error: e.message
    }
  end

  private

  def build_analysis_prompt
    # Gather job information
    job_title = @job.title || "Untitled Job"
    job_type = @job.job_type&.name || "Unknown"
    job_status = @job.job_status&.name || "Unknown"
    # SSoT: contract_price is THE ONE
    contract = @job.contract_price
    location = extract_location
    client_info = extract_client_info
    description = @job.description || @job.scope_of_work || ""

    <<~PROMPT
      You are a construction estimator analyzing a construction job in Australia.

      Job Information:
      - Title: #{job_title}
      - Type: #{job_type}
      - Status: #{job_status}
      - Contract Value: #{contract ? "$#{contract}" : 'Not specified'}
      - Location: #{location}
      - Client: #{client_info}
      - Description: #{description.present? ? description : 'No description provided'}

      Based on this information, provide a detailed analysis with EXACTLY 10 key points about what this job entails.

      Return your response as valid JSON (no markdown, no code blocks) with this structure:

      {
        "job_summary": "A 2-3 sentence summary of the overall job",
        "key_points": [
          "Point 1: [Clear, specific point about what needs to be done]",
          "Point 2: [Another key aspect of the job]",
          ...
          "Point 10: [Final key point]"
        ],
        "estimated_scope": {
          "complexity": "low|medium|high",
          "duration_estimate": "Estimated timeframe (e.g., '6-8 weeks')",
          "key_trades": ["List of trades/specialists needed"],
          "major_materials": ["List of major materials required"],
          "potential_challenges": ["List of potential challenges or risks"]
        },
        "recommendations": [
          "Recommendation 1",
          "Recommendation 2",
          "Recommendation 3"
        ]
      }

      Guidelines for key points:
      1. Be specific and actionable
      2. Focus on deliverables and scope
      3. Include technical requirements where relevant
      4. Consider Australian building standards and climate
      5. Mention any special considerations based on location
      6. Include site preparation needs if applicable
      7. Consider compliance and certification requirements
      8. Think about utilities, services, and infrastructure
      9. Address quality and finish level
      10. Consider handover and completion requirements

      IMPORTANT: Return ONLY the JSON object, no additional text or formatting.
    PROMPT
  end

  def extract_location
    parts = []
    parts << @job.site_address if @job.site_address.present?
    parts << @job.site_suburb if @job.site_suburb.present?
    parts << @job.site_state if @job.site_state.present?
    parts << @job.site_postcode if @job.site_postcode.present?

    location = parts.join(", ")
    location.present? ? location : "Location not specified"
  end

  def extract_client_info
    # Try to get primary client from job_contacts
    primary_client = @job.job_contacts.find_by(role: "client", primary: true)
    if primary_client&.contact
      contact = primary_client.contact
      return "#{contact.display_name} (#{contact.email})"
    end

    # Fallback to any client
    any_client = @job.job_contacts.find_by(role: "client")
    if any_client&.contact
      contact = any_client.contact
      return "#{contact.display_name}"
    end

    "Client not specified"
  end

  def call_claude_api(prompt)
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise AIExtractionError, "ANTHROPIC_API_KEY not configured" unless api_key

    client = Anthropic::Client.new(
      access_token: api_key,
      anthropic_version: "2023-06-01"
    )

    response = client.messages(
      parameters: {
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }
    )

    response.dig("content", 0, "text") || response.dig(:content, 0, :text) || ""
  rescue Anthropic::Error => e
    Rails.logger.error "Anthropic API error: #{e.message}"
    raise AIExtractionError, "Claude API error: #{e.message}"
  end

  def parse_json_response(response_text)
    # Try to find JSON in response
    json_match = response_text.match(/\{.*\}/m)

    if json_match
      JSON.parse(json_match[0])
    else
      raise JSON::ParserError, "No JSON object found in response"
    end
  end
end

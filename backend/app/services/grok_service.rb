class GrokService
  BASE_URL = "https://api.x.ai/v1"

  def initialize
    @api_key = ENV["XAI_API_KEY"]
    raise "XAI_API_KEY environment variable not set" unless @api_key
  end

  # Send a message to Grok with context
  def chat(message, context = {})
    # Build the full prompt with context
    system_message = build_system_message(context)

    response = send_request("/chat/completions", {
      model: "grok-beta",
      messages: [
        { role: "system", content: system_message },
        { role: "user", content: message }
      ],
      stream: false,
      temperature: 0.7
    })

    parse_response(response)
  end

  # Stream responses for real-time chat
  def chat_stream(message, context = {}, &block)
    system_message = build_system_message(context)

    # TODO: Implement streaming
    # For now, use regular chat
    chat(message, context)
  end

  private

  def build_system_message(context)
    prompt = "You are Grok, an AI assistant helping a development team build TEEEM, a database management application."

    # Include project rebuild plan for context
    rebuild_plan = load_project_documentation
    if rebuild_plan
      prompt += "\n\n## PROJECT REBUILD PLAN\n#{rebuild_plan}\n"
      prompt += "\n\nUse this plan as reference when discussing features, architecture, and priorities."
    end

    if context[:current_page]
      prompt += "\n\nThe user is currently on: #{context[:current_page]}"
    end

    if context[:current_table]
      prompt += "\n\nThey are working on table: #{context[:current_table][:name]}"
      prompt += " with #{context[:current_table][:columns]&.count || 0} columns"
    end

    if context[:recent_actions]
      prompt += "\n\nRecent actions: #{context[:recent_actions].join(', ')}"
    end

    if context[:team_context]
      prompt += "\n\nTeam context: #{context[:team_context]}"
    end

    prompt += "\n\nHelp the team plan features, debug issues, and build efficiently. Be concise and actionable."
    prompt += "\n\nIMPORTANT: After discussing a feature or plan, always end by asking: 'Are you happy with this plan for the feature?' This signals that the plan can be saved for future reference."

    prompt
  end

  def send_request(endpoint, payload)
    uri = URI("#{BASE_URL}#{endpoint}")

    request = Net::HTTP::Post.new(uri.path)
    request["Authorization"] = "Bearer #{@api_key}"
    request["Content-Type"] = "application/json"
    request.body = payload.to_json

    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    unless response.is_a?(Net::HTTPSuccess)
      raise "Grok API error: #{response.code} - #{response.body}"
    end

    JSON.parse(response.body)
  end

  def parse_response(response)
    {
      message: response.dig("choices", 0, "message", "content"),
      model: response["model"],
      usage: response["usage"]
    }
  end

  def load_project_documentation
    doc_path = Rails.root.join("rapid-rebuild-plan.md")
    return nil unless File.exist?(doc_path)

    content = File.read(doc_path)

    # Truncate to avoid token limits (keep first 3000 characters)
    if content.length > 3000
      content[0..3000] + "\n\n[Document truncated...]"
    else
      content
    end
  rescue => e
    Rails.logger.error "Failed to load project documentation: #{e.message}"
    nil
  end
end

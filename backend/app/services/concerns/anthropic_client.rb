# frozen_string_literal: true

# Shared concern for Anthropic Claude API calls
# Provides standardized methods for calling Claude to prevent API syntax errors
#
# Usage in any service:
#   include AnthropicClient
#
#   def my_method
#     response = call_claude(
#       prompt: "Extract data from this text",
#       model: "claude-3-haiku-20240307",  # optional, defaults to HAIKU
#       max_tokens: 1000                    # optional, defaults to 1024
#     )
#     response_text = response.dig("content", 0, "text")
#   end
#
# For vision/multimodal:
#   response = call_claude_with_content(
#     content: [
#       { type: "image", source: { type: "base64", media_type: "image/png", data: base64_data } },
#       { type: "text", text: "What's in this image?" }
#     ],
#     model: "claude-sonnet-4-5-20250929"
#   )
#
module AnthropicClient
  extend ActiveSupport::Concern

  # Available models - use these constants to avoid typos
  CLAUDE_HAIKU = "claude-3-haiku-20240307"
  CLAUDE_SONNET = "claude-sonnet-4-5-20250929"
  CLAUDE_SONNET_LEGACY = "claude-3-5-sonnet-20241022"

  included do
    # Default model for simple tasks
    class_attribute :default_claude_model, default: CLAUDE_HAIKU
    class_attribute :default_max_tokens, default: 1024
  end

  private

  # Simple text prompt to Claude
  # @param prompt [String] The user prompt
  # @param model [String] Claude model to use (optional)
  # @param max_tokens [Integer] Maximum response tokens (optional)
  # @return [Hash] Raw API response with "content", "usage", etc.
  def call_claude(prompt:, model: nil, max_tokens: nil)
    call_claude_with_content(
      content: prompt,
      model: model,
      max_tokens: max_tokens
    )
  end

  # Multimodal call to Claude (images, PDFs, etc.)
  # @param content [String, Array] Either a string prompt or array of content blocks
  # @param model [String] Claude model to use (optional)
  # @param max_tokens [Integer] Maximum response tokens (optional)
  # @param system [String] System prompt (optional)
  # @return [Hash] Raw API response
  def call_claude_with_content(content:, model: nil, max_tokens: nil, system: nil)
    client = anthropic_client

    parameters = {
      model: model || default_claude_model,
      max_tokens: max_tokens || default_max_tokens,
      messages: [ { role: "user", content: content } ]
    }

    parameters[:system] = system if system.present?

    # CORRECT SYNTAX: client.messages(parameters: { ... })
    # The anthropic gem v0.3.x requires wrapping in `parameters:`
    client.messages(parameters: parameters)
  end

  # Extract text from Claude response
  # @param response [Hash] The API response from call_claude
  # @return [String] The text content of the response
  def extract_claude_text(response)
    response.dig("content", 0, "text") || ""
  end

  # Parse JSON from Claude response (with error handling)
  # @param response [Hash] The API response from call_claude
  # @return [Hash] Parsed JSON or empty hash on error
  def parse_claude_json(response)
    text = extract_claude_text(response)
    return {} if text.blank?

    # Extract JSON from response (Claude sometimes adds explanation text)
    json_match = text.match(/\{[\s\S]*\}/)
    return {} unless json_match

    JSON.parse(json_match[0]).with_indifferent_access
  rescue JSON::ParserError => e
    Rails.logger.error "[AnthropicClient] JSON parse error: #{e.message}"
    {}
  end

  # Get configured Anthropic client
  # @return [Anthropic::Client]
  def anthropic_client
    api_key = ENV["ANTHROPIC_API_KEY"]
    raise "ANTHROPIC_API_KEY not configured" if api_key.blank?

    Anthropic::Client.new(access_token: api_key)
  end
end

# frozen_string_literal: true

# AI-powered writing assistant for spell check, grammar, and tone suggestions
# Uses Claude Haiku for fast, cost-effective text analysis
#
# Usage:
#   service = WritingAssistantService.new
#   result = service.check("Reivew the docuemnts", context: "task_name")
#   # => { issues: [...], corrected_text: "Review the documents", quality: "needs_work" }
#
class WritingAssistantService
  include AnthropicClient

  # Business terms that should NOT be flagged as spelling errors
  # These are common abbreviations used in construction/business context
  BUSINESS_TERMS = %w[
    QTY PO RFI EOT PC SOW WBS NTE COD ETA ETD MOQ BOM CAD PDF DWG
    HVAC MEP BIM VDC OFI IFC ASI COR PCO PR TI FF&E GC DC PM PE
    ASAP FYI TBD TBA N/A NA NB PS RE CC BCC EOD COB ATTN RSVP
    Tekna TEEEM Xero SharePoint Heroku Vercel PostgreSQL
  ].freeze

  # Minimum text length to check (avoids API calls for single words)
  MIN_CHECK_LENGTH = 5

  # @param text [String] The text to check
  # @param context [String] The context type (task_name, question, action, etc.)
  # @return [Hash] Result with issues, corrected_text, and quality
  def check(text, context: "general")
    return empty_result(text) if text.blank? || text.length < MIN_CHECK_LENGTH

    response = call_claude(
      prompt: build_prompt(text, context),
      model: CLAUDE_HAIKU,
      max_tokens: 500
    )

    parse_response(response, text)
  rescue StandardError => e
    Rails.logger.error "[WritingAssistant] Error checking text: #{e.message}"
    empty_result(text)
  end

  private

  def build_prompt(text, context)
    <<~PROMPT
      You are a writing assistant checking #{context_description(context)} for spelling, grammar, and tone issues.

      IMPORTANT RULES:
      1. These business/technical terms are VALID - do NOT flag them: #{BUSINESS_TERMS.join(", ")}
      2. Don't flag proper nouns or company names
      3. Be lenient with informal but clear language
      4. Focus on actual errors, not stylistic preferences
      5. Keep suggestions concise and practical

      Return ONLY valid JSON (no other text):
      {
        "issues": [
          {
            "type": "spelling|grammar|tone",
            "severity": "error|warning",
            "original": "the problematic text",
            "suggestion": "the corrected text",
            "explanation": "brief reason"
          }
        ],
        "corrected_text": "the full text with all corrections applied",
        "quality": "excellent|good|needs_work"
      }

      If there are no issues, return: {"issues":[],"corrected_text":"[original text]","quality":"excellent"}

      Text to check: #{text}
    PROMPT
  end

  def context_description(context)
    descriptions = {
      "task_name" => "a task title (should be clear and actionable)",
      "question" => "a question for a colleague (should be clear and professional)",
      "action" => "an action item description (should be specific and actionable)",
      "answer" => "a response to a question (should be complete and professional)",
      "email_subject" => "an email subject line (should be concise and informative)",
      "email_body" => "a professional email (should be polite and well-structured)",
      "notes" => "internal notes (can be informal but should be clear)",
      "comment" => "a comment (should be constructive and clear)",
      "general" => "text"
    }
    descriptions[context] || "text"
  end

  def parse_response(response, original_text)
    result = parse_claude_json(response)

    if result.blank?
      Rails.logger.warn "[WritingAssistant] Failed to parse Claude response"
      return empty_result(original_text)
    end

    # Ensure required keys exist
    {
      issues: Array(result[:issues] || result["issues"]),
      corrected_text: result[:corrected_text] || result["corrected_text"] || original_text,
      quality: result[:quality] || result["quality"] || "good"
    }
  end

  def empty_result(text)
    {
      issues: [],
      corrected_text: text.to_s,
      quality: "excellent"
    }
  end
end

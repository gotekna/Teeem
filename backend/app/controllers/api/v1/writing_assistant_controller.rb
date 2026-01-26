# frozen_string_literal: true

class Api::V1::WritingAssistantController < ApplicationController
  # POST /api/v1/writing_assistant/check
  # Check text for spelling, grammar, and tone issues
  #
  # Parameters:
  #   text: String - The text to check
  #   context: String - Optional context type (task_name, question, action, etc.)
  #
  # Returns:
  #   {
  #     success: true,
  #     data: {
  #       issues: [...],
  #       corrected_text: "...",
  #       quality: "excellent|good|needs_work"
  #     }
  #   }
  def check
    text = params[:text].to_s.strip
    context = params[:context].to_s.presence || "general"
    mode = params[:mode].to_s.presence || "auto"  # "auto", "basic", or "ai"

    Rails.logger.info "[WritingAssistant] Controller received check request (#{text.length} chars, mode: #{mode})"

    if text.blank?
      return render json: {
        success: true,
        data: { issues: [], corrected_text: "", quality: "excellent" }
      }
    end

    # Get user's custom dictionary words
    user_dictionary = current_user ? UserDictionaryWord.words_for_user(current_user) : []
    Rails.logger.info "[WritingAssistant] User dictionary: #{user_dictionary.length} words"

    # Service handles fallback from AI to basic automatically
    service = WritingAssistantService.new
    result = service.check(text, context: context, mode: mode, user_dictionary: user_dictionary)

    Rails.logger.info "[WritingAssistant] Controller returning #{result[:issues].length} issues"
    render json: { success: true, data: result }
  rescue StandardError => e
    Rails.logger.error "[WritingAssistant] Controller error: #{e.message}"
    Rails.logger.error "[WritingAssistant] Backtrace: #{e.backtrace.first(3).join("\n")}"
    render json: {
      success: false,
      error: "Writing check failed. Please try again."
    }, status: :internal_server_error
  end
end

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

    if text.blank?
      return render json: {
        success: true,
        data: { issues: [], corrected_text: "", quality: "excellent" }
      }
    end

    service = WritingAssistantService.new
    result = service.check(text, context: context)

    render json: { success: true, data: result }
  rescue StandardError => e
    Rails.logger.error "[WritingAssistant] Controller error: #{e.message}"
    render json: {
      success: false,
      error: "Writing check failed. Please try again."
    }, status: :internal_server_error
  end
end

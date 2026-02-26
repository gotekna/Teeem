# frozen_string_literal: true

class Api::V1::TutorialController < ApplicationController
  # GET /api/v1/tutorial/progress
  def progress
    tutorial_progress = current_user.assistant_preferences&.dig("tutorial_progress") || {}

    render json: {
      success: true,
      data: {
        dismissed: tutorial_progress["dismissed"] || false,
        completed_chapters: tutorial_progress["completed_chapters"] || [],
        completed_at: tutorial_progress["completed_at"]
      }
    }
  end

  # PUT /api/v1/tutorial/progress
  def update_progress
    prefs = current_user.assistant_preferences || {}
    tutorial_progress = prefs["tutorial_progress"] || {}

    if params[:complete_chapter].present?
      completed = tutorial_progress["completed_chapters"] || []
      chapter_id = params[:complete_chapter].to_s
      completed << chapter_id unless completed.include?(chapter_id)
      tutorial_progress["completed_chapters"] = completed
    end

    if params.key?(:dismissed)
      tutorial_progress["dismissed"] = ActiveModel::Type::Boolean.new.cast(params[:dismissed])
    end

    prefs["tutorial_progress"] = tutorial_progress
    current_user.update_column(:assistant_preferences, prefs)

    render json: {
      success: true,
      data: {
        dismissed: tutorial_progress["dismissed"] || false,
        completed_chapters: tutorial_progress["completed_chapters"] || [],
        completed_at: tutorial_progress["completed_at"]
      }
    }
  end

  # POST /api/v1/tutorial/reset
  def reset
    prefs = current_user.assistant_preferences || {}
    prefs.delete("tutorial_progress")
    current_user.update_column(:assistant_preferences, prefs)

    render json: { success: true, data: { dismissed: false, completed_chapters: [], completed_at: nil } }
  end
end

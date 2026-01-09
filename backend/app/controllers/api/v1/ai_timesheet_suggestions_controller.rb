# frozen_string_literal: true

# AiTimesheetSuggestionsController - Manages AI-generated timesheet suggestions
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
class Api::V1::AiTimesheetSuggestionsController < ApplicationController
  before_action :set_suggestion, only: [:show, :accept, :reject]

  # GET /api/v1/ai_timesheet_suggestions
  def index
    @suggestions = AiTimesheetSuggestion.includes(:worker_profile, :job)
                                        .order(suggestion_date: :desc, created_at: :desc)

    # Filter by worker
    @suggestions = @suggestions.for_worker(params[:worker_profile_id]) if params[:worker_profile_id].present?

    # Filter by job
    @suggestions = @suggestions.for_job(params[:job_id]) if params[:job_id].present?

    # Filter by status
    @suggestions = @suggestions.where(status: params[:status]) if params[:status].present?

    # Filter by date range
    if params[:start_date].present? && params[:end_date].present?
      @suggestions = @suggestions.for_date_range(params[:start_date].to_date, params[:end_date].to_date)
    elsif params[:date].present?
      @suggestions = @suggestions.for_date(params[:date].to_date)
    end

    # Filter by confidence
    @suggestions = @suggestions.high_confidence if params[:high_confidence] == "true"

    # Limit results
    limit = [params[:limit]&.to_i || 50, 200].min
    @suggestions = @suggestions.limit(limit)

    render json: {
      success: true,
      data: @suggestions.map { |s| suggestion_to_json(s) },
      meta: {
        count: @suggestions.length,
        total_hours: @suggestions.sum(&:suggested_hours).round(2)
      }
    }
  end

  # GET /api/v1/ai_timesheet_suggestions/pending
  # Returns pending suggestions for current user's workers
  def pending
    @suggestions = AiTimesheetSuggestion.pending
                                        .includes(:worker_profile, :job)
                                        .order(confidence_score: :desc, suggestion_date: :desc)

    # Filter by worker if specified
    @suggestions = @suggestions.for_worker(params[:worker_profile_id]) if params[:worker_profile_id].present?

    # Limit to recent
    @suggestions = @suggestions.where("suggestion_date >= ?", 7.days.ago) unless params[:all] == "true"

    render json: {
      success: true,
      data: @suggestions.map { |s| suggestion_to_json(s, include_evidence: true) },
      meta: {
        count: @suggestions.length,
        high_confidence_count: @suggestions.high_confidence.count
      }
    }
  end

  # GET /api/v1/ai_timesheet_suggestions/:id
  def show
    render json: {
      success: true,
      data: suggestion_to_json(@suggestion, detailed: true)
    }
  end

  # POST /api/v1/ai_timesheet_suggestions/generate
  # Generate suggestions for a worker and date
  def generate
    worker = WorkerProfile.find_by(id: params[:worker_profile_id])
    unless worker
      return render json: { success: false, error: "Worker profile not found" }, status: :not_found
    end

    date = params[:date]&.to_date || Date.yesterday

    service = AiTimesheetGeneratorService.new
    result = if params[:regenerate] == "true"
      service.regenerate(worker_profile: worker, date: date)
    else
      service.generate_for_worker(worker_profile: worker, date: date)
    end

    render json: {
      success: true,
      data: result
    }
  rescue StandardError => e
    render json: {
      success: false,
      error: "Generation failed: #{e.message}"
    }, status: :unprocessable_entity
  end

  # POST /api/v1/ai_timesheet_suggestions/:id/accept
  def accept
    unless @suggestion.pending?
      return render json: {
        success: false,
        error: "Suggestion is not pending (status: #{@suggestion.status})"
      }, status: :unprocessable_entity
    end

    # Accept with optional modifications
    hours = params[:hours]&.to_f || @suggestion.suggested_hours
    start_time = params[:start_time] ? Time.parse(params[:start_time]) : @suggestion.suggested_start_time
    end_time = params[:end_time] ? Time.parse(params[:end_time]) : @suggestion.suggested_end_time

    entry = @suggestion.accept!(
      hours_override: hours != @suggestion.suggested_hours ? hours : nil,
      start_time_override: start_time != @suggestion.suggested_start_time ? start_time : nil,
      end_time_override: end_time != @suggestion.suggested_end_time ? end_time : nil
    )

    if entry
      render json: {
        success: true,
        data: {
          suggestion: suggestion_to_json(@suggestion),
          labour_cost_entry: entry_to_json(entry)
        },
        message: "Suggestion accepted and labour cost entry created"
      }
    else
      render json: {
        success: false,
        errors: @suggestion.errors.full_messages
      }, status: :unprocessable_entity
    end
  rescue StandardError => e
    render json: {
      success: false,
      error: "Accept failed: #{e.message}"
    }, status: :unprocessable_entity
  end

  # POST /api/v1/ai_timesheet_suggestions/:id/reject
  def reject
    unless @suggestion.pending?
      return render json: {
        success: false,
        error: "Suggestion is not pending (status: #{@suggestion.status})"
      }, status: :unprocessable_entity
    end

    reason = params[:reason] || "Rejected by user"

    @suggestion.reject!(reason: reason)

    render json: {
      success: true,
      data: suggestion_to_json(@suggestion),
      message: "Suggestion rejected"
    }
  rescue StandardError => e
    render json: {
      success: false,
      error: "Reject failed: #{e.message}"
    }, status: :unprocessable_entity
  end

  private

  def set_suggestion
    @suggestion = AiTimesheetSuggestion.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { success: false, error: "Suggestion not found" }, status: :not_found
  end

  def suggestion_to_json(suggestion, detailed: false, include_evidence: false)
    json = {
      id: suggestion.id,
      suggestion_date: suggestion.suggestion_date,
      suggested_start_time: suggestion.suggested_start_time,
      suggested_end_time: suggestion.suggested_end_time,
      suggested_hours: suggestion.suggested_hours,
      confidence_score: suggestion.confidence_score,
      status: suggestion.status,
      evidence_source: suggestion.evidence_source
    }

    # Worker info
    if suggestion.worker_profile
      json[:worker] = {
        id: suggestion.worker_profile.id,
        name: suggestion.worker_profile.display_name,
        type: suggestion.worker_profile.worker_type
      }
    end

    # Job info
    if suggestion.job
      json[:job] = {
        id: suggestion.job.id,
        name: suggestion.job.name,
        number: suggestion.job&.job_number
      }
    end

    # Evidence (for review)
    if include_evidence || detailed
      json[:photo_evidence] = suggestion.photo_evidence
      json[:gps_evidence] = suggestion.gps_evidence
      json[:reasoning] = suggestion.reasoning
    end

    # Detailed view
    if detailed
      json.merge!(
        rejection_reason: suggestion.rejection_reason,
        accepted_at: suggestion.accepted_at,
        rejected_at: suggestion.rejected_at,
        labour_cost_entry_id: suggestion.labour_cost_entry_id,
        created_at: suggestion.created_at,
        updated_at: suggestion.updated_at
      )

      # If accepted, include the created entry
      if suggestion.accepted? && suggestion.labour_cost_entry
        json[:labour_cost_entry] = entry_to_json(suggestion.labour_cost_entry)
      end
    end

    json
  end

  def entry_to_json(entry)
    {
      id: entry.id,
      entry_date: entry.entry_date,
      total_hours: entry.total_hours,
      total_cost: entry.total_cost&.to_f,
      billing_status: entry.billing_status
    }
  end
end

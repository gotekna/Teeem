# frozen_string_literal: true

# SitePresenceMobileController - Mobile-optimized endpoints for iOS app
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Streamlined endpoints for mobile experience:
# - Quick check-in with photo upload
# - Timer view with live stats
# - Simple history view
# - Offline sync support
#
class Api::V1::SitePresenceMobileController < ApplicationController
  # GET /api/v1/site_presence_mobile/home
  # Main mobile home screen data
  def home
    worker = current_worker_profile
    unless worker
      return render json: { success: false, error: "No worker profile found" }, status: :not_found
    end

    active_session = worker.site_presence_sessions.active.first

    render json: {
      success: true,
      data: {
        worker: {
          id: worker.id,
          name: worker.display_name,
          photo: worker.profile_photo_url,
          has_face_photo: worker.profile_photo_url.present?
        },
        active_session: active_session ? mobile_session_json(active_session) : nil,
        recent_jobs: recent_jobs_for_worker(worker),
        today_summary: today_summary(worker),
        pending_suggestions: pending_suggestions_count(worker)
      }
    }
  end

  # POST /api/v1/site_presence_mobile/quick_checkin
  # Simplified check-in for mobile
  def quick_checkin
    worker = current_worker_profile
    return render json: { success: false, error: "No worker profile found" }, status: :not_found unless worker

    # Check for existing active session
    if worker.site_presence_sessions.active.exists?
      return render json: {
        success: false,
        error: "You already have an active session. Please check out first."
      }, status: :unprocessable_entity
    end

    job = Job.find_by(id: params[:job_id])
    return render json: { success: false, error: "Job not found" }, status: :not_found unless job

    # Create photo if provided
    photo = nil
    if params[:photo_url].present?
      photo = SmTaskPhoto.create!(
        job: job,
        photo_url: params[:photo_url],
        photo_type: "checkin",
        is_checkin_photo: true,
        uploaded_by: current_user,
        latitude: params[:latitude],
        longitude: params[:longitude],
        taken_at: Time.current
      )
    end

    # Create session
    session = SitePresenceSession.check_in(
      worker_profile: worker,
      job: job,
      latitude: params[:latitude]&.to_f,
      longitude: params[:longitude]&.to_f,
      photo: photo,
      device_info: params[:device_info]
    )

    # Trigger face verification in background
    if photo && worker.profile_photo_url.present?
      FaceVerificationJob.perform_later(session.id, "checkin")
    end

    render json: {
      success: true,
      data: mobile_session_json(session),
      message: "Checked in successfully"
    }
  rescue StandardError => e
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/site_presence_mobile/quick_checkout
  # Simplified check-out for mobile
  def quick_checkout
    worker = current_worker_profile
    return render json: { success: false, error: "No worker profile found" }, status: :not_found unless worker

    session = worker.site_presence_sessions.active.first
    return render json: { success: false, error: "No active session found" }, status: :not_found unless session

    # Create photo if provided
    photo = nil
    if params[:photo_url].present?
      photo = SmTaskPhoto.create!(
        job: session.job,
        photo_url: params[:photo_url],
        photo_type: "checkout",
        is_checkout_photo: true,
        uploaded_by: current_user,
        latitude: params[:latitude],
        longitude: params[:longitude],
        taken_at: Time.current
      )
    end

    # Complete checkout
    session.check_out(
      latitude: params[:latitude]&.to_f,
      longitude: params[:longitude]&.to_f,
      photo: photo,
      break_minutes: params[:break_minutes]&.to_i || 0
    )

    # Detect anomalies
    AnomalyDetectionService.new.analyze_session(session)

    # Trigger face verification
    if photo && worker.profile_photo_url.present?
      FaceVerificationJob.perform_later(session.id, "checkout")
    end

    render json: {
      success: true,
      data: mobile_session_json(session),
      summary: {
        hours: session.total_hours&.round(2),
        job: session.job&.name,
        message: "Great work! #{session.total_hours&.round(1)} hours logged."
      }
    }
  rescue StandardError => e
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  # GET /api/v1/site_presence_mobile/timer
  # Live timer data for active session
  def timer
    worker = current_worker_profile
    return render json: { success: false, error: "No worker profile found" }, status: :not_found unless worker

    session = worker.site_presence_sessions.active.first
    return render json: { success: false, error: "No active session" }, status: :not_found unless session

    elapsed = session.checkin_at ? (Time.current - session.checkin_at) : 0
    hours = (elapsed / 1.hour).round(2)

    render json: {
      success: true,
      data: {
        session_id: session.id,
        job: {
          id: session.job_id,
          name: session.job&.name,
          address: session.job&.site_address
        },
        started_at: session.checkin_at,
        elapsed_seconds: elapsed.to_i,
        elapsed_hours: hours,
        elapsed_display: format_duration(elapsed),
        gps_verified: session.gps_verified_checkin,
        face_verified: session.face_verified_checkin,
        break_minutes: session.break_minutes || 0
      }
    }
  end

  # GET /api/v1/site_presence_mobile/history
  # Recent session history for mobile
  def history
    worker = current_worker_profile
    return render json: { success: false, error: "No worker profile found" }, status: :not_found unless worker

    days = (params[:days] || 7).to_i
    sessions = worker.site_presence_sessions
                     .where("checkin_at > ?", days.days.ago)
                     .includes(:job)
                     .order(checkin_at: :desc)
                     .limit(50)

    # Group by date
    by_date = sessions.group_by { |s| s.checkin_at.to_date }

    render json: {
      success: true,
      data: {
        period: "Last #{days} days",
        total_sessions: sessions.count,
        total_hours: sessions.sum { |s| s.total_hours || 0 }.round(2),
        by_date: by_date.map do |date, day_sessions|
          {
            date: date,
            day_name: date.strftime("%A"),
            sessions: day_sessions.map { |s| history_session_json(s) },
            total_hours: day_sessions.sum { |s| s.total_hours || 0 }.round(2)
          }
        end
      }
    }
  end

  # GET /api/v1/site_presence_mobile/jobs
  # Available jobs for check-in
  def jobs
    # Get jobs the user can check into
    # This could be filtered by assignment, location, or active status
    jobs = Job.where(status: %w[active in_progress])
              .order(:name)
              .limit(50)

    render json: {
      success: true,
      data: jobs.map do |job|
        {
          id: job.id,
          name: job.name,
          number: job.job_number,
          address: job.site_address,
          latitude: job.site_latitude,
          longitude: job.site_longitude,
          site_presence_enabled: job.site_presence_enabled
        }
      end
    }
  end

  # POST /api/v1/site_presence_mobile/add_break
  # Add break time to active session
  def add_break
    worker = current_worker_profile
    return render json: { success: false, error: "No worker profile found" }, status: :not_found unless worker

    session = worker.site_presence_sessions.active.first
    return render json: { success: false, error: "No active session" }, status: :not_found unless session

    minutes = params[:minutes]&.to_i || 0
    return render json: { success: false, error: "Invalid break duration" }, status: :bad_request if minutes <= 0

    session.update!(break_minutes: (session.break_minutes || 0) + minutes)

    render json: {
      success: true,
      data: { break_minutes: session.break_minutes },
      message: "#{minutes} minute break added"
    }
  end

  # GET /api/v1/site_presence_mobile/suggestions
  # Pending AI suggestions for review
  def suggestions
    worker = current_worker_profile
    return render json: { success: false, error: "No worker profile found" }, status: :not_found unless worker

    suggestions = worker.ai_timesheet_suggestions
                        .pending
                        .order(confidence_score: :desc)
                        .limit(10)

    render json: {
      success: true,
      data: suggestions.map do |s|
        {
          id: s.id,
          date: s.suggestion_date,
          job: s.job&.name,
          hours: s.suggested_hours,
          confidence: s.confidence_score,
          reasoning: s.reasoning
        }
      end
    }
  end

  # POST /api/v1/site_presence_mobile/accept_suggestion/:id
  def accept_suggestion
    worker = current_worker_profile
    return render json: { success: false, error: "No worker profile found" }, status: :not_found unless worker

    suggestion = worker.ai_timesheet_suggestions.pending.find_by(id: params[:id])
    return render json: { success: false, error: "Suggestion not found" }, status: :not_found unless suggestion

    entry = suggestion.accept!

    render json: {
      success: true,
      message: "Time entry created for #{suggestion.suggested_hours} hours"
    }
  rescue StandardError => e
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  private

  def current_worker_profile
    return nil unless current_user

    @current_worker_profile ||= WorkerProfile.find_by(user_id: current_user.id)
  end

  def mobile_session_json(session)
    {
      id: session.id,
      status: session.session_status,
      job: {
        id: session.job_id,
        name: session.job&.name
      },
      checkin_at: session.checkin_at,
      checkout_at: session.checkout_at,
      hours: session.total_hours&.round(2),
      gps_verified: session.gps_verified_checkin,
      face_verified: session.face_verified_checkin,
      has_anomalies: session.has_anomalies
    }
  end

  def history_session_json(session)
    {
      id: session.id,
      job: session.job&.name,
      start: session.checkin_at&.strftime("%H:%M"),
      end: session.checkout_at&.strftime("%H:%M"),
      hours: session.total_hours&.round(2),
      status: session.approval_status
    }
  end

  def recent_jobs_for_worker(worker)
    # Get jobs from recent sessions
    recent_job_ids = worker.site_presence_sessions
                           .where("checkin_at > ?", 30.days.ago)
                           .pluck(:job_id)
                           .uniq
                           .first(5)

    Job.where(id: recent_job_ids).map do |job|
      {
        id: job.id,
        name: job.name,
        number: job.job_number
      }
    end
  end

  def today_summary(worker)
    today_sessions = worker.site_presence_sessions
                           .where("DATE(checkin_at) = ?", Date.current)
                           .completed

    {
      sessions: today_sessions.count,
      hours: today_sessions.sum { |s| s.total_hours || 0 }.round(2)
    }
  end

  def pending_suggestions_count(worker)
    worker.ai_timesheet_suggestions.pending.count
  end

  def format_duration(seconds)
    hours = (seconds / 3600).to_i
    minutes = ((seconds % 3600) / 60).to_i
    format("%d:%02d", hours, minutes)
  end
end

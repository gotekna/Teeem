# frozen_string_literal: true

# WorkerProfilesController - Manages unified employee/subcontractor worker profiles
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
class Api::V1::WorkerProfilesController < ApplicationController
  before_action :set_worker_profile, only: [:show, :update, :upload_face_photo, :verify_face]

  # GET /api/v1/worker_profiles
  def index
    @workers = WorkerProfile.includes(:user, :contact, :cost_centre)
                            .active
                            .order(:display_name)

    # Filter by type if specified
    @workers = @workers.employees if params[:type] == "employee"
    @workers = @workers.subcontractors if params[:type] == "subcontractor"

    # Filter by cost centre if specified
    @workers = @workers.where(cost_centre_id: params[:cost_centre_id]) if params[:cost_centre_id].present?

    render json: {
      success: true,
      data: @workers.map { |w| worker_to_json(w) }
    }
  end

  # GET /api/v1/worker_profiles/employees
  def employees
    @workers = WorkerProfile.includes(:user, :cost_centre)
                            .employees
                            .active
                            .order(:display_name)

    render json: {
      success: true,
      data: @workers.map { |w| worker_to_json(w) }
    }
  end

  # GET /api/v1/worker_profiles/subcontractors
  def subcontractors
    @workers = WorkerProfile.includes(:contact, :cost_centre)
                            .subcontractors
                            .active
                            .order(:display_name)

    render json: {
      success: true,
      data: @workers.map { |w| worker_to_json(w) }
    }
  end

  # GET /api/v1/worker_profiles/:id
  def show
    render json: {
      success: true,
      data: worker_to_json(@worker, detailed: true)
    }
  end

  # POST /api/v1/worker_profiles
  def create
    @worker = WorkerProfile.new(worker_profile_params)

    # Auto-detect worker type from linked user or contact
    if @worker.user_id.present?
      @worker.worker_type = "employee"
    elsif @worker.contact_id.present?
      @worker.worker_type = "subcontractor"
    end

    if @worker.save
      render json: {
        success: true,
        data: worker_to_json(@worker)
      }, status: :created
    else
      render json: {
        success: false,
        errors: @worker.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/worker_profiles/:id
  def update
    if @worker.update(worker_profile_params)
      render json: {
        success: true,
        data: worker_to_json(@worker)
      }
    else
      render json: {
        success: false,
        errors: @worker.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/worker_profiles/:id/upload_face_photo
  # Upload a profile photo for face verification
  def upload_face_photo
    unless params[:photo].present?
      return render json: { success: false, error: "Photo is required" }, status: :bad_request
    end

    # TODO: Upload to S3/Cloudinary and store URL
    photo_url = upload_photo(params[:photo])

    if photo_url
      @worker.update!(profile_photo_url: photo_url)

      # Optionally generate face encoding for faster future comparisons
      # FaceEncodingJob.perform_later(@worker.id)

      render json: {
        success: true,
        data: {
          profile_photo_url: photo_url,
          message: "Face photo uploaded successfully"
        }
      }
    else
      render json: {
        success: false,
        error: "Failed to upload photo"
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/worker_profiles/:id/verify_face
  # Verify a photo against stored face photo
  def verify_face
    unless params[:photo_url].present?
      return render json: { success: false, error: "Photo URL is required" }, status: :bad_request
    end

    unless @worker.profile_photo_url.present?
      return render json: {
        success: false,
        error: "No profile photo on file for verification"
      }, status: :unprocessable_entity
    end

    # TODO: Call AWS Rekognition for face comparison
    # For now, return placeholder response
    render json: {
      success: true,
      data: {
        verified: true,
        confidence: 95.5,
        message: "Face verification placeholder - AWS Rekognition integration pending"
      }
    }
  end

  private

  def set_worker_profile
    @worker = WorkerProfile.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { success: false, error: "Worker profile not found" }, status: :not_found
  end

  def worker_profile_params
    params.require(:worker_profile).permit(
      :user_id,
      :contact_id,
      :worker_type,
      :profile_photo_url,
      :cost_centre_id,
      :hourly_rate,
      :overtime_rate_1_5x,
      :overtime_rate_2x,
      :employment_cost_percent,
      :day_rate,
      :call_out_fee,
      :active,
      :trade,
      :qualifications
    )
  end

  def worker_to_json(worker, detailed: false)
    json = {
      id: worker.id,
      worker_type: worker.worker_type,
      display_name: worker.display_name,
      profile_photo_url: worker.profile_photo_url,
      has_face_photo: worker.profile_photo_url.present?,
      active: worker.active,
      trade: worker.trade
    }

    # Employee fields
    if worker.employee?
      json.merge!(
        user_id: worker.user_id,
        user_email: worker.user&.email,
        hourly_rate: worker.effective_hourly_rate&.to_f,
        overtime_1_5x_rate: worker.effective_overtime_1_5x_rate&.to_f,
        overtime_2x_rate: worker.effective_overtime_2x_rate&.to_f,
        employment_cost_percent: worker.employment_cost_percent&.to_f
      )
    end

    # Subcontractor fields
    if worker.subcontractor?
      json.merge!(
        contact_id: worker.contact_id,
        contact_name: worker.contact&.name,
        company_name: worker.contact&.company_name,
        day_rate: worker.day_rate&.to_f,
        call_out_fee: worker.call_out_fee&.to_f
      )
    end

    # Cost centre
    if worker.cost_centre
      json[:cost_centre] = {
        id: worker.cost_centre.id,
        code: worker.cost_centre.code,
        name: worker.cost_centre.name
      }
    end

    # Detailed view includes more fields
    if detailed
      json.merge!(
        qualifications: worker.qualifications,
        face_encoding: worker.face_encoding.present?,
        created_at: worker.created_at,
        updated_at: worker.updated_at
      )

      # Include recent sessions summary
      recent_sessions = worker.site_presence_sessions
                              .completed
                              .where("checkin_at > ?", 30.days.ago)
                              .count
      json[:recent_sessions_count] = recent_sessions

      # Include cost summary
      recent_costs = worker.labour_cost_entries
                          .where("entry_date > ?", 30.days.ago)
                          .sum(:total_cost)
      json[:recent_labour_cost] = recent_costs.to_f.round(2)
    end

    json
  end

  def upload_photo(photo)
    # TODO: Implement actual upload to S3/Cloudinary
    # For now, return nil to indicate failure
    # In production, this would upload the photo and return the URL
    nil
  end
end

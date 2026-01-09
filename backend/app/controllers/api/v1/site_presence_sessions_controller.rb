# frozen_string_literal: true

module Api
  module V1
    # SitePresenceSessionsController - Photo-verified site check-in/checkout API
    #
    # Part of Site Presence & Cost Intelligence System
    # See: .claude/plans/piped-orbiting-whisper.md
    #
    # Provides endpoints for:
    # - Check-in with photo and GPS verification
    # - Check-out with automatic time calculation
    # - Session management and approval workflow
    # - Active session tracking
    #
    class SitePresenceSessionsController < ApplicationController
      before_action :set_session, only: [:show, :update, :approve, :reject, :add_break]
      before_action :set_worker_profile, only: [:checkin, :my_sessions, :active_session]

      # ==========================================
      # CHECK-IN / CHECK-OUT
      # ==========================================

      # POST /api/v1/site_presence_sessions/checkin
      # Start a new work session at a job site
      #
      # Required params:
      #   - job_id: Job to check into
      #   - latitude: GPS latitude
      #   - longitude: GPS longitude
      #
      # Optional params:
      #   - task_id: Specific task being worked on
      #   - photo_url: URL of check-in photo (Cloudinary)
      #   - image_data: Base64 encoded photo (will upload to Cloudinary)
      #   - notes: Worker notes
      #   - saas_customer_id: SaaS customer being supported (for cost-to-serve tracking)
      #
      def checkin
        # Check for existing active session
        if @worker_profile.active_session.present?
          return render json: {
            success: false,
            error: "Already checked in. Please check out first.",
            active_session: session_json(@worker_profile.active_session)
          }, status: :unprocessable_entity
        end

        job = Job.find(params[:job_id])

        # Handle photo upload if base64 provided
        photo = nil
        if params[:image_data].present? || params[:photo_url].present?
          photo = create_checkin_photo(job, params)
        end

        # Verify photo requirement
        if job.require_photo_checkin && photo.nil?
          return render json: {
            success: false,
            error: "This job requires a photo at check-in"
          }, status: :unprocessable_entity
        end

        # Create the session
        session = SitePresenceSession.check_in(
          worker_profile: @worker_profile,
          job: job,
          latitude: params[:latitude].to_f,
          longitude: params[:longitude].to_f,
          photo: photo,
          task: params[:task_id].present? ? SmTask.find(params[:task_id]) : nil,
          device_info: request.user_agent,
          saas_customer_id: params[:saas_customer_id]
        )

        # Add worker notes if provided
        session.update!(worker_notes: params[:notes]) if params[:notes].present?

        # Trigger face verification job if required
        if job.require_face_verification && photo.present?
          FaceVerificationJob.perform_later(session.id, photo.id)
        end

        render json: {
          success: true,
          session: session_json(session),
          verification: {
            gps_verified: session.gps_verified_checkin,
            distance_from_site: session.distance_from_site_checkin,
            within_radius: session.within_site_radius?(:checkin),
            photo_uploaded: photo.present?,
            face_verification_pending: job.require_face_verification && photo.present?
          }
        }, status: :created
      end

      # POST /api/v1/site_presence_sessions/:id/checkout
      # End an active work session
      #
      # Required params:
      #   - latitude: GPS latitude
      #   - longitude: GPS longitude
      #
      # Optional params:
      #   - photo_url: URL of check-out photo
      #   - image_data: Base64 encoded photo
      #   - break_minutes: Total break time in minutes
      #   - notes: Worker notes
      #
      def checkout
        session = SitePresenceSession.find(params[:id])

        unless session.active?
          return render json: {
            success: false,
            error: "Session is not active. Status: #{session.session_status}"
          }, status: :unprocessable_entity
        end

        # Verify worker owns this session
        unless session.worker_profile_id == @worker_profile&.id || current_user.admin?
          return render json: {
            success: false,
            error: "Not authorized to check out this session"
          }, status: :forbidden
        end

        job = session.job

        # Handle photo upload if provided
        photo = nil
        if params[:image_data].present? || params[:photo_url].present?
          photo = create_checkout_photo(job, session, params)
        end

        # Verify photo requirement
        if job.require_photo_checkout && photo.nil?
          return render json: {
            success: false,
            error: "This job requires a photo at check-out"
          }, status: :unprocessable_entity
        end

        # Set break time if provided
        session.break_minutes = params[:break_minutes].to_i if params[:break_minutes].present?

        # Perform checkout
        session.check_out(
          latitude: params[:latitude].to_f,
          longitude: params[:longitude].to_f,
          photo: photo
        )

        # Add worker notes if provided
        session.update!(worker_notes: params[:notes]) if params[:notes].present?

        # Trigger face verification if required
        if job.require_face_verification && photo.present?
          FaceVerificationJob.perform_later(session.id, photo.id, type: "checkout")
        end

        # Check for auto-approval
        if should_auto_approve?(session)
          session.auto_approve!
        end

        render json: {
          success: true,
          session: session_json(session),
          hours: {
            total: session.total_hours,
            billable: session.billable_hours,
            break_minutes: session.break_minutes
          },
          cost: session.labour_cost_entry&.slice(
            :base_labour_cost, :employment_cost, :overhead_cost, :total_cost
          ),
          verification: {
            gps_verified: session.gps_verified_checkout,
            distance_from_site: session.distance_from_site_checkout,
            within_radius: session.within_site_radius?(:checkout),
            face_verified: session.face_verified_checkout
          },
          anomalies: session.anomalies
        }
      end

      # ==========================================
      # SESSION QUERIES
      # ==========================================

      # GET /api/v1/site_presence_sessions
      # List sessions with filters
      def index
        sessions = SitePresenceSession.includes(:worker_profile, :job, :cost_centre)

        # Filters
        sessions = sessions.for_job(params[:job_id]) if params[:job_id].present?
        sessions = sessions.for_worker(params[:worker_profile_id]) if params[:worker_profile_id].present?
        sessions = sessions.for_date(Date.parse(params[:date])) if params[:date].present?
        sessions = sessions.where(session_status: params[:status]) if params[:status].present?
        sessions = sessions.where(approval_status: params[:approval_status]) if params[:approval_status].present?
        sessions = sessions.with_anomalies if params[:with_anomalies] == "true"
        sessions = sessions.today if params[:today] == "true"

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 25).to_i
        sessions = sessions.recent.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          sessions: sessions.map { |s| session_json(s) },
          pagination: {
            page: page,
            per_page: per_page
          }
        }
      end

      # GET /api/v1/site_presence_sessions/:id
      def show
        render json: {
          success: true,
          session: session_json(@session, detailed: true)
        }
      end

      # GET /api/v1/site_presence_sessions/active
      # Get active session for current worker (or all active if admin)
      def active_session
        if params[:all] == "true" && current_user.admin?
          sessions = SitePresenceSession.active.includes(:worker_profile, :job).recent
          render json: {
            success: true,
            count: sessions.count,
            sessions: sessions.map { |s| session_json(s) }
          }
        else
          session = @worker_profile&.active_session
          if session
            render json: {
              success: true,
              active: true,
              session: session_json(session)
            }
          else
            render json: {
              success: true,
              active: false,
              session: nil
            }
          end
        end
      end

      # GET /api/v1/site_presence_sessions/my_sessions
      # Get sessions for current worker
      def my_sessions
        sessions = @worker_profile.site_presence_sessions.includes(:job, :cost_centre)

        # Date filter
        if params[:start_date].present? && params[:end_date].present?
          start_date = Date.parse(params[:start_date])
          end_date = Date.parse(params[:end_date])
          sessions = sessions.where(checkin_at: start_date.beginning_of_day..end_date.end_of_day)
        elsif params[:date].present?
          sessions = sessions.for_date(Date.parse(params[:date]))
        end

        sessions = sessions.recent.limit(params[:limit] || 50)

        # Calculate summary
        total_hours = sessions.sum(:total_hours) || 0
        total_cost = sessions.joins(:labour_cost_entry).sum("labour_cost_entries.total_cost") || 0

        render json: {
          success: true,
          worker_profile_id: @worker_profile.id,
          sessions: sessions.map { |s| session_json(s) },
          summary: {
            count: sessions.count,
            total_hours: total_hours.round(2),
            total_cost: total_cost.round(2)
          }
        }
      end

      # GET /api/v1/site_presence_sessions/pending_approval
      # Get sessions pending approval (admin only)
      def pending_approval
        sessions = SitePresenceSession.pending_approval
                                       .includes(:worker_profile, :job)
                                       .recent

        # Filter by critical anomalies first
        if params[:critical_first] == "true"
          sessions = sessions.order(Arel.sql("jsonb_array_length(anomalies) DESC"))
        end

        sessions = sessions.limit(params[:limit] || 50)

        render json: {
          success: true,
          count: sessions.count,
          sessions: sessions.map { |s| session_json(s, include_anomalies: true) }
        }
      end

      # GET /api/v1/site_presence_sessions/site_status/:job_id
      # Who's on site right now for a job
      def site_status
        job = Job.find(params[:job_id])
        active_sessions = SitePresenceSession.active
                                              .where(job: job)
                                              .includes(:worker_profile)

        render json: {
          success: true,
          job_id: job.id,
          job_name: job.name,
          on_site_count: active_sessions.count,
          workers: active_sessions.map do |session|
            {
              worker_profile_id: session.worker_profile_id,
              name: session.worker_profile.name,
              worker_type: session.worker_profile.worker_type,
              checked_in_at: session.checkin_at,
              hours_on_site: ((Time.current - session.checkin_at) / 1.hour).round(1),
              gps_verified: session.gps_verified_checkin
            }
          end
        }
      end

      # ==========================================
      # APPROVAL WORKFLOW
      # ==========================================

      # POST /api/v1/site_presence_sessions/:id/approve
      def approve
        unless current_user.admin?
          return render json: { success: false, error: "Admin access required" }, status: :forbidden
        end

        @session.approve!(current_user)

        render json: {
          success: true,
          session: session_json(@session)
        }
      end

      # POST /api/v1/site_presence_sessions/:id/reject
      def reject
        unless current_user.admin?
          return render json: { success: false, error: "Admin access required" }, status: :forbidden
        end

        unless params[:reason].present?
          return render json: { success: false, error: "Rejection reason is required" }, status: :unprocessable_entity
        end

        @session.reject!(current_user, reason: params[:reason])

        render json: {
          success: true,
          session: session_json(@session)
        }
      end

      # POST /api/v1/site_presence_sessions/bulk_approve
      def bulk_approve
        unless current_user.admin?
          return render json: { success: false, error: "Admin access required" }, status: :forbidden
        end

        session_ids = params[:session_ids] || []
        approved_count = 0

        SitePresenceSession.where(id: session_ids, approval_status: "pending").find_each do |session|
          session.approve!(current_user)
          approved_count += 1
        end

        render json: {
          success: true,
          approved_count: approved_count
        }
      end

      # ==========================================
      # BREAKS
      # ==========================================

      # POST /api/v1/site_presence_sessions/:id/add_break
      def add_break
        unless @session.active?
          return render json: { success: false, error: "Can only add breaks to active sessions" }, status: :unprocessable_entity
        end

        minutes = params[:minutes].to_i
        @session.break_minutes = (@session.break_minutes || 0) + minutes
        @session.save!

        render json: {
          success: true,
          total_break_minutes: @session.break_minutes
        }
      end

      # ==========================================
      # WORKER PROFILES
      # ==========================================

      # GET /api/v1/site_presence_sessions/worker_profile
      # Get or create worker profile for current user
      def worker_profile
        profile = WorkerProfile.for_user(current_user)

        render json: {
          success: true,
          worker_profile: worker_profile_json(profile)
        }
      end

      private

      def set_session
        @session = SitePresenceSession.find(params[:id])
      end

      def set_worker_profile
        # First try to find existing profile for current user
        @worker_profile = WorkerProfile.find_by(user: current_user)

        # Auto-create if doesn't exist
        @worker_profile ||= WorkerProfile.for_user(current_user)
      end

      def should_auto_approve?(session)
        # Auto-approve if all verification passed and no critical anomalies
        return false if session.critical_anomalies?
        return false unless session.gps_verified_checkin && session.gps_verified_checkout

        # If face verification required, check it passed
        if session.job.require_face_verification
          return false unless session.face_verified_checkin && session.face_verified_checkout
        end

        true
      end

      def create_checkin_photo(job, params)
        photo_url = params[:photo_url]

        if params[:image_data].present?
          result = upload_to_cloudinary(params[:image_data])
          photo_url = result[:url] if result[:success]
        end

        return nil unless photo_url

        SmTaskPhoto.create!(
          job: job,
          photo_url: photo_url,
          photo_type: "checkin",
          is_checkin_photo: true,
          uploaded_by: current_user,
          latitude: params[:latitude],
          longitude: params[:longitude],
          taken_at: Time.current
        )
      end

      def create_checkout_photo(job, session, params)
        photo_url = params[:photo_url]

        if params[:image_data].present?
          result = upload_to_cloudinary(params[:image_data])
          photo_url = result[:url] if result[:success]
        end

        return nil unless photo_url

        SmTaskPhoto.create!(
          job: job,
          sm_task: session.sm_task,
          photo_url: photo_url,
          photo_type: "checkout",
          is_checkout_photo: true,
          uploaded_by: current_user,
          latitude: params[:latitude],
          longitude: params[:longitude],
          taken_at: Time.current
        )
      end

      def upload_to_cloudinary(base64_data)
        CloudinaryService.upload_base64(base64_data, folder: "site_presence_photos")
      rescue StandardError => e
        Rails.logger.error("Cloudinary upload failed: #{e.message}")
        { success: false, error: e.message }
      end

      def session_json(session, detailed: false, include_anomalies: false)
        json = {
          id: session.id,
          worker_profile_id: session.worker_profile_id,
          worker_name: session.worker_profile.name,
          worker_type: session.worker_profile.worker_type,
          job_id: session.job_id,
          job_name: session.job.name,
          task_id: session.sm_task_id,
          cost_centre_id: session.cost_centre_id,
          session_status: session.session_status,
          approval_status: session.approval_status,
          checkin_at: session.checkin_at,
          checkout_at: session.checkout_at,
          total_hours: session.total_hours,
          billable_hours: session.billable_hours,
          break_minutes: session.break_minutes,
          duration_display: session.duration_display,
          created_at: session.created_at
        }

        if detailed || include_anomalies
          json[:anomalies] = session.anomalies
          json[:has_critical_anomalies] = session.critical_anomalies?
        end

        if detailed
          json.merge!(
            latitude_checkin: session.latitude_checkin,
            longitude_checkin: session.longitude_checkin,
            latitude_checkout: session.latitude_checkout,
            longitude_checkout: session.longitude_checkout,
            distance_from_site_checkin: session.distance_from_site_checkin,
            distance_from_site_checkout: session.distance_from_site_checkout,
            gps_verified_checkin: session.gps_verified_checkin,
            gps_verified_checkout: session.gps_verified_checkout,
            face_verified_checkin: session.face_verified_checkin,
            face_verified_checkout: session.face_verified_checkout,
            face_confidence_checkin: session.face_confidence_checkin,
            face_confidence_checkout: session.face_confidence_checkout,
            checkin_photo_id: session.checkin_photo_id,
            checkout_photo_id: session.checkout_photo_id,
            checkin_photo_url: session.checkin_photo&.photo_url,
            checkout_photo_url: session.checkout_photo&.photo_url,
            worker_notes: session.worker_notes,
            admin_notes: session.admin_notes,
            approved_by_id: session.approved_by_id,
            approved_at: session.approved_at,
            rejection_reason: session.rejection_reason,
            labour_cost_entry: session.labour_cost_entry&.slice(
              :id, :regular_hours, :overtime_1_5x_hours, :overtime_2x_hours,
              :base_labour_cost, :employment_cost, :overhead_cost, :total_cost
            )
          )
        end

        json
      end

      def worker_profile_json(profile)
        {
          id: profile.id,
          user_id: profile.user_id,
          name: profile.name,
          worker_type: profile.worker_type,
          hourly_rate: profile.hourly_rate,
          face_verified: profile.face_verified,
          profile_photo_url: profile.profile_photo_url,
          active: profile.active,
          checked_in: profile.checked_in?,
          active_session_id: profile.active_session&.id
        }
      end
    end
  end
end

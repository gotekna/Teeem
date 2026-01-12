# frozen_string_literal: true

module Api
  module V1
    # BackgroundJobsController - API for tracking background job progress
    #
    # SSoT: BackgroundJobProgress model tracks progress for long-running jobs
    #
    # Endpoints:
    #   GET /api/v1/background_jobs/progress/:job_type
    #   GET /api/v1/background_jobs/progress/:job_type/:scope
    #
    class BackgroundJobsController < ApplicationController
      # GET /api/v1/background_jobs/progress/:job_type
      # Get active or recent progress for a job type
      #
      # Params:
      #   job_type: folder_reorganization, document_migration, etc.
      #   scope: optional scope filter (corporate, job, email, etc.)
      #   include_completed: true to include completed jobs (default: false)
      #
      def progress
        job_type = params[:job_type]
        scope = params[:scope]
        include_completed = params[:include_completed] == "true"

        # First try to find an active job
        active_job = BackgroundJobProgress.active_for(job_type: job_type, scope: scope)

        if active_job
          render json: {
            success: true,
            active: true,
            data: active_job.as_json
          }
        elsif include_completed
          # Return recent completed jobs
          recent_jobs = BackgroundJobProgress.recent_for(job_type: job_type, scope: scope, limit: 5)
          render json: {
            success: true,
            active: false,
            data: recent_jobs.map(&:as_json)
          }
        else
          render json: {
            success: true,
            active: false,
            data: nil
          }
        end
      end

      # GET /api/v1/background_jobs/:id
      # Get specific job progress by ID
      def show
        job = BackgroundJobProgress.find_by(id: params[:id]) ||
              BackgroundJobProgress.find_by(job_id: params[:id])

        if job
          render json: {
            success: true,
            data: job.as_json
          }
        else
          render json: {
            success: false,
            error: "Job not found"
          }, status: :not_found
        end
      end

      # GET /api/v1/background_jobs/active
      # Get all active jobs
      def active
        jobs = BackgroundJobProgress.active.recent.limit(20)

        render json: {
          success: true,
          data: jobs.map(&:as_json)
        }
      end

      # GET /api/v1/background_jobs/recent
      # Get recent jobs (including completed)
      def recent
        limit = [params[:limit].to_i, 50].min
        limit = 10 if limit <= 0

        jobs = BackgroundJobProgress.recent.limit(limit)

        render json: {
          success: true,
          data: jobs.map(&:as_json)
        }
      end
    end
  end
end

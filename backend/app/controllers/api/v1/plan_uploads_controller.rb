# frozen_string_literal: true

module Api
  module V1
    class PlanUploadsController < ApplicationController
      include DocumentProviderAware
      include PresignedUploadHandler

      before_action :set_job
      before_action :set_plan_upload, only: [:show, :resume]

      # GET /api/v1/jobs/:job_id/plan_uploads
      # List all plan uploads for a job
      def index
        @plan_uploads = @job.plan_uploads.recent.limit(10)

        render json: {
          success: true,
          data: @plan_uploads.map(&:as_json_status)
        }
      end

      # GET /api/v1/jobs/:job_id/plan_uploads/:id
      # Get status of a specific plan upload (for polling)
      def show
        render json: {
          success: true,
          data: @plan_upload.as_json_status
        }
      end

      # GET /api/v1/jobs/:job_id/plan_uploads/active
      # Get the currently active upload (if any)
      def active
        @plan_upload = @job.plan_uploads.active.recent.first

        if @plan_upload
          render json: {
            success: true,
            active: true,
            data: @plan_upload.as_json_status
          }
        else
          render json: {
            success: true,
            active: false,
            data: nil
          }
        end
      end

      # POST /api/v1/jobs/:job_id/plan_uploads
      # Upload a new plan set
      # SSoT: Uses PresignedUploadHandler for file uploads (supports both multipart and presigned URL)
      def create
        # SSoT: Accept either file upload or storage_key from presigned URL
        uploaded_file = resolve_uploaded_file(:file, :storage_key)
        unless uploaded_file
          return render json: { success: false, error: "No file provided. Use 'file' for multipart or 'storage_key' for presigned URL upload." }, status: :unprocessable_entity
        end

        # Check for existing active upload
        if @job.plan_uploads.active.exists?
          return render json: {
            success: false,
            error: "An upload is already in progress for this job"
          }, status: :conflict
        end

        # Ensure job has plan tabs
        ensure_job_has_plan_tabs

        tab_id = params[:job_plan_tab_id] || @job.job_plan_tabs.root_tabs.ordered.first&.id

        # Create PlanUpload record
        @plan_upload = @job.plan_uploads.create!(
          uploaded_by: current_user,
          job_plan_tab_id: tab_id,
          original_filename: uploaded_file.original_filename,
          file_size: uploaded_file.size,
          status: "pending"
        )

        # SSoT: Setup provider using WarehouseProvider
        begin
          setup_default_provider!
        rescue DocumentProviders::NotConnectedError => e
          @plan_upload.mark_failed!("Storage not connected: #{e.message}")
          return render json: { success: false, error: "Storage not connected: #{e.message}" }, status: :unprocessable_entity
        end

        begin
          @plan_upload.start_uploading!

          # Find or create staging folder at root
          staging_folder_path = "/#{PlanUpload.staging_folder_name}"
          get_or_create_folder_path(staging_folder_path)

          # Upload to staging folder
          staging_result = upload_to_provider(
            staging_folder_path,
            uploaded_file.read,
            @plan_upload.staging_filename,
            content_type: uploaded_file.content_type
          )

          @plan_upload.update!(staging_file_id: staging_result[:id])

          # Queue background job
          PlanSetUploadJob.perform_later(@plan_upload.id)

          render json: {
            success: true,
            data: @plan_upload.as_json_status,
            provider: current_provider_type.to_s
          }, status: :accepted

        rescue DocumentProviders::Error => e
          Rails.logger.error("[PlanUpload] Storage error: #{e.message}")
          @plan_upload.mark_failed!(e.message)
          render json: { success: false, error: "Storage error: #{e.message}" }, status: :bad_gateway
        rescue => e
          Rails.logger.error("[PlanUpload] Upload failed: #{e.message}")
          @plan_upload.mark_failed!(e.message)
          render json: { success: false, error: e.message }, status: :internal_server_error
        end
      end

      # POST /api/v1/jobs/:job_id/plan_uploads/:id/resume
      # Resume a failed upload
      def resume
        unless @plan_upload.can_resume?
          return render json: {
            success: false,
            error: "This upload cannot be resumed"
          }, status: :unprocessable_entity
        end

        @plan_upload.mark_retrying!
        PlanSetUploadJob.perform_later(@plan_upload.id)

        render json: {
          success: true,
          data: @plan_upload.as_json_status
        }
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_plan_upload
        @plan_upload = @job.plan_uploads.find(params[:id])
      end

      def ensure_job_has_plan_tabs
        return if @job.job_plan_tabs.exists?
        PlanCategory.create_tabs_for_job(@job)
      end
    end
  end
end

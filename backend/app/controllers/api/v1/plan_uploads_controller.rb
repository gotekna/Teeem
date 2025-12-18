# frozen_string_literal: true

module Api
  module V1
    class PlanUploadsController < ApplicationController
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
      def create
        unless params[:file].present?
          return render json: { success: false, error: "No file provided" }, status: :unprocessable_entity
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

        uploaded_file = params[:file]
        tab_id = params[:job_plan_tab_id] || @job.job_plan_tabs.root_tabs.ordered.first&.id

        # Create PlanUpload record
        @plan_upload = @job.plan_uploads.create!(
          uploaded_by: current_user,
          job_plan_tab_id: tab_id,
          original_filename: uploaded_file.original_filename,
          file_size: uploaded_file.size,
          status: "pending"
        )

        # Get SharePoint credential
        credential = OrganizationSharePointCredential.active_credential
        unless credential
          @plan_upload.mark_failed!("SharePoint not connected")
          return render json: { success: false, error: "SharePoint not connected" }, status: :unprocessable_entity
        end

        begin
          @plan_upload.start_uploading!

          client = MicrosoftGraphClient.new(credential)

          # Find or create staging folder
          staging_folder_id = get_or_create_staging_folder(client, credential)

          # Upload to staging folder
          staging_result = client.upload_file_content(
            staging_folder_id,
            @plan_upload.staging_filename,
            uploaded_file.read
          )

          @plan_upload.update!(staging_file_id: staging_result[:id])

          # Queue background job
          PlanSetUploadJob.perform_later(@plan_upload.id)

          render json: {
            success: true,
            data: @plan_upload.as_json_status
          }, status: :accepted

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

      def get_or_create_staging_folder(client, credential)
        staging_folder_name = PlanUpload.staging_folder_name

        # Try to find existing staging folder in root
        begin
          drive_path = credential.drive_id.present? ? "/drives/#{credential.drive_id}" : "/me/drive"
          response = client.get("#{drive_path}/root/children")
          folders = response["value"] || []
          staging_folder = folders.find { |f| f["name"] == staging_folder_name && f["folder"] }

          if staging_folder
            return staging_folder["id"]
          end
        rescue => e
          Rails.logger.warn("[PlanUpload] Error finding staging folder: #{e.message}")
        end

        # Create staging folder
        result = client.create_folder(staging_folder_name)
        result["id"]
      end
    end
  end
end

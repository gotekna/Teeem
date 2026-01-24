# frozen_string_literal: true

# =============================================================================
# BatchOperationsController - THE SSoT for all batch operation progress tracking
# =============================================================================
# Unified API for all batch operations:
#   - plan_upload: Upload and split multi-page PDF into plans
#   - plan_reextract: Re-extract and rename existing plans from PDF
#   - folder_scan: Scan SharePoint folders for new plan files
#   - folder_process: Process pending scanned files into plans
#
# Routes:
#   Job-scoped operations:
#     POST   /api/v1/jobs/:job_id/batch_operations (type: plan_upload, plan_reextract)
#     GET    /api/v1/jobs/:job_id/batch_operations/:id
#     GET    /api/v1/jobs/:job_id/batch_operations/active
#
#   Global operations:
#     POST   /api/v1/batch_operations (type: folder_scan, folder_process)
#     GET    /api/v1/batch_operations/:id
#     GET    /api/v1/batch_operations/active
# =============================================================================
module Api
  module V1
    class BatchOperationsController < ApplicationController
      include DocumentProviderAware

      before_action :set_job, only: [:create, :show, :active], if: -> { params[:job_id].present? }
      before_action :set_operation, only: [:show]

      # GET /api/v1/batch_operations/:id
      # GET /api/v1/jobs/:job_id/batch_operations/:id
      # Poll for progress
      def show
        render json: {
          success: true,
          data: @operation.as_json_status
        }
      end

      # GET /api/v1/batch_operations/active
      # GET /api/v1/jobs/:job_id/batch_operations/active
      # Get active operation (optionally filtered by type)
      def active
        scope = @job ? @job.batch_operations : BatchOperation
        scope = scope.where(operation_type: params[:type]) if params[:type].present?

        operation = scope.active.recent.first

        if operation
          render json: {
            success: true,
            active: true,
            data: operation.as_json_status
          }
        else
          render json: {
            success: true,
            active: false,
            data: nil
          }
        end
      end

      # POST /api/v1/batch_operations
      # POST /api/v1/jobs/:job_id/batch_operations
      # Start a new batch operation
      def create
        operation_type = params[:operation_type] || params[:type]

        unless BatchOperation::OPERATION_TYPES.include?(operation_type)
          return render json: {
            success: false,
            error: "Invalid operation type. Must be one of: #{BatchOperation::OPERATION_TYPES.join(', ')}"
          }, status: :unprocessable_entity
        end

        # Route to specific handler based on operation type
        case operation_type
        when "plan_upload"
          create_plan_upload
        when "plan_reextract"
          create_plan_reextract
        when "folder_scan"
          create_folder_scan
        when "folder_process"
          create_folder_process
        end
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_operation
        if @job
          @operation = @job.batch_operations.find(params[:id])
        else
          @operation = BatchOperation.find(params[:id])
        end
      end

      # ============================================================================
      # Operation Creators
      # ============================================================================

      def create_plan_upload
        unless @job
          return render json: { success: false, error: "job_id required for plan_upload" }, status: :unprocessable_entity
        end

        unless params[:file].present?
          return render json: { success: false, error: "No file provided" }, status: :unprocessable_entity
        end

        # Check for existing active upload
        if @job.batch_operations.plan_uploads.active.exists?
          return render json: {
            success: false,
            error: "An upload is already in progress for this job"
          }, status: :conflict
        end

        uploaded_file = params[:file]
        tab_id = params[:job_plan_tab_id] || @job.job_plan_tabs.root_tabs.ordered.first&.id

        # Create BatchOperation record
        operation = BatchOperation.create_plan_upload!(
          job: @job,
          user: current_user,
          filename: uploaded_file.original_filename,
          tab_id: tab_id
        )

        # Store additional metadata
        operation.metadata = operation.metadata.merge(
          "file_size" => uploaded_file.size
        )
        operation.save!

        # SSoT: Setup provider using StorageConfiguration
        begin
          setup_default_provider!
        rescue DocumentProviders::NotConnectedError => e
          operation.mark_failed!("Storage not connected: #{e.message}")
          return render json: { success: false, error: "Storage not connected: #{e.message}" }, status: :unprocessable_entity
        end

        begin
          operation.update!(current_step: "Uploading to storage...")

          # Find or create staging folder at root
          staging_folder_path = "/#{BatchOperation.staging_folder_name}"
          get_or_create_folder_path(staging_folder_path)

          # Upload to staging folder
          staging_filename = "staging_#{operation.id}_#{uploaded_file.original_filename}"
          staging_result = upload_to_provider(
            staging_folder_path,
            uploaded_file.read,
            staging_filename,
            content_type: uploaded_file.content_type
          )

          operation.staging_file_id = staging_result[:id]
          operation.save!

          # Queue background job
          BatchPlanUploadJob.perform_later(operation.id)

          render json: {
            success: true,
            data: operation.as_json_status,
            provider: current_provider_type.to_s
          }, status: :accepted

        rescue DocumentProviders::Error => e
          Rails.logger.error("[BatchOperation] Storage error: #{e.message}")
          operation.mark_failed!(e.message)
          render json: { success: false, error: "Storage error: #{e.message}" }, status: :bad_gateway
        rescue => e
          Rails.logger.error("[BatchOperation] Upload failed: #{e.message}")
          operation.mark_failed!(e.message)
          render json: { success: false, error: e.message }, status: :internal_server_error
        end
      end

      def create_plan_reextract
        unless @job
          return render json: { success: false, error: "job_id required for plan_reextract" }, status: :unprocessable_entity
        end

        # Check for existing active reextraction
        if @job.batch_operations.plan_reextracts.active.exists?
          return render json: {
            success: false,
            error: "A re-extraction is already in progress for this job"
          }, status: :conflict
        end

        # Create BatchOperation record
        operation = BatchOperation.create_plan_reextract!(
          job: @job,
          user: current_user
        )

        # Queue background job
        BatchPlanReextractionJob.perform_later(operation.id)

        render json: {
          success: true,
          data: operation.as_json_status
        }
      end

      def create_folder_scan
        # Check for existing active scan
        if BatchOperation.folder_scans.active.exists?
          return render json: {
            success: false,
            error: "A folder scan is already in progress"
          }, status: :conflict
        end

        # Create BatchOperation record
        operation = BatchOperation.create_folder_scan!(
          user: current_user
        )

        # Queue background job
        BatchFolderScanJob.perform_later(operation.id)

        render json: {
          success: true,
          data: operation.as_json_status
        }
      end

      def create_folder_process
        # Check for existing active process
        if BatchOperation.folder_processes.active.exists?
          return render json: {
            success: false,
            error: "A folder process is already in progress"
          }, status: :conflict
        end

        # Create BatchOperation record
        operation = BatchOperation.create_folder_process!(
          user: current_user
        )

        # Queue background job
        BatchFolderProcessJob.perform_later(operation.id)

        render json: {
          success: true,
          data: operation.as_json_status
        }
      end

      # ============================================================================
      # Helpers
      # ============================================================================

      def get_or_create_staging_folder(client, credential)
        staging_folder_name = "_plan_staging"

        begin
          # SSoT: Get drive path from StorageConfiguration (Jan 2026)
          storage_drive_id = StorageConfiguration.instance&.drive_id
          drive_path = storage_drive_id.present? ? "/drives/#{storage_drive_id}" : "/me/drive"
          response = client.get("#{drive_path}/root/children")
          folders = response["value"] || []
          staging_folder = folders.find { |f| f["name"] == staging_folder_name && f["folder"] }

          return staging_folder["id"] if staging_folder
        rescue => e
          Rails.logger.warn("[BatchOperation] Error finding staging folder: #{e.message}")
        end

        # Create staging folder
        result = client.create_folder(staging_folder_name)
        result["id"]
      end
    end
  end
end

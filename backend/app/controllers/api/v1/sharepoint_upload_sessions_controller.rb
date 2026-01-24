module Api
  module V1
    # ULTRA MASTERPIECE: Direct Browser-to-Storage Uploads
    # This controller provides pre-authenticated upload URLs that browsers can use
    # to upload files directly to storage, bypassing the Heroku proxy entirely.
    #
    # NOTE: Currently SharePoint-only. For S3/Wasabi, use presigned URLs via a different endpoint.
    # TODO: Add S3/Wasabi presigned URL support for provider-agnostic direct uploads.
    #
    # Benefits:
    # - 50% faster uploads (1 hop instead of 2)
    # - Zero Heroku bandwidth/memory usage for file data
    # - No timeout risk
    # - Progress tracking possible
    #
    # Flow:
    # 1. Browser calls POST /upload_session → gets pre-authenticated uploadUrl
    # 2. Browser uploads directly to storage (uploadUrl contains embedded token)
    # 3. Browser calls POST /upload_complete → logs activity + indexes in warehouse
    class SharepointUploadSessionsController < ApplicationController
      include DocumentProviderAware

      # Authentication is handled by ApplicationController's authorize_request before_action

      # POST /api/v1/sharepoint/upload_session
      # Returns a pre-authenticated URL for direct browser upload to SharePoint
      # NOTE: Currently SharePoint-only feature
      #
      # Params:
      #   - filename: (required) Name for the uploaded file
      #   - file_size: (required) Size in bytes (for chunked upload decisions)
      #   - folder_id: (optional) Direct SharePoint folder ID
      #   - folder_path: (optional) Path like "06 Photo/01 SITE" (navigates from job folder)
      #   - job_id: (optional) Job ID for folder path navigation
      #
      # Response:
      #   {
      #     success: true,
      #     upload_url: "https://...",  # Pre-authenticated, browser can PUT directly
      #     expiration: "2025-12-30T15:00:00Z",
      #     filename: "sanitized_filename.jpg",
      #     folder_id: "folder_xyz",
      #     chunk_size: 5242880,  # 5MB recommended chunks
      #     file_size: 15728640
      #   }
      def create
        # Check storage provider - this feature is SharePoint-only for now
        begin
          setup_default_provider!
          unless current_provider_type == :sharepoint
            return render json: {
              success: false,
              error: "Direct upload sessions are only available for SharePoint storage. Current provider: #{current_provider_type}. Use standard upload endpoints for #{current_provider_type}."
            }, status: :unprocessable_entity
          end
        rescue DocumentProviders::NotConnectedError
          # Fall through to SharePoint credential check below
        end

        credential = MicrosoftCredential.sharepoint_credential
        unless credential&.valid_credential?
          return render json: {
            success: false,
            error: "SharePoint not connected. Please connect in Admin > System > Connections."
          }, status: :unauthorized
        end

        filename = params[:filename]
        file_size = params[:file_size].to_i
        folder_id = params[:folder_id]
        folder_path = params[:folder_path]
        job_id = params[:job_id]

        unless filename.present? && file_size > 0
          return render json: {
            success: false,
            error: "filename and file_size are required"
          }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Navigate to folder if path provided (instead of direct folder_id)
          if folder_path.present? && job_id.present?
            job = Job.find(job_id)

            # SSoT: Strip {{JobCode}} placeholder if present
            clean_path = folder_path.gsub(/\{\{JobCode\}\}\s*\/?/, "").gsub(/^\/+/, "")

            # Find or create job folder structure
            job_folder = client.find_job_folder(job)
            unless job_folder && job_folder["id"].present?
              job_folder = client.create_job_folder_structure(job)
            end

            # Navigate to target folder within job
            target_folder = navigate_to_folder(client, credential, job_folder["id"], clean_path)
            folder_id = target_folder["id"]
          end

          unless folder_id.present?
            return render json: {
              success: false,
              error: "folder_id or folder_path with job_id required"
            }, status: :bad_request
          end

          # Sanitize filename for SharePoint
          safe_filename = SharePoint::FilenameSanitizer.sanitize(filename)

          # Create upload session - returns pre-authenticated URL
          # The uploadUrl contains an embedded token - browsers can PUT directly to it
          # NO Authorization header needed (actually breaks if included)
          session = client.create_upload_session(folder_id, safe_filename, file_size)

          unless session && session["uploadUrl"].present?
            return render json: {
              success: false,
              error: "Failed to create upload session"
            }, status: :unprocessable_entity
          end

          Rails.logger.info "[SharePointUploadSession] Created session for #{safe_filename} (#{file_size} bytes) in folder #{folder_id}"

          render json: {
            success: true,
            upload_url: session["uploadUrl"],
            expiration: session["expirationDateTime"],
            filename: safe_filename,
            folder_id: folder_id,
            # Frontend needs these for chunked upload decisions
            chunk_size: 5.megabytes,  # Recommended chunk size (multiple of 320KiB)
            file_size: file_size
          }
        rescue MicrosoftGraphClient::APIError => e
          Rails.logger.error "[SharePointUploadSession] API error: #{e.message}"
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        rescue ActiveRecord::RecordNotFound => e
          render json: { success: false, error: "Job not found" }, status: :not_found
        rescue => e
          Rails.logger.error "[SharePointUploadSession] Unexpected error: #{e.class} - #{e.message}"
          render json: { success: false, error: "Failed to create upload session" }, status: :internal_server_error
        end
      end

      # POST /api/v1/sharepoint/upload_complete
      # Called by browser after direct upload completes successfully
      # Updates: 1) JobActivity (audit trail), 2) JobDocument (warehouse indexing)
      #
      # Params:
      #   - job_id: (optional) Job ID for activity logging and indexing
      #   - filename: (required) Uploaded filename
      #   - file_size: (optional) File size in bytes
      #   - folder_path: (optional) Folder path for indexing
      #   - web_url: (optional) SharePoint web URL
      #   - sharepoint_item_id: (required for indexing) SharePoint item ID
      def complete
        job = Job.find(params[:job_id]) if params[:job_id].present?

        # 1. Log the activity (audit trail)
        if job && params[:filename].present?
          JobActivity.log_document_uploaded(
            job,
            document_name: params[:filename],
            document_url: params[:web_url],
            user: current_user
          )
          Rails.logger.info "[SharePointUploadSession] Logged activity for #{params[:filename]} on job #{job.id}"
        end

        # 2. Create/update JobDocument for immediate warehouse indexing
        # This happens immediately instead of waiting for JobDocumentSyncJob
        if job && params[:sharepoint_item_id].present?
          job_doc = JobDocument.find_or_initialize_by(
            job: job,
            sharepoint_item_id: params[:sharepoint_item_id]
          )

          # Detect document type from extension
          extension = File.extname(params[:filename].to_s).delete(".").downcase
          doc_type = DocumentType.find_by_extension(extension) if extension.present?

          job_doc.update!(
            file_name: params[:filename],
            file_size: params[:file_size].to_i,
            folder_path: params[:folder_path],
            web_url: params[:web_url],
            last_modified_at: Time.current,
            last_modified_by: current_user&.name,
            sync_status: "synced",
            last_synced_at: Time.current,
            document_type: doc_type
          )
          Rails.logger.info "[SharePointUploadSession] Indexed JobDocument #{job_doc.id} for #{params[:filename]}"
        end

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: "Job not found" }, status: :not_found
      rescue => e
        Rails.logger.error "[SharePointUploadSession] Complete error: #{e.class} - #{e.message}"
        # Don't fail the whole request - file is already uploaded
        render json: { success: true, warning: "Upload succeeded but indexing failed" }
      end

      private

      # Navigate to a folder path within a parent folder, creating folders if needed
      # Reuses logic from job_photos_controller
      # SSoT: Uses StorageConfiguration for drive_id (Jan 2026)
      def navigate_to_folder(client, credential, parent_folder_id, path)
        return { "id" => parent_folder_id } if path.blank?

        # SSoT: Get drive path from StorageConfiguration
        storage_drive_id = StorageConfiguration.instance&.drive_id
        drive_path = storage_drive_id.present? ? "/drives/#{storage_drive_id}" : "/me/drive"
        current_folder_id = parent_folder_id

        path.split("/").each do |folder_name|
          next if folder_name.blank?

          # List children of current folder
          begin
            children = client.get("#{drive_path}/items/#{current_folder_id}/children")
            existing = children["value"]&.find { |c| c["name"].downcase == folder_name.downcase && c["folder"] }

            if existing
              current_folder_id = existing["id"]
            else
              # Create the folder
              new_folder = client.post(
                "#{drive_path}/items/#{current_folder_id}/children",
                {
                  name: folder_name,
                  folder: {},
                  "@microsoft.graph.conflictBehavior": "rename"
                }
              )
              current_folder_id = new_folder["id"]
              Rails.logger.info "[SharePointUploadSession] Created folder: #{folder_name}"
            end
          rescue MicrosoftGraphClient::APIError => e
            Rails.logger.error "[SharePointUploadSession] Folder navigation error: #{e.message}"
            raise
          end
        end

        { "id" => current_folder_id }
      end
    end
  end
end

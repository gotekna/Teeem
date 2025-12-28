module Api
  module V1
    # RENAMED: OneDriveController → SharepointFilesController
    class SharepointFilesController < ApplicationController
      before_action :set_job, only: [ :authorize, :callback, :status, :disconnect ]

      # GET /api/v1/onedrive/authorize?construction_id=123
      # Redirects user to Microsoft OAuth consent page
      def authorize
        # Generate state token to prevent CSRF
        state = SecureRandom.urlsafe_base64(32)

        # Store state in session for verification in callback
        session[:onedrive_state] = state
        session[:onedrive_construction_id] = @job.id

        # Get redirect URI from env
        redirect_uri = ENV["ONEDRIVE_REDIRECT_URI"]

        # Generate authorization URL
        auth_url = MicrosoftGraphClient.authorization_url(redirect_uri, state)

        # Redirect user to Microsoft login
        redirect_to auth_url, allow_other_host: true
      end

      # GET /api/v1/onedrive/callback?code=xxx&state=xxx
      # Handles OAuth callback from Microsoft
      def callback
        # Verify state to prevent CSRF
        unless params[:state] == session[:onedrive_state]
          return render json: { error: "Invalid state parameter. Possible CSRF attack." }, status: :forbidden
        end

        # Check for errors from Microsoft
        if params[:error]
          error_message = params[:error_description] || params[:error]
          return render json: { error: "Authorization failed: #{error_message}" }, status: :bad_request
        end

        # Retrieve construction from session
        construction_id = session[:onedrive_construction_id]
        @job = Job.find_by(id: construction_id)

        unless @job
          return render json: { error: "Construction not found" }, status: :not_found
        end

        # Exchange code for tokens
        code = params[:code]
        redirect_uri = ENV["ONEDRIVE_REDIRECT_URI"]

        begin
          token_data = MicrosoftGraphClient.exchange_code_for_token(code, redirect_uri)

          # Create or update credential
          credential = @job.one_drive_credential || @job.build_one_drive_credential

          credential.update!(
            access_token: token_data[:access_token],
            refresh_token: token_data[:refresh_token],
            token_expires_at: token_data[:expires_at]
          )

          # Clear session data
          session.delete(:onedrive_state)
          session.delete(:onedrive_construction_id)

          # Redirect to frontend with success message
          # TODO: Update this URL to match your frontend route
          redirect_to "#{ENV['FRONTEND_URL']}/jobs/#{@job.id}?onedrive=connected", allow_other_host: true

        rescue MicrosoftGraphClient::AuthenticationError => e
          Rails.logger.error "OneDrive authentication failed: #{e.message}"
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error "OneDrive callback error: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to connect to OneDrive: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/onedrive/status?construction_id=123
      # Check if OneDrive is connected for a construction
      def status
        credential = @job.one_drive_credential

        if credential&.valid_credential?
          render json: {
            connected: true,
            drive_id: credential.drive_id,
            root_folder_id: credential.root_folder_id,
            folder_path: credential.folder_path,
            metadata: credential.metadata
          }
        else
          render json: {
            connected: false,
            message: credential ? "Credential expired or invalid" : "Not connected"
          }
        end
      end

      # DELETE /api/v1/onedrive/disconnect?construction_id=123
      # Disconnect OneDrive for a construction
      def disconnect
        credential = @job.one_drive_credential

        if credential
          credential.destroy
          render json: { message: "OneDrive disconnected successfully" }
        else
          render json: { message: "OneDrive was not connected" }, status: :not_found
        end
      end

      # POST /api/v1/onedrive/create_folders?construction_id=123
      # Create folder structure for a construction
      def create_folders
        construction_id = params[:job_id]
        @job = Job.find(construction_id)

        credential = @job.one_drive_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected or token expired" }, status: :unauthorized
        end

        # SSoT: Folder structure comes from EntityTab hierarchy (no longer uses FolderTemplate)
        # template_id parameter is deprecated and ignored

        begin
          client = MicrosoftGraphClient.new(credential)
          # Use create_job_folder_structure which now uses EntityTab hierarchy
          root_folder = client.create_job_folder_structure(@job)

          render json: {
            message: "Folder structure created successfully",
            root_folder: root_folder,
            folder_path: credential.folder_path,
            web_url: root_folder["webUrl"]
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to create folders: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to create folders: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/onedrive/folders?construction_id=123&folder_id=xxx
      # List folders and files
      def list_items
        construction_id = params[:job_id]
        @job = Job.find(construction_id)

        credential = @job.one_drive_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected or token expired" }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)
          folder_id = params[:folder_id]

          items = client.list_folder_items(folder_id)

          render json: {
            items: items["value"],
            count: items["value"]&.length || 0
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to list items: #{e.message}"
          render json: { error: "Failed to list items: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/onedrive/upload?construction_id=123&folder_id=xxx
      # Upload file to OneDrive
      def upload
        construction_id = params[:job_id]
        @job = Job.find(construction_id)

        credential = @job.one_drive_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected or token expired" }, status: :unauthorized
        end

        uploaded_file = params[:file]
        folder_id = params[:folder_id] || credential.root_folder_id

        unless uploaded_file
          return render json: { error: "No file provided" }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Check file size to determine upload method
          file_size = uploaded_file.size

          if file_size < 4.megabytes
            # Simple upload for small files
            result = client.upload_file(uploaded_file, folder_id, uploaded_file.original_filename)
          else
            # For large files, create upload session
            session_data = client.create_upload_session(folder_id, uploaded_file.original_filename, file_size)

            # Return upload session URL for client to handle chunked upload
            return render json: {
              upload_session: session_data,
              message: "Upload session created. Use upload URL for chunked upload."
            }
          end

          render json: {
            message: "File uploaded successfully",
            file: result
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to upload file: #{e.message}"
          render json: { error: "Failed to upload file: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/onedrive/download?construction_id=123&file_id=xxx
      # Download file from OneDrive
      def download
        construction_id = params[:job_id]
        @job = Job.find(construction_id)

        credential = @job.one_drive_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected or token expired" }, status: :unauthorized
        end

        file_id = params[:file_id]

        unless file_id
          return render json: { error: "No file_id provided" }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Get file metadata first
          file_metadata = client.get_file(file_id)

          # Download file content
          file_content = client.download_file(file_id)

          # Send file to user
          send_data file_content,
            filename: file_metadata["name"],
            type: file_metadata["file"]&.dig("mimeType") || "application/octet-stream",
            disposition: "attachment"

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to download file: #{e.message}"
          render json: { error: "Failed to download file: #{e.message}" }, status: :internal_server_error
        end
      end

      private

      def set_job
        construction_id = params[:job_id]

        unless construction_id
          return render json: { error: "construction_id parameter is required" }, status: :bad_request
        end

        @job = Job.find_by(id: construction_id)

        unless @job
          render json: { error: "Construction not found" }, status: :not_found
        end
      end
    end
  end
end

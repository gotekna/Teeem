module Api
  module V1
    class OrganizationOnedriveController < ApplicationController
      # Require admin for sensitive operations
      before_action :require_admin, only: [:disconnect, :change_root_folder, :sync_pricebook_images]

      # GET /api/v1/organization_onedrive/status
      # Check if organization has OneDrive connected
      def status
        credential = OrganizationOneDriveCredential.active_credential

        if credential&.valid_credential?
          render json: {
            connected: true,
            drive_id: credential.drive_id,
            drive_name: credential.drive_name,
            root_folder_id: credential.root_folder_id,
            root_folder_path: credential.root_folder_path,
            root_folder_web_url: credential.metadata&.dig('root_folder_web_url'),
            connected_at: credential.created_at,
            connected_by: credential.connected_by&.as_json(only: [:id, :email]),
            metadata: credential.metadata
          }
        else
          render json: {
            connected: false,
            message: credential ? 'Credential expired or invalid' : 'Not connected'
          }
        end
      end

      # GET /api/v1/organization_onedrive/authorize
      # Start OAuth flow - returns authorization URL
      def authorize
        redirect_uri = "#{request.base_url}/api/v1/organization_onedrive/callback"

        auth_url = MicrosoftGraphClient.authorization_url(
          client_id: ENV['ONEDRIVE_CLIENT_ID'],
          redirect_uri: redirect_uri,
          scope: 'Files.ReadWrite.All Sites.ReadWrite.All offline_access'
        )

        render json: { auth_url: auth_url }
      end

      # GET /api/v1/organization_onedrive/callback
      # OAuth callback - exchange code for tokens
      def callback
        code = params[:code]

        unless code
          return render json: { error: 'Authorization code not provided' }, status: :bad_request
        end

        begin
          Rails.logger.info "=== OneDrive OAuth Callback Started ==="

          redirect_uri = "#{request.base_url}/api/v1/organization_onedrive/callback"

          # Exchange authorization code for tokens
          token_data = MicrosoftGraphClient.exchange_code_for_tokens(
            code: code,
            client_id: ENV['ONEDRIVE_CLIENT_ID'],
            client_secret: ENV['ONEDRIVE_CLIENT_SECRET'],
            redirect_uri: redirect_uri
          )

          Rails.logger.info "Token exchange successful"

          # Deactivate any existing credentials
          OrganizationOneDriveCredential.where(is_active: true).update_all(is_active: false)

          # Create new credential with refresh token
          credential = OrganizationOneDriveCredential.create!(
            access_token: token_data[:access_token],
            refresh_token: token_data[:refresh_token],
            token_expires_at: token_data[:expires_at],
            connected_by: current_user,
            is_active: true
          )

          Rails.logger.info "Credential created with ID: #{credential.id}"

          # Initialize client and set up drive
          client = MicrosoftGraphClient.new(credential)

          # Create root folder for all jobs
          Rails.logger.info "Creating root folder 'TEEEM Jobs'..."
          root_folder = client.create_jobs_root_folder("TEEEM Jobs")
          Rails.logger.info "Root folder created successfully"

          Rails.logger.info "=== OneDrive Connection Completed Successfully ==="

          # Dynamically determine frontend URL based on request origin
          frontend_url = get_frontend_url_from_request

          # Redirect to frontend settings page with success message
          redirect_to "#{frontend_url}/settings?onedrive=connected", allow_other_host: true

        rescue MicrosoftGraphClient::AuthenticationError => e
          Rails.logger.error "=== OneDrive Authentication Failed ==="
          Rails.logger.error "Error: #{e.message}"
          frontend_url = get_frontend_url_from_request
          redirect_to "#{frontend_url}/settings?onedrive=error&message=#{CGI.escape(e.message)}", allow_other_host: true
        rescue StandardError => e
          Rails.logger.error "=== OneDrive Connection Failed ==="
          Rails.logger.error "Error: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          frontend_url = get_frontend_url_from_request
          redirect_to "#{frontend_url}/settings?onedrive=error&message=#{CGI.escape(e.message)}", allow_other_host: true
        end
      end

      # DELETE /api/v1/organization_onedrive/disconnect
      # Disconnect OneDrive for organization
      def disconnect
        credential = OrganizationOneDriveCredential.active_credential

        if credential
          credential.deactivate!
          render json: { message: 'OneDrive disconnected successfully' }
        else
          render json: { message: 'OneDrive was not connected' }, status: :not_found
        end
      end

      # PATCH /api/v1/organization_onedrive/change_root_folder
      # Change the root folder for organization OneDrive
      # Supports nested folder paths like "00 - TEEEM/Photos for Price Book"
      def change_root_folder
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        folder_path = params[:folder_name]

        if folder_path.blank?
          return render json: { error: 'Folder name is required' }, status: :bad_request
        end

        # Validate folder path to prevent path traversal attacks
        # Allow forward slashes for nested paths, but block ".." and backslashes
        if folder_path.include?('..') || folder_path.include?('\\')
          return render json: { error: 'Invalid folder path. Folder paths cannot contain ".." or "\\" characters.' }, status: :bad_request
        end

        # Validate length
        if folder_path.length > 1000
          return render json: { error: 'Folder path is too long (maximum 1000 characters)' }, status: :bad_request
        end

        # Validate each path segment
        path_segments = folder_path.split('/')
        if path_segments.any?(&:blank?)
          return render json: { error: 'Invalid folder path. Empty path segments are not allowed.' }, status: :bad_request
        end

        # Sanitize each path segment (allow alphanumeric, spaces, hyphens, underscores)
        sanitized_segments = path_segments.map do |segment|
          segment.gsub(/[^a-zA-Z0-9\s\-_]/, '').strip
        end

        if sanitized_segments.any?(&:blank?)
          return render json: { error: 'Folder path contains invalid characters' }, status: :bad_request
        end

        sanitized_path = sanitized_segments.join('/')

        begin
          client = MicrosoftGraphClient.new(credential)

          # Navigate through nested folder path, creating folders as needed
          current_parent_path = "/me/drive/root"
          current_folder = nil

          sanitized_segments.each do |folder_name|
            # Get children of current parent
            response = client.get("#{current_parent_path}/children")
            folders = response['value'] || []

            # Find folder in current level
            folder = folders.find { |f| f['name'] == folder_name && f['folder'] }

            if folder
              # Folder exists, use it
              current_folder = folder
              current_parent_path = "/me/drive/items/#{folder['id']}"
            else
              # Create folder at this level
              folder = client.post("#{current_parent_path}/children", {
                name: folder_name,
                folder: {},
                '@microsoft.graph.conflictBehavior' => 'fail'
              })
              current_folder = folder
              current_parent_path = "/me/drive/items/#{folder['id']}"
            end
          end

          # Update credential with new root folder info
          credential.update!(
            root_folder_id: current_folder['id'],
            root_folder_path: sanitized_path,
            metadata: credential.metadata.merge({
              root_folder_name: sanitized_segments.last,
              root_folder_web_url: current_folder['webUrl'],
              updated_at: Time.current
            })
          )

          render json: {
            message: 'Root folder updated successfully',
            root_folder_path: sanitized_path,
            root_folder_web_url: current_folder['webUrl']
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to change root folder: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to change root folder: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/organization_onedrive/browse_folders
      # Browse OneDrive folders - optionally within a specific folder
      def browse_folders
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        folder_id = params[:folder_id] # Optional - if not provided, browse root

        begin
          client = MicrosoftGraphClient.new(credential)

          # Get folders in the specified location
          if folder_id.present?
            # Browse children of specific folder
            response = client.list_folder_items(folder_id)
          else
            # Browse root drive folders
            response = client.get('/me/drive/root/children')
          end

          # Filter to only show folders
          folders = (response['value'] || []).select { |item| item['folder'] }

          # Format response
          formatted_folders = folders.map do |folder|
            {
              id: folder['id'],
              name: folder['name'],
              web_url: folder['webUrl'],
              created_at: folder['createdDateTime'],
              child_count: folder.dig('folder', 'childCount') || 0
            }
          end

          render json: {
            folders: formatted_folders,
            parent_folder_id: folder_id
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to browse folders: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to browse folders: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/create_all_job_folders
      # Create folder structure for ALL jobs that don't have folders yet
      def create_all_job_folders
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected. Please connect in Settings first.' }, status: :unauthorized
        end

        # Get folder template (use default or specified)
        template_id = params[:template_id]
        template = if template_id
          FolderTemplate.find(template_id)
        else
          FolderTemplate.where(is_system_default: true, is_active: true).first
        end

        unless template
          return render json: { error: 'No folder template found' }, status: :not_found
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Get all jobs
          jobs = Job.all
          created_count = 0
          skipped_count = 0
          errors = []

          jobs.each do |job|
            begin
              # Check if job folder already exists
              existing_folder = client.find_job_folder(job)

              if existing_folder
                skipped_count += 1
                Rails.logger.info "Skipping job ##{job.id} - folder already exists"
                next
              end

              # Create folder structure for this job
              job_folder = client.create_job_folder_structure(job, template)
              created_count += 1

              Rails.logger.info "Created folders for job ##{job.id}: #{job_folder['name']}"

            rescue StandardError => e
              errors << { job_id: job.id, job_title: job.title, error: e.message }
              Rails.logger.error "Failed to create folders for job ##{job.id}: #{e.message}"
            end
          end

          # Mark credential as synced
          credential.mark_synced!

          render json: {
            message: "Bulk folder creation completed",
            total_jobs: jobs.count,
            created: created_count,
            skipped: skipped_count,
            errors: errors
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to create bulk job folders: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to create folders: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/create_job_folders
      # Create folder structure for a specific job
      def create_job_folders
        construction_id = params[:job_id]
        construction = Job.find(construction_id)

        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected. Please connect in Settings first.' }, status: :unauthorized
        end

        # Get folder template (use default or specified)
        template_id = params[:template_id]
        template = if template_id
          FolderTemplate.find(template_id)
        else
          FolderTemplate.where(is_system_default: true, is_active: true).first
        end

        unless template
          return render json: { error: 'No folder template found' }, status: :not_found
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Check if job folder already exists
          existing_folder = client.find_job_folder(construction)

          if existing_folder
            return render json: {
              message: 'Folder structure already exists for this job',
              job_folder: existing_folder,
              web_url: existing_folder['webUrl']
            }
          end

          # Create folder structure for this job
          job_folder = client.create_job_folder_structure(construction, template)

          # Mark credential as synced
          credential.mark_synced!

          render json: {
            message: 'Folder structure created successfully',
            job_folder: job_folder,
            folder_path: "#{credential.root_folder_path}/#{job_folder['name']}",
            web_url: job_folder['webUrl']
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to create job folders: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to create folders: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/organization_onedrive/job_folders
      # List folders and files for a specific job
      def list_job_items
        construction_id = params[:job_id]
        construction = Job.find(construction_id)

        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Find the job folder
          job_folder = client.find_job_folder(construction)

          unless job_folder
            return render json: {
              error: 'Job folder not found. Please create the folder structure first.',
              job_folder_exists: false
            }, status: :not_found
          end

          # Get folder ID from params or use job folder
          folder_id = params[:folder_id] || job_folder['id']

          items = client.list_folder_items(folder_id)

          render json: {
            items: items['value'],
            count: items['value']&.length || 0,
            job_folder_id: job_folder['id'],
            job_folder_web_url: job_folder['webUrl']
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

      # POST /api/v1/organization_onedrive/upload
      # Upload file to OneDrive
      def upload
        construction_id = params[:job_id]
        construction = Job.find(construction_id)

        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        uploaded_file = params[:file]
        folder_id = params[:folder_id]

        unless uploaded_file
          return render json: { error: 'No file provided' }, status: :bad_request
        end

        unless folder_id
          return render json: { error: 'No folder_id provided' }, status: :bad_request
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
              message: 'Upload session created. Use upload URL for chunked upload.'
            }
          end

          render json: {
            message: 'File uploaded successfully',
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

      # GET /api/v1/organization_onedrive/download
      # Download file from OneDrive
      def download
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        file_id = params[:file_id]

        unless file_id
          return render json: { error: 'No file_id provided' }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Get file metadata first
          file_metadata = client.get_file(file_id)

          # Download file content
          file_content = client.download_file(file_id)

          # Send file to user
          send_data file_content,
            filename: file_metadata['name'],
            type: file_metadata['file']&.dig('mimeType') || 'application/octet-stream',
            disposition: 'attachment'

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to download file: #{e.message}"
          render json: { error: "Failed to download file: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/organization_onedrive/preview_pricebook_matches
      # Preview all files with their suggested matches before syncing
      def preview_pricebook_matches
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected. Please connect in Settings first.' }, status: :unauthorized
        end

        folder_path = params[:folder_path] || "Pricebook Images"

        begin
          # Run preview service with credential directly
          sync_service = OnedrivePricebookSyncService.new(credential, folder_path)
          result = sync_service.preview_matches

          if result[:success]
            render json: {
              success: true,
              matches: result[:matches],
              total_files: result[:total_files],
              total_items: result[:total_items]
            }
          else
            render json: {
              success: false,
              error: result[:error]
            }, status: :unprocessable_entity
          end

        rescue StandardError => e
          Rails.logger.error "Failed to preview pricebook matches: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to preview matches: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/apply_pricebook_matches
      # Apply only the accepted matches from the preview
      def apply_pricebook_matches
        credential = OrganizationOneDriveCredential.active_credential

        Rails.logger.info "[OneDrive Apply] Starting to apply pricebook matches"
        Rails.logger.info "[OneDrive Apply] Credential present: #{credential.present?}"
        Rails.logger.info "[OneDrive Apply] Credential valid: #{credential&.valid_credential?}"

        unless credential&.valid_credential?
          Rails.logger.warn "[OneDrive Apply] No valid credential found"
          return render json: { error: 'OneDrive not connected. Please connect in Settings first.' }, status: :unauthorized
        end

        folder_path = params[:folder_path] || "Pricebook Images"
        accepted_matches = params[:accepted_matches] || []

        Rails.logger.info "[OneDrive Apply] Folder path: #{folder_path}"
        Rails.logger.info "[OneDrive Apply] Accepted matches count: #{accepted_matches.length}"

        begin
          # Run sync service with only accepted matches
          sync_service = OnedrivePricebookSyncService.new(credential, folder_path)
          result = sync_service.apply_matches(accepted_matches)

          Rails.logger.info "[OneDrive Apply] Apply completed"
          Rails.logger.info "[OneDrive Apply] Success: #{result[:success]}"
          Rails.logger.info "[OneDrive Apply] Matched: #{result[:matched]}"
          Rails.logger.info "[OneDrive Apply] Photos: #{result[:photos_matched]}"
          Rails.logger.info "[OneDrive Apply] Specs: #{result[:specs_matched]}"
          Rails.logger.info "[OneDrive Apply] QR Codes: #{result[:qr_codes_matched]}"
          Rails.logger.info "[OneDrive Apply] Errors: #{result[:errors]&.length || 0}"

          if result[:success]
            render json: {
              success: true,
              message: "Synced #{result[:matched]} images successfully",
              matched: result[:matched],
              photos_matched: result[:photos_matched],
              specs_matched: result[:specs_matched],
              qr_codes_matched: result[:qr_codes_matched],
              errors: result[:errors]
            }
          else
            Rails.logger.error "[OneDrive Apply] Apply failed: #{result[:error]}"
            render json: {
              success: false,
              error: result[:error]
            }, status: :unprocessable_entity
          end

        rescue StandardError => e
          Rails.logger.error "[OneDrive Apply] Exception occurred: #{e.message}"
          Rails.logger.error "[OneDrive Apply] Backtrace:\n#{e.backtrace.join("\n")}"

          # Provide user-friendly error messages
          user_message = case e.message
          when /undefined method.*for nil/
            "Unable to sync images. Some files may have been moved or deleted. Please try again."
          when /timeout/i, /timed out/i
            "The sync request timed out. Please try syncing fewer items at once."
          when /not found/i, /404/
            "Some OneDrive files could not be found. They may have been moved or deleted."
          when /unauthorized/i, /401/, /403/
            "OneDrive access expired. Please reconnect your OneDrive account."
          else
            "An error occurred while syncing images. Please try again or contact support if the problem persists."
          end

          render json: { error: user_message }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/sync_pricebook_images
      # Sync images from OneDrive folder to pricebook items
      def sync_pricebook_images
        credential = OrganizationOneDriveCredential.active_credential

        Rails.logger.info "[OneDrive Sync] Starting pricebook image sync"
        Rails.logger.info "[OneDrive Sync] Credential present: #{credential.present?}"
        Rails.logger.info "[OneDrive Sync] Credential valid: #{credential&.valid_credential?}"

        unless credential&.valid_credential?
          Rails.logger.warn "[OneDrive Sync] No valid credential found"
          return render json: { error: 'OneDrive not connected. Please connect in Settings first.' }, status: :unauthorized
        end

        folder_path = params[:folder_path] || "Pricebook Images"
        Rails.logger.info "[OneDrive Sync] Folder path: #{folder_path}"

        begin
          # Run sync service with credential directly
          sync_service = OnedrivePricebookSyncService.new(credential, folder_path)
          result = sync_service.sync

          Rails.logger.info "[OneDrive Sync] Sync completed"
          Rails.logger.info "[OneDrive Sync] Success: #{result[:success]}"
          Rails.logger.info "[OneDrive Sync] Matched: #{result[:matched]}"
          Rails.logger.info "[OneDrive Sync] Photos: #{result[:photos_matched]}"
          Rails.logger.info "[OneDrive Sync] Specs: #{result[:specs_matched]}"
          Rails.logger.info "[OneDrive Sync] QR Codes: #{result[:qr_codes_matched]}"
          Rails.logger.info "[OneDrive Sync] Unmatched files: #{result[:unmatched_files]&.length || 0}"
          Rails.logger.info "[OneDrive Sync] Errors: #{result[:errors]&.length || 0}"

          if result[:success]
            render json: {
              success: true,
              message: "Synced #{result[:matched]} images successfully",
              matched: result[:matched],
              photos_matched: result[:photos_matched],
              specs_matched: result[:specs_matched],
              qr_codes_matched: result[:qr_codes_matched],
              unmatched_files: result[:unmatched_files],
              unmatched_items: result[:unmatched_items],
              errors: result[:errors]
            }
          else
            Rails.logger.error "[OneDrive Sync] Sync failed: #{result[:error]}"
            render json: {
              success: false,
              error: result[:error]
            }, status: :unprocessable_entity
          end

        rescue StandardError => e
          Rails.logger.error "[OneDrive Sync] Exception occurred: #{e.message}"
          Rails.logger.error "[OneDrive Sync] Backtrace:\n#{e.backtrace.join("\n")}"
          render json: { error: "Failed to sync images: #{e.message}" }, status: :internal_server_error
        end
      end

      private

      # Dynamically determine the frontend URL from the request
      # This ensures OAuth redirects work correctly across different environments
      def get_frontend_url_from_request
        # Try to get the origin from the Referer header (where the user initiated the OAuth flow)
        referer = request.referer

        if referer.present?
          uri = URI.parse(referer)
          frontend_url = "#{uri.scheme}://#{uri.host}"
          frontend_url += ":#{uri.port}" if uri.port && ![80, 443].include?(uri.port)
          Rails.logger.info "Using frontend URL from referer: #{frontend_url}"
          return frontend_url
        end

        # Fallback to Origin header if Referer is not present
        origin = request.headers['Origin']
        if origin.present?
          Rails.logger.info "Using frontend URL from Origin header: #{origin}"
          return origin
        end

        # Final fallback to environment variable
        frontend_url = ENV['FRONTEND_URL'] || 'https://teeem.vercel.app'
        Rails.logger.info "Using frontend URL from ENV (fallback): #{frontend_url}"
        frontend_url
      end
    end
  end
end

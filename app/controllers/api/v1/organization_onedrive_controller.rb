module Api
  module V1
    class OrganizationOnedriveController < ApplicationController
      # Skip auth for OAuth callback (comes from Microsoft, not our frontend)
      skip_before_action :authorize_request, only: [:callback]

      # Require admin for sensitive operations
      before_action :require_admin, only: [:disconnect, :change_root_folder, :sync_pricebook_images, :sync_corporate_documents]

      # GET /api/v1/organization_onedrive/status
      # Check if organization has OneDrive connected
      # Will attempt to refresh expired tokens automatically
      # Falls back to user's Microsoft token if org credential not set up
      def status
        credential = OrganizationOneDriveCredential.active_credential

        # If no org credential, check if user has Microsoft token with OneDrive access
        unless credential
          begin
            microsoft_token = current_user&.microsoft_token
            # Check status first (not encrypted), then try to access encrypted field
            if microsoft_token&.status == 'connected'
              # Try to access the encrypted access_token - this may fail with decryption errors
              has_access_token = microsoft_token.access_token.present? rescue false
              if has_access_token
                # User has a connected Microsoft account - use it as the OneDrive connection
                return render json: {
                  connected: true,
                  source: 'user_microsoft_token',
                  drive_name: 'Personal OneDrive',
                  connected_at: microsoft_token.created_at,
                  connected_by: current_user&.as_json(only: [:id, :email]),
                  token_expires_at: microsoft_token.token_expires_at,
                  message: 'Using your Microsoft 365 connection for OneDrive access'
                }
              end
            end
          rescue ActiveRecord::Encryption::Errors::Decryption => e
            Rails.logger.warn "[OneDrive Status] Decryption error accessing Microsoft token: #{e.message}"
            # Token exists but can't be decrypted - treat as not connected
          rescue StandardError => e
            Rails.logger.warn "[OneDrive Status] Error accessing Microsoft token: #{e.message}"
          end

          return render json: {
            connected: false,
            message: 'Not connected'
          }
        end

        # If token is expired but we have a refresh token, try to refresh
        if credential.token_expired? && credential.refresh_token.present?
          begin
            Rails.logger.info "[OneDrive Status] Token expired, attempting refresh..."
            client = MicrosoftGraphClient.new(credential)
            client.refresh_token!
            credential.reload
            Rails.logger.info "[OneDrive Status] Token refreshed successfully"
          rescue StandardError => e
            Rails.logger.error "[OneDrive Status] Token refresh failed: #{e.message}"
            return render json: {
              connected: false,
              message: 'Session expired. Please reconnect to OneDrive.',
              error: 'Token refresh failed'
            }
          end
        end

        if credential.valid_credential?
          render json: {
            connected: true,
            source: 'organization_credential',
            drive_id: credential.drive_id,
            drive_name: credential.drive_name,
            root_folder_id: credential.root_folder_id,
            root_folder_path: credential.root_folder_path,
            root_folder_web_url: credential.metadata&.dig('root_folder_web_url'),
            connected_at: credential.created_at,
            connected_by: credential.connected_by&.as_json(only: [:id, :email]),
            metadata: credential.metadata,
            token_expires_at: credential.token_expires_at
          }
        else
          render json: {
            connected: false,
            message: 'Credential expired or invalid'
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

          # Check if we should use personal OneDrive or SharePoint
          # Default to personal OneDrive now (user can switch to SharePoint later)
          use_personal = params[:use_personal] != 'false'

          if use_personal
            # Use personal OneDrive - just get the default drive info
            Rails.logger.info "Using personal OneDrive..."
            begin
              drive_info = client.get('/me/drive')
              credential.update!(
                drive_id: drive_info['id'],
                drive_name: drive_info['name'] || 'My OneDrive',
                metadata: {
                  drive_type: 'personal',
                  owner_name: drive_info.dig('owner', 'user', 'displayName'),
                  quota_total: drive_info.dig('quota', 'total'),
                  quota_used: drive_info.dig('quota', 'used')
                }
              )
              Rails.logger.info "Connected to personal OneDrive: #{drive_info['name']}"
            rescue StandardError => e
              Rails.logger.error "Failed to get personal OneDrive info: #{e.message}"
            end
          else
            # Use TEEEM SharePoint site
            Rails.logger.info "Switching to TEEEM SharePoint site..."
            begin
              result = client.use_sharepoint_site("TEEEM")
              Rails.logger.info "Connected to SharePoint site: #{result[:site]['displayName'] || 'TEEEM'}"
            rescue StandardError => e
              Rails.logger.warn "Could not find TEEEM SharePoint site, trying search..."
              sites = client.list_sharepoint_sites
              teeem_site = sites.find { |s| s[:name]&.downcase&.include?('teeem') }
              if teeem_site
                result = client.use_sharepoint_site(teeem_site[:id])
                Rails.logger.info "Connected to SharePoint site via search: #{teeem_site[:name]}"
              else
                Rails.logger.warn "TEEEM SharePoint site not found, falling back to default drive"
              end
            end

            # Create root folder for all jobs in the SharePoint site
            Rails.logger.info "Creating root folder 'TEEEM Jobs'..."
            root_folder = client.create_jobs_root_folder("TEEEM Jobs")
            Rails.logger.info "Root folder created successfully at: #{root_folder['webUrl']}"
          end

          Rails.logger.info "=== OneDrive Connection Completed Successfully ==="

          # Dynamically determine frontend URL based on request origin
          frontend_url = get_frontend_url_from_request

          # Redirect to frontend settings page with success message
          redirect_to "#{frontend_url}/admin/system?onedrive=connected", allow_other_host: true

        rescue MicrosoftGraphClient::AuthenticationError => e
          Rails.logger.error "=== OneDrive Authentication Failed ==="
          Rails.logger.error "Error: #{e.message}"
          frontend_url = get_frontend_url_from_request
          redirect_to "#{frontend_url}/admin/system?onedrive=error&message=#{CGI.escape(e.message)}", allow_other_host: true
        rescue StandardError => e
          Rails.logger.error "=== OneDrive Connection Failed ==="
          Rails.logger.error "Error: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          frontend_url = get_frontend_url_from_request
          redirect_to "#{frontend_url}/admin/system?onedrive=error&message=#{CGI.escape(e.message)}", allow_other_host: true
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

      # GET /api/v1/organization_onedrive/sharepoint_sites
      # List available SharePoint sites
      def sharepoint_sites
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)
          sites = client.list_sharepoint_sites

          render json: {
            sites: sites,
            current_site: credential.metadata&.dig('site_name')
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "SharePoint API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to list SharePoint sites: #{e.message}"
          render json: { error: "Failed to list sites: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/use_personal_drive
      # Switch to using personal OneDrive instead of SharePoint
      def use_personal_drive
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Get personal OneDrive info
          drive_info = client.get('/me/drive')

          # Update credential to use personal drive
          credential.update!(
            drive_id: drive_info['id'],
            drive_name: drive_info['name'] || 'My OneDrive',
            root_folder_id: nil,
            root_folder_path: nil,
            metadata: credential.metadata.merge({
              drive_type: 'personal',
              owner_name: drive_info.dig('owner', 'user', 'displayName'),
              quota_total: drive_info.dig('quota', 'total'),
              quota_used: drive_info.dig('quota', 'used'),
              switched_at: Time.current
            })
          )

          render json: {
            message: 'Switched to personal OneDrive',
            drive: {
              id: drive_info['id'],
              name: drive_info['name'],
              type: 'personal'
            }
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error "Failed to switch to personal drive: #{e.message}"
          render json: { error: "Failed to switch: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/use_sharepoint_site
      # Switch to using a SharePoint site instead of personal OneDrive
      def use_sharepoint_site
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        site_name = params[:site_name]

        if site_name.blank?
          return render json: { error: 'Site name is required' }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)
          result = client.use_sharepoint_site(site_name)

          # Reset root folder since we're switching drives
          credential.update!(
            root_folder_id: nil,
            root_folder_path: nil
          )

          render json: {
            message: "Successfully switched to SharePoint site '#{result[:site]['displayName'] || site_name}'",
            site: {
              id: result[:site]['id'],
              name: result[:site]['displayName'] || result[:site]['name'],
              web_url: result[:site]['webUrl']
            },
            drive: {
              id: result[:drive]['id'],
              name: result[:drive]['name']
            }
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "SharePoint API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to switch SharePoint site: #{e.message}"
          render json: { error: "Failed to switch site: #{e.message}" }, status: :internal_server_error
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
        job = Job.find(params[:job_id])

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
          existing_folder = client.find_job_folder(job)

          if existing_folder
            return render json: {
              message: 'Folder structure already exists for this job',
              job_folder: existing_folder,
              web_url: existing_folder['webUrl']
            }
          end

          # Create folder structure for this job
          job_folder = client.create_job_folder_structure(job, template)

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
        job = Job.find(params[:job_id])

        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Find the job folder
          job_folder = client.find_job_folder(job)

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
        job = Job.find(params[:job_id])

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

      # GET /api/v1/organization_onedrive/folder_contents
      # Get contents of a specific folder by name within a job's folder
      # Supports fetching from multiple folders (e.g., "Photo" and "Client Photo")
      def folder_contents
        job = Job.find(params[:job_id])
        folder_names = params[:folder_names]&.split(',')&.map(&:strip) || [params[:folder_name]]

        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Find the job folder
          job_folder = client.find_job_folder(job)

          unless job_folder
            return render json: {
              error: 'Job folder not found',
              job_folder_exists: false
            }, status: :not_found
          end

          # Get all items in the job folder
          job_items = client.list_folder_items(job_folder['id'])
          job_folders = job_items['value']&.select { |item| item['folder'] } || []

          # Find the target folders by name
          all_files = []
          found_folders = []

          folder_names.each do |folder_name|
            target_folder = job_folders.find { |f| f['name'].downcase == folder_name.downcase }

            if target_folder
              found_folders << { name: target_folder['name'], id: target_folder['id'], web_url: target_folder['webUrl'] }

              # Get contents of this folder with thumbnails for images
              folder_contents = client.list_folder_items(target_folder['id'], include_thumbnails: true)
              files = folder_contents['value'] || []

              # Add folder info to each file for context
              files.each do |file|
                file['source_folder'] = folder_name
                all_files << file
              end
            end
          end

          # Separate files and subfolders
          files_only = all_files.reject { |item| item['folder'] }
          subfolders = all_files.select { |item| item['folder'] }

          render json: {
            files: files_only,
            subfolders: subfolders,
            total_count: files_only.length,
            found_folders: found_folders,
            requested_folders: folder_names,
            job_folder_id: job_folder['id'],
            job_folder_web_url: job_folder['webUrl']
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to get folder contents: #{e.message}"
          render json: { error: "Failed to get folder contents: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/organization_onedrive/search
      # Search for files across the entire SharePoint/OneDrive drive
      def search
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        query = params[:q] || params[:query]

        unless query.present?
          return render json: { error: 'Search query is required (use ?q=searchterm)' }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Search across the entire drive (not limited to root folder)
          results = client.search(query)

          # Format results
          items = (results['value'] || []).map do |item|
            {
              id: item['id'],
              name: item['name'],
              path: item.dig('parentReference', 'path')&.gsub('/drive/root:', '') || '/',
              full_path: "#{item.dig('parentReference', 'path')&.gsub('/drive/root:', '') || ''}/#{item['name']}",
              web_url: item['webUrl'],
              is_folder: item['folder'].present?,
              size: item['size'],
              created_at: item['createdDateTime'],
              modified_at: item['lastModifiedDateTime'],
              mime_type: item.dig('file', 'mimeType')
            }
          end

          render json: {
            success: true,
            query: query,
            count: items.length,
            items: items
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to search: #{e.message}"
          render json: { error: "Failed to search: #{e.message}" }, status: :internal_server_error
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

      # GET /api/v1/organization_onedrive/preview_private_folders
      # Preview the folder structure that would be created in 00 TEEEM PRIVATE
      def preview_private_folders
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        begin
          service = CorporateOneDriveService.new
          structure = service.preview_private_folder_structure

          render json: {
            success: true,
            structure: structure
          }
        rescue StandardError => e
          Rails.logger.error "Failed to preview private folders: #{e.message}"
          render json: { error: "Failed to preview: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/copy_files
      # Copy files from selected records to a SharePoint/OneDrive folder
      # Params:
      #   - foundation_id: The foundation/table name to get records from
      #   - record_ids: Array of record IDs to copy files from
      #   - folder_id: Target folder ID in OneDrive (or null for root)
      #   - new_folder_name: Optional - create a new folder with this name
      def copy_files
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        foundation_id = params[:foundation_id]
        record_ids = params[:record_ids] || []
        folder_id = params[:folder_id]
        new_folder_name = params[:new_folder_name]

        if record_ids.empty?
          return render json: { error: 'No records selected' }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Create new folder if requested
          if new_folder_name.present?
            parent_id = folder_id || credential.root_folder_id
            new_folder = if parent_id
              client.create_folder(new_folder_name, parent_id: parent_id)
            else
              client.post("/me/drive/root/children", {
                name: new_folder_name,
                folder: {},
                "@microsoft.graph.conflictBehavior": "rename"
              })
            end
            folder_id = new_folder['id']
          end

          # Get the target folder ID (use root if not specified)
          target_folder_id = folder_id || credential.root_folder_id

          unless target_folder_id
            return render json: { error: 'No target folder specified and no root folder configured' }, status: :bad_request
          end

          # Get the model class for the foundation
          model_class = get_model_for_foundation(foundation_id)

          unless model_class
            return render json: { error: "Unknown foundation: #{foundation_id}" }, status: :bad_request
          end

          # Get records and their attachments
          records = model_class.where(id: record_ids)

          uploaded_files = []
          errors = []

          records.each do |record|
            # Find all Active Storage attachments on this record
            attachments = get_attachments_for_record(record)

            attachments.each do |attachment|
              begin
                # Download the file content
                file_content = attachment.download
                filename = attachment.filename.to_s

                # Upload to OneDrive
                # For files < 4MB, use simple upload
                if file_content.bytesize < 4.megabytes
                  result = client.post(
                    "/drives/#{credential.drive_id}/items/#{target_folder_id}:/#{filename}:/content",
                    file_content,
                    { 'Content-Type' => attachment.content_type || 'application/octet-stream' }
                  )
                  uploaded_files << {
                    record_id: record.id,
                    filename: filename,
                    sharepoint_url: result['webUrl'],
                    size: file_content.bytesize
                  }
                else
                  # For larger files, create upload session
                  session = client.create_upload_session(target_folder_id, filename, file_content.bytesize)

                  # Upload in chunks
                  upload_url = session['uploadUrl']
                  chunk_size = 10.megabytes
                  position = 0

                  while position < file_content.bytesize
                    chunk = file_content[position, chunk_size]
                    end_position = [position + chunk.bytesize - 1, file_content.bytesize - 1].min

                    response = HTTParty.put(
                      upload_url,
                      body: chunk,
                      headers: {
                        'Content-Length' => chunk.bytesize.to_s,
                        'Content-Range' => "bytes #{position}-#{end_position}/#{file_content.bytesize}"
                      }
                    )

                    position += chunk_size

                    # Final chunk returns the file metadata
                    if response['id']
                      uploaded_files << {
                        record_id: record.id,
                        filename: filename,
                        sharepoint_url: response['webUrl'],
                        size: file_content.bytesize
                      }
                    end
                  end
                end
              rescue StandardError => e
                errors << {
                  record_id: record.id,
                  filename: attachment.filename.to_s,
                  error: e.message
                }
                Rails.logger.error "Failed to upload #{attachment.filename}: #{e.message}"
              end
            end
          end

          render json: {
            success: true,
            message: "Uploaded #{uploaded_files.length} files to SharePoint",
            uploaded_files: uploaded_files,
            errors: errors,
            target_folder_id: target_folder_id
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to copy files: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to copy files: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/create_private_folders
      # Create the folder structure in 00 TEEEM PRIVATE for all company groups
      def create_private_folders
        credential = OrganizationOneDriveCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: 'OneDrive not connected' }, status: :unauthorized
        end

        begin
          service = CorporateOneDriveService.new
          result = service.create_private_folder_structure!

          render json: {
            success: true,
            message: "Created #{result[:stats][:folders_created]} folders, skipped #{result[:stats][:folders_skipped]} existing",
            result: result
          }
        rescue StandardError => e
          Rails.logger.error "Failed to create private folders: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to create folders: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/sync_corporate_documents
      # Sync corporate documents from OneDrive to company records
      def sync_corporate_documents
        credential = OrganizationOneDriveCredential.active_credential

        Rails.logger.info "[OneDrive Corporate Sync] Starting corporate document sync"

        unless credential&.valid_credential?
          Rails.logger.warn "[OneDrive Corporate Sync] No valid credential found"
          return render json: { error: 'OneDrive not connected. Please connect in Settings first.' }, status: :unauthorized
        end

        folder_path = params[:folder_path] || "Corporate File"
        Rails.logger.info "[OneDrive Corporate Sync] Folder path: #{folder_path}"

        begin
          # Use the CorporateOnedriveService
          service = CorporateOnedriveService.new(credential, folder_path: folder_path)
          result = service.scan_all

          Rails.logger.info "[OneDrive Corporate Sync] Sync completed"
          Rails.logger.info "[OneDrive Corporate Sync] Success: #{result[:success]}"
          Rails.logger.info "[OneDrive Corporate Sync] Companies scanned: #{result[:companies_scanned]}"
          Rails.logger.info "[OneDrive Corporate Sync] Documents found: #{result[:documents_found]}"
          Rails.logger.info "[OneDrive Corporate Sync] Documents linked: #{result[:documents_linked]}"

          if result[:success]
            render json: {
              success: true,
              message: "Synced #{result[:documents_linked]} documents to #{result[:companies_scanned]} companies",
              folder_path: result[:folder_path],
              companies_scanned: result[:companies_scanned],
              documents_found: result[:documents_found],
              documents_linked: result[:documents_linked],
              errors: result[:errors]
            }
          else
            Rails.logger.error "[OneDrive Corporate Sync] Sync failed: #{result[:error]}"
            render json: {
              success: false,
              error: result[:error]
            }, status: :unprocessable_entity
          end

        rescue StandardError => e
          Rails.logger.error "[OneDrive Corporate Sync] Exception occurred: #{e.message}"
          Rails.logger.error "[OneDrive Corporate Sync] Backtrace:\n#{e.backtrace.join("\n")}"
          render json: { error: "Failed to sync corporate documents: #{e.message}" }, status: :internal_server_error
        end
      end

      private

      # Get the best available credential for OneDrive operations
      # Prioritizes organization credential, falls back to user's Microsoft token
      def get_onedrive_credential
        # First try organization-wide credential
        credential = OrganizationOneDriveCredential.active_credential
        return credential if credential&.valid_credential?

        # Fall back to user's Microsoft token
        microsoft_token = current_user&.microsoft_token
        if microsoft_token&.status == 'connected' && microsoft_token&.access_token.present?
          return microsoft_token
        end

        nil
      end

      # Check if we have a valid OneDrive connection (org or user)
      def onedrive_connected?
        get_onedrive_credential.present?
      end

      # Map foundation_id to model class
      def get_model_for_foundation(foundation_id)
        case foundation_id&.to_s&.downcase
        when 'contacts', 'contact'
          Contact
        when 'jobs', 'job'
          Job
        when 'companies', 'company'
          Company
        when 'assets', 'asset'
          Asset
        when 'documents', 'document', 'company_documents'
          CompanyDocument
        when 'pay_now_requests', 'pay_now_request'
          PayNowRequest
        when 'financial_transactions', 'financial_transaction'
          FinancialTransaction
        else
          # Try to find a foundation and get its model
          foundation = Foundation.find_by(foundation_id: foundation_id) || Foundation.find_by(id: foundation_id)
          foundation&.model_class&.constantize rescue nil
        end
      end

      # Get all Active Storage attachments for a record
      def get_attachments_for_record(record)
        attachments = []

        # Check for common attachment names
        attachment_names = [:file, :files, :photos, :photo, :invoice, :document, :documents, :receipt, :attachments, :proof_photos, :invoice_file]

        attachment_names.each do |name|
          if record.respond_to?(name) && record.send(name).respond_to?(:attached?)
            attachment = record.send(name)
            if attachment.attached?
              if attachment.respond_to?(:each)
                # has_many_attached
                attachments.concat(attachment.to_a)
              else
                # has_one_attached
                attachments << attachment
              end
            end
          end
        end

        attachments
      end

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

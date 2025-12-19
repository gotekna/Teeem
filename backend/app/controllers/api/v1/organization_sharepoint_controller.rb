module Api
  module V1
    # RENAMED: OrganizationOnedriveController → OrganizationSharepointController
    class OrganizationSharepointController < ApplicationController
      # Skip auth for OAuth callback (comes from Microsoft, not our frontend)
      skip_before_action :authorize_request, only: [ :callback ]

      # Require admin for sensitive operations
      before_action :require_admin, only: [ :disconnect, :change_root_folder, :sync_corporate_documents ]

      # Handle decryption errors gracefully - this happens when credentials were encrypted
      # with different encryption keys (e.g., production vs development environments)
      rescue_from ActiveRecord::Encryption::Errors::Decryption do |e|
        Rails.logger.warn "[SharePoint] Decryption error: #{e.message}"
        render json: {
          connected: false,
          error: "SharePoint credentials could not be decrypted. Please reconnect SharePoint in Admin > System > Connections.",
          decryption_error: true
        }, status: :unauthorized
      end

      # GET /api/v1/organization_onedrive/status
      # Check if organization has OneDrive connected
      # Will attempt to refresh expired tokens automatically
      # Falls back to user's Microsoft token if org credential not set up
      def status
        # Wrap credential loading in rescue - tokens are encrypted and may fail to decrypt
        # if encrypted with different keys across environments
        credential = begin
          cred = OrganizationSharePointCredential.active_credential
          # Try to access an encrypted field to verify decryption works
          cred&.access_token if cred
          cred
        rescue ActiveRecord::Encryption::Errors::Decryption => e
          Rails.logger.warn "[OneDrive Status] Decryption error loading org credential: #{e.message}"
          nil
        end

        # If no org credential, check if user has Microsoft token with OneDrive access
        unless credential
          # Try to use user's Microsoft token as fallback
          # UserMicrosoftToken doesn't have encryption, so this should be safe
          begin
            microsoft_token = current_user&.microsoft_token
            if microsoft_token&.status == "connected" && microsoft_token&.access_token.present?
              # User has a connected Microsoft account - use it as the OneDrive connection
              return render json: {
                connected: true,
                source: "user_microsoft_token",
                drive_name: "Personal OneDrive",
                connected_at: microsoft_token.created_at,
                connected_by: current_user&.as_json(),
                token_expires_at: microsoft_token.token_expires_at,
                message: "Using your Microsoft 365 connection for OneDrive access"
              }
            end
          rescue StandardError => e
            Rails.logger.warn "[OneDrive Status] Error accessing Microsoft token: #{e.message}"
          end

          return render json: {
            connected: false,
            message: "Not connected"
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
            Rails.logger.error "[SharePoint] Token refresh failed: #{e.message}"
            return render json: {
              connected: false,
              message: "Session expired. Please reconnect SharePoint in Admin > System > Connections.",
              error: "Token refresh failed"
            }
          end
        end

        if credential.valid_credential?
          render json: {
            connected: true,
            source: "organization_credential",
            drive_id: credential.drive_id,
            drive_name: credential.drive_name,
            root_folder_id: credential.root_folder_id,
            root_folder_path: credential.root_folder_path,
            root_folder_web_url: credential.metadata&.dig("root_folder_web_url"),
            connected_at: credential.created_at,
            connected_by: credential.connected_by&.as_json(),
            metadata: credential.metadata,
            token_expires_at: credential.token_expires_at
          }
        else
          render json: {
            connected: false,
            message: "Credential expired or invalid"
          }
        end
      end

      # GET /api/v1/organization_onedrive/authorize
      # Start OAuth flow - returns authorization URL
      def authorize
        redirect_uri = "#{request.base_url}/api/v1/organization_onedrive/callback"

        auth_url = MicrosoftGraphClient.authorization_url(
          client_id: ENV["ONEDRIVE_CLIENT_ID"],
          redirect_uri: redirect_uri,
          scope: "Files.ReadWrite.All Sites.ReadWrite.All offline_access"
        )

        render json: { auth_url: auth_url }
      end

      # GET /api/v1/organization_onedrive/callback
      # OAuth callback - exchange code for tokens
      def callback
        code = params[:code]

        unless code
          return render json: { error: "Authorization code not provided" }, status: :bad_request
        end

        begin
          Rails.logger.info "=== OneDrive OAuth Callback Started ==="

          redirect_uri = "#{request.base_url}/api/v1/organization_onedrive/callback"

          # Exchange authorization code for tokens
          token_data = MicrosoftGraphClient.exchange_code_for_tokens(
            code: code,
            client_id: ENV["ONEDRIVE_CLIENT_ID"],
            client_secret: ENV["ONEDRIVE_CLIENT_SECRET"],
            redirect_uri: redirect_uri
          )

          Rails.logger.info "Token exchange successful"

          # Deactivate any existing credentials
          OrganizationSharePointCredential.where(is_active: true).update_all(is_active: false)

          # Create new credential with refresh token
          credential = OrganizationSharePointCredential.create!(
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
          use_personal = params[:use_personal] != "false"

          if use_personal
            # Use personal OneDrive - just get the default drive info
            Rails.logger.info "Using personal OneDrive..."
            begin
              drive_info = client.get("/me/drive")
              credential.update!(
                drive_id: drive_info["id"],
                drive_name: drive_info["name"] || "My OneDrive",
                metadata: {
                  drive_type: "personal",
                  owner_name: drive_info.dig("owner", "user", "displayName"),
                  quota_total: drive_info.dig("quota", "total"),
                  quota_used: drive_info.dig("quota", "used")
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
              teeem_site = sites.find { |s| s[:name]&.downcase&.include?("teeem") }
              if teeem_site
                result = client.use_sharepoint_site(teeem_site[:id])
                Rails.logger.info "Connected to SharePoint site via search: #{teeem_site[:name]}"
              else
                Rails.logger.warn "TEEEM SharePoint site not found, falling back to default drive"
              end
            end

            # Create root folder for all jobs in the SharePoint site (SSoT)
            jobs_folder_name = CorporateCompanySetting.instance.sharepoint_jobs_path.presence || "TEEEM Jobs"
            Rails.logger.info "Creating root folder '#{jobs_folder_name}'..."
            root_folder = client.create_jobs_root_folder(jobs_folder_name)
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
        credential = OrganizationSharePointCredential.active_credential

        if credential
          credential.deactivate!
          render json: { message: "OneDrive disconnected successfully" }
        else
          render json: { message: "OneDrive was not connected" }, status: :not_found
        end
      end

      # PATCH /api/v1/organization_onedrive/change_root_folder
      # Change the root folder for organization OneDrive
      # Accepts either folder_id (for browsed selection) or folder_name (for typed path)
      def change_root_folder
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        # If folder_id is provided, use direct selection (from folder browser)
        if params[:folder_id].present?
          return change_root_folder_by_id(credential, params[:folder_id])
        end

        folder_path = params[:folder_name]

        if folder_path.blank?
          return render json: { error: "Folder name or folder_id is required" }, status: :bad_request
        end

        # Validate folder path to prevent path traversal attacks
        # Allow forward slashes for nested paths, but block ".." and backslashes
        if folder_path.include?("..") || folder_path.include?("\\")
          return render json: { error: 'Invalid folder path. Folder paths cannot contain ".." or "\\" characters.' }, status: :bad_request
        end

        # Validate length
        if folder_path.length > 1000
          return render json: { error: "Folder path is too long (maximum 1000 characters)" }, status: :bad_request
        end

        # Validate each path segment
        path_segments = folder_path.split("/")
        if path_segments.any?(&:blank?)
          return render json: { error: "Invalid folder path. Empty path segments are not allowed." }, status: :bad_request
        end

        # Sanitize each path segment (allow alphanumeric, spaces, hyphens, underscores)
        sanitized_segments = path_segments.map do |segment|
          segment.gsub(/[^a-zA-Z0-9\s\-_]/, "").strip
        end

        if sanitized_segments.any?(&:blank?)
          return render json: { error: "Folder path contains invalid characters" }, status: :bad_request
        end

        sanitized_path = sanitized_segments.join("/")

        begin
          client = MicrosoftGraphClient.new(credential)

          # Navigate through nested folder path, creating folders as needed
          current_parent_path = "/me/drive/root"
          current_folder = nil

          sanitized_segments.each do |folder_name|
            # Get children of current parent
            response = client.get("#{current_parent_path}/children")
            folders = response["value"] || []

            # Find folder in current level
            folder = folders.find { |f| f["name"] == folder_name && f["folder"] }

            if folder
              # Folder exists, use it
              current_folder = folder
              current_parent_path = "/me/drive/items/#{folder['id']}"
            else
              # Create folder at this level
              folder = client.post("#{current_parent_path}/children", {
                name: folder_name,
                folder: {},
                "@microsoft.graph.conflictBehavior" => "fail"
              })
              current_folder = folder
              current_parent_path = "/me/drive/items/#{folder['id']}"
            end
          end

          # Update credential with new root folder info
          credential.update!(
            root_folder_id: current_folder["id"],
            root_folder_path: sanitized_path,
            metadata: credential.metadata.merge({
              root_folder_name: sanitized_segments.last,
              root_folder_web_url: current_folder["webUrl"],
              updated_at: Time.current
            })
          )

          render json: {
            message: "Root folder updated successfully",
            root_folder_path: sanitized_path,
            root_folder_web_url: current_folder["webUrl"]
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
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)
          sites = client.list_sharepoint_sites

          render json: {
            sites: sites,
            current_site: credential.metadata&.dig("site_name")
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
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Get personal OneDrive info
          drive_info = client.get("/me/drive")

          # Update credential to use personal drive
          credential.update!(
            drive_id: drive_info["id"],
            drive_name: drive_info["name"] || "My OneDrive",
            root_folder_id: nil,
            root_folder_path: nil,
            metadata: credential.metadata.merge({
              drive_type: "personal",
              owner_name: drive_info.dig("owner", "user", "displayName"),
              quota_total: drive_info.dig("quota", "total"),
              quota_used: drive_info.dig("quota", "used"),
              switched_at: Time.current
            })
          )

          render json: {
            message: "Switched to personal OneDrive",
            drive: {
              id: drive_info["id"],
              name: drive_info["name"],
              type: "personal"
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
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        site_name = params[:site_name]

        if site_name.blank?
          return render json: { error: "Site name is required" }, status: :bad_request
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
              id: result[:site]["id"],
              name: result[:site]["displayName"] || result[:site]["name"],
              web_url: result[:site]["webUrl"]
            },
            drive: {
              id: result[:drive]["id"],
              name: result[:drive]["name"]
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
      # Returns folders and breadcrumb path for navigation
      def browse_folders
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        folder_id = params[:folder_id] # Optional - if not provided, browse root

        begin
          client = MicrosoftGraphClient.new(credential)

          current_folder = nil
          breadcrumbs = []

          # Get the correct drive path (handles SharePoint vs personal OneDrive)
          drive_path = credential.drive_id.present? ? "/drives/#{credential.drive_id}" : "/me/drive"

          # Get folders in the specified location
          if folder_id.present?
            # Get current folder info for breadcrumb
            current_folder_response = client.get("#{drive_path}/items/#{folder_id}")
            current_folder = {
              id: current_folder_response["id"],
              name: current_folder_response["name"],
              parent_id: current_folder_response.dig("parentReference", "id")
            }

            # Build breadcrumb path from parentReference.path
            parent_path = current_folder_response.dig("parentReference", "path") || ""
            # Path looks like: /drive/root:/Shared Documents/TEEEM Jobs
            if parent_path.include?(":")
              path_after_root = parent_path.split(":").last.to_s
              path_parts = path_after_root.split("/").reject(&:blank?)
              # Add each path segment to breadcrumbs (we'll get IDs by traversing)
              breadcrumbs = path_parts.map { |name| { name: name, id: nil } }
            end
            # Add current folder to breadcrumbs
            breadcrumbs << { name: current_folder[:name], id: current_folder[:id] }

            # Browse children of specific folder
            response = client.list_folder_items(folder_id)
          else
            # Browse root drive folders
            response = client.get("#{drive_path}/root/children")
          end

          # Filter to only show folders
          folders = (response["value"] || []).select { |item| item["folder"] }

          # Format response
          formatted_folders = folders.map do |folder|
            {
              id: folder["id"],
              name: folder["name"],
              web_url: folder["webUrl"],
              created_at: folder["createdDateTime"],
              child_count: folder.dig("folder", "childCount") || 0
            }
          end.sort_by { |f| f[:name].downcase }

          render json: {
            folders: formatted_folders,
            current_folder: current_folder,
            breadcrumbs: breadcrumbs,
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

      # POST /api/v1/organization_onedrive/create_root_folder
      # Create a root folder in the current drive (e.g., "Teeem" folder)
      # Used to auto-create the Teeem folder if it doesn't exist
      def create_root_folder
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        folder_name = params[:folder_name]

        if folder_name.blank?
          return render json: { error: "Folder name is required" }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Create folder in root of current drive
          folder = client.create_folder(folder_name, drive_id: credential.drive_id)

          render json: {
            success: true,
            folder: {
              id: folder["id"],
              name: folder["name"],
              webUrl: folder["webUrl"]
            },
            message: "Folder '#{folder_name}' created successfully"
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          # If folder already exists, that's fine - return success
          if e.message.include?("nameAlreadyExists")
            render json: {
              success: true,
              message: "Folder '#{folder_name}' already exists"
            }
          else
            render json: { error: "Failed to create folder: #{e.message}" }, status: :bad_gateway
          end
        rescue StandardError => e
          Rails.logger.error "Failed to create root folder: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to create folder: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/organization_onedrive/validate_folder
      # Validate the root folder exists and hasn't been renamed or moved
      # Returns folder validation status and auto-updates metadata if folder was renamed
      def validate_folder
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)
          result = client.validate_root_folder

          # If folder exists but was renamed, auto-update the stored metadata
          if result[:valid] && (result[:name_changed] || result[:path_changed])
            credential.update!(
              root_folder_path: result[:current_path],
              metadata: credential.metadata.merge({
                root_folder_name: result[:name],
                previous_name: result[:stored_name],
                previous_path: result[:stored_path],
                path_updated_at: Time.current
              })
            )
            result[:auto_updated] = true
            result[:message] = "Folder location was updated to match current SharePoint path"
          end

          render json: result

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue StandardError => e
          Rails.logger.error "Failed to validate folder: #{e.message}"
          render json: { error: "Failed to validate folder: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/create_all_job_folders
      # Create folder structure for ALL jobs that don't have folders yet
      def create_all_job_folders
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected. Please connect in Settings first." }, status: :unauthorized
        end

        # Get folder template (use default or specified)
        template_id = params[:template_id]
        template = if template_id
          FolderTemplate.find(template_id)
        else
          FolderTemplate.where(is_system_default: true, is_active: true).first
        end

        unless template
          return render json: { error: "No folder template found" }, status: :not_found
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

        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected. Please connect in Settings first." }, status: :unauthorized
        end

        # Get folder template (use default or specified)
        template_id = params[:template_id]
        template = if template_id
          FolderTemplate.find(template_id)
        else
          FolderTemplate.where(is_system_default: true, is_active: true).first
        end

        unless template
          return render json: { error: "No folder template found" }, status: :not_found
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Check if job folder already exists
          existing_folder = client.find_job_folder(job)

          if existing_folder
            return render json: {
              message: "Folder structure already exists for this job",
              job_folder: existing_folder,
              web_url: existing_folder["webUrl"]
            }
          end

          # Create folder structure for this job
          job_folder = client.create_job_folder_structure(job, template)

          # Mark credential as synced
          credential.mark_synced!

          render json: {
            message: "Folder structure created successfully",
            job_folder: job_folder,
            folder_path: "#{credential.root_folder_path}/#{job_folder['name']}",
            web_url: job_folder["webUrl"]
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

        credential = get_onedrive_credential

        unless credential
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Find the job folder
          job_folder = client.find_job_folder(job)

          unless job_folder
            return render json: {
              error: "Job folder not found. Please create the folder structure first.",
              job_folder_exists: false
            }, status: :not_found
          end

          # Get folder ID from params or use job folder
          folder_id = params[:folder_id] || job_folder["id"]

          items = client.list_folder_items(folder_id)

          render json: {
            items: items["value"],
            count: items["value"]&.length || 0,
            job_folder_id: job_folder["id"],
            job_folder_web_url: job_folder["webUrl"]
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

        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        uploaded_file = params[:file]
        folder_id = params[:folder_id]

        unless uploaded_file
          return render json: { error: "No file provided" }, status: :bad_request
        end

        unless folder_id
          return render json: { error: "No folder_id provided" }, status: :bad_request
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

      # GET /api/v1/organization_onedrive/folder_contents
      # Get contents of a specific folder by name within a job's folder
      # Supports fetching from multiple folders (e.g., "Photo" and "Client Photo")
      def folder_contents
        job = Job.find(params[:job_id])
        folder_names = params[:folder_names]&.split(",")&.map(&:strip) || [ params[:folder_name] ]

        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Find the job folder
          job_folder = client.find_job_folder(job)

          unless job_folder
            return render json: {
              error: "Job folder not found",
              job_folder_exists: false
            }, status: :not_found
          end

          # Get all items in the job folder
          job_items = client.list_folder_items(job_folder["id"])
          job_folders = job_items["value"]&.select { |item| item["folder"] } || []

          # Find the target folders by name
          all_files = []
          found_folders = []

          folder_names.each do |folder_name|
            next if folder_name.blank?
            target_folder = job_folders.find { |f| f["name"]&.downcase == folder_name.downcase }

            if target_folder
              found_folders << { name: target_folder["name"], id: target_folder["id"], web_url: target_folder["webUrl"] }

              # Get contents of this folder with thumbnails for images
              folder_contents = client.list_folder_items(target_folder["id"], include_thumbnails: true)
              files = folder_contents["value"] || []

              # Add folder info to each file for context
              files.each do |file|
                file["source_folder"] = folder_name
                all_files << file
              end
            end
          end

          # Separate files and subfolders
          files_only = all_files.reject { |item| item["folder"] }
          subfolders = all_files.select { |item| item["folder"] }

          render json: {
            files: files_only,
            subfolders: subfolders,
            total_count: files_only.length,
            found_folders: found_folders,
            requested_folders: folder_names,
            job_folder_id: job_folder["id"],
            job_folder_web_url: job_folder["webUrl"]
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
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        query = params[:q] || params[:query]

        unless query.present?
          return render json: { error: "Search query is required (use ?q=searchterm)" }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Search across the entire drive (not limited to root folder)
          results = client.search(query)

          # Format results
          items = (results["value"] || []).map do |item|
            {
              id: item["id"],
              name: item["name"],
              path: item.dig("parentReference", "path")&.gsub("/drive/root:", "") || "/",
              full_path: "#{item.dig('parentReference', 'path')&.gsub('/drive/root:', '') || ''}/#{item['name']}",
              web_url: item["webUrl"],
              is_folder: item["folder"].present?,
              size: item["size"],
              created_at: item["createdDateTime"],
              modified_at: item["lastModifiedDateTime"],
              mime_type: item.dig("file", "mimeType")
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
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        file_id = params[:file_id]

        unless file_id
          return render json: { error: "No file_id provided" }, status: :bad_request
        end

        begin
          # Check if using app credentials (requires different API calls)
          is_app_credential = credential.is_a?(MicrosoftCredential) && credential.credential_type == "app"

          if is_app_credential
            # App credentials use MicrosoftAppGraphClient with explicit site/drive
            client = MicrosoftAppGraphClient.new(credential)
            sharepoint_config = CorporateCompanySetting.sharepoint_config

            unless sharepoint_config[:configured]
              return render json: { error: "SharePoint not configured" }, status: :unprocessable_entity
            end

            # Get file metadata
            file_metadata = client.get_drive_item(sharepoint_config[:drive_id], file_id)

            # Download file content
            file_content = client.get_drive_item_content(
              drive_id: sharepoint_config[:drive_id],
              item_id: file_id
            )
          else
            # Delegated credentials use MicrosoftGraphClient with /me endpoints
            client = MicrosoftGraphClient.new(credential)

            # Get file metadata first
            file_metadata = client.get_file(file_id)

            # Download file content
            file_content = client.download_file(file_id)
          end

          # Send file to user (inline for preview, attachment for download)
          disposition = params[:preview] == "true" ? "inline" : "attachment"
          send_data file_content,
            filename: file_metadata["name"],
            type: file_metadata["file"]&.dig("mimeType") || "application/octet-stream",
            disposition: disposition

        rescue MicrosoftGraphClient::AuthenticationError, MicrosoftAppGraphClient::NotConnectedError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError, MicrosoftAppGraphClient::ApiError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to download file: #{e.message}"
          render json: { error: "Failed to download file: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/organization_onedrive/preview_private_folders
      # Preview the folder structure that would be created in 00 TEEEM PRIVATE
      def preview_private_folders
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
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
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        foundation_id = params[:foundation_id]
        record_ids = params[:record_ids] || []
        folder_id = params[:folder_id]
        new_folder_name = params[:new_folder_name]

        if record_ids.empty?
          return render json: { error: "No records selected" }, status: :bad_request
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
            folder_id = new_folder["id"]
          end

          # Get the target folder ID (use root if not specified)
          target_folder_id = folder_id || credential.root_folder_id

          unless target_folder_id
            return render json: { error: "No target folder specified and no root folder configured" }, status: :bad_request
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
                    { "Content-Type" => attachment.content_type || "application/octet-stream" }
                  )
                  uploaded_files << {
                    record_id: record.id,
                    filename: filename,
                    sharepoint_url: result["webUrl"],
                    size: file_content.bytesize
                  }
                else
                  # For larger files, create upload session
                  session = client.create_upload_session(target_folder_id, filename, file_content.bytesize)

                  # Upload in chunks
                  upload_url = session["uploadUrl"]
                  chunk_size = 10.megabytes
                  position = 0

                  while position < file_content.bytesize
                    chunk = file_content[position, chunk_size]
                    end_position = [ position + chunk.bytesize - 1, file_content.bytesize - 1 ].min

                    response = HTTParty.put(
                      upload_url,
                      body: chunk,
                      headers: {
                        "Content-Length" => chunk.bytesize.to_s,
                        "Content-Range" => "bytes #{position}-#{end_position}/#{file_content.bytesize}"
                      }
                    )

                    position += chunk_size

                    # Final chunk returns the file metadata
                    if response["id"]
                      uploaded_files << {
                        record_id: record.id,
                        filename: filename,
                        sharepoint_url: response["webUrl"],
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
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
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
        credential = OrganizationSharePointCredential.active_credential

        Rails.logger.info "[OneDrive Corporate Sync] Starting corporate document sync"

        unless credential&.valid_credential?
          Rails.logger.warn "[OneDrive Corporate Sync] No valid credential found"
          return render json: { error: "SharePoint not connected. Please connect in Settings first." }, status: :unauthorized
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

      # GET /api/v1/organization_onedrive/job_all_files
      # List ALL files from the job's OneDrive folder
      # Uses Data Warehouse pattern: reads from JobDocument table for instant results
      # Falls back to live API if no cached data, and triggers background sync
      def job_all_files
        job = Job.find(params[:job_id])

        # Check if we have cached documents in the data warehouse
        cached_docs = job.job_documents.includes(:document_type, :ai_suggested_type).synced

        if cached_docs.any?
          # Data Warehouse approach: instant results from database
          files_with_suggestions = cached_docs.map do |doc|
            {
              id: doc.onedrive_item_id,
              document_id: doc.id,
              name: doc.file_name,
              original_name: doc.original_file_name,
              size: doc.file_size,
              web_url: doc.web_url,
              modified: doc.last_modified_at&.iso8601,
              type: "file",
              folder_path: doc.folder_path || "",
              document_type_id: doc.document_type_id,
              document_type_name: doc.document_type&.name,
              document_type_abbreviation: doc.document_type&.abbreviation,
              suggested_document_types: build_document_type_display(doc),
              # AI analysis fields
              ai_analyzed: doc.ai_analyzed_at.present?,
              ai_analyzed_at: doc.ai_analyzed_at&.iso8601,
              ai_suggested_type_id: doc.ai_suggested_type_id,
              ai_suggested_type_name: doc.ai_suggested_type&.name,
              ai_proposed_name: doc.ai_proposed_name,
              ai_confidence: doc.ai_confidence&.to_f,
              ai_reasoning: doc.ai_reasoning,
              rename_status: doc.rename_status,
              from_cache: true
            }
          end

          # Sort by folder path then name
          files_with_suggestions.sort_by! { |f| [ f[:folder_path].to_s.downcase, f[:name].downcase ] }

          # Calculate AI stats
          ai_stats = {
            total: cached_docs.count,
            analyzed: cached_docs.where.not(ai_analyzed_at: nil).count,
            unanalyzed: cached_docs.where(ai_analyzed_at: nil).count,
            pending_review: cached_docs.where(rename_status: "pending").where.not(ai_analyzed_at: nil).count,
            approved: cached_docs.where(rename_status: "completed").count,
            rejected: cached_docs.where(rename_status: "rejected").count
          }

          return render json: {
            success: true,
            job_id: job.id,
            job_title: job.title,
            items: files_with_suggestions,
            count: files_with_suggestions.length,
            from_cache: true,
            last_synced_at: cached_docs.maximum(:last_synced_at)&.iso8601,
            ai_stats: ai_stats
          }
        end

        # No cached data - fall back to live API and trigger sync
        credential = get_onedrive_credential

        unless credential
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Find the job folder
          job_folder = client.find_job_folder(job)

          unless job_folder
            return render json: {
              success: false,
              error: "Job folder not found. Please create the folder structure first.",
              job_folder_exists: false,
              items: []
            }, status: :ok
          end

          # Recursively list all files in the job folder (live API)
          files = list_all_job_files_recursive(client, credential, job_folder["id"])

          # Load document types ONCE for efficiency (not per-file)
          @cached_doc_types = DocumentType.where(scope: %w[job both]).or(DocumentType.where(scope: nil)).to_a

          # Add suggested document types for each file based on filename and folder
          files_with_suggestions = files.map do |file|
            suggested = suggest_document_type_for_file(file[:name], file[:folder_path])
            file.merge(suggested_document_types: suggested, from_cache: false)
          end

          # Trigger background sync to populate data warehouse for next time
          JobDocumentSyncJob.perform_later(job.id) if defined?(JobDocumentSyncJob)

          render json: {
            success: true,
            job_id: job.id,
            job_title: job.title,
            items: files_with_suggestions,
            count: files_with_suggestions.length,
            job_folder_id: job_folder["id"],
            job_folder_web_url: job_folder["webUrl"],
            from_cache: false,
            sync_triggered: true
          }

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "[Job All Files] Exception: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to list files: #{e.message}" }, status: :internal_server_error
        end
      end

      # Helper to build document type display for cached documents
      # Shows assigned type if present, otherwise shows suggestions
      def build_document_type_display(doc)
        if doc.document_type_id.present? && doc.document_type
          # File has an assigned document type - show it as confirmed
          [ {
            id: doc.document_type.id,
            name: doc.document_type.name,
            abbreviation: doc.document_type.abbreviation,
            folder: doc.document_type.folder,
            confidence: 100
          } ]
        else
          # No type assigned - show suggestions
          suggest_cached_doc_type(doc)
        end
      end

      # Helper to suggest document types for cached documents
      def suggest_cached_doc_type(doc)
        @cached_doc_types ||= DocumentType.where(scope: %w[job both]).or(DocumentType.where(scope: nil)).to_a
        suggestions = suggest_document_type_for_file(doc.file_name, doc.folder_path)
        suggestions || []
      end

      # POST /api/v1/organization_onedrive/sync_job_documents
      # Manually trigger sync of job documents to data warehouse
      # Can sync a single job or all jobs with OneDrive folders
      def sync_job_documents
        job_id = params[:job_id]

        if job_id.present?
          # Sync single job
          job = Job.find(job_id)
          JobDocumentSyncJob.perform_later(job.id)
          render json: {
            success: true,
            message: "Sync triggered for job #{job.id}: #{job.title}",
            job_id: job.id
          }
        else
          # Sync all jobs with OneDrive folders
          JobDocumentSyncJob.perform_later
          jobs_count = Job.where(onedrive_folder_creation_status: "completed").count
          render json: {
            success: true,
            message: "Sync triggered for #{jobs_count} jobs with OneDrive folders",
            jobs_count: jobs_count
          }
        end
      rescue ActiveRecord::RecordNotFound => e
        render json: { error: "Job not found" }, status: :not_found
      end

      # GET /api/v1/organization_onedrive/legacy_files
      # List files from the legacy "Old House Data/00 Active" folder that match a job
      # Used for importing legacy job documents into the new job folder structure
      # Supports folder navigation with optional folder_id parameter
      def legacy_files
        job = Job.find(params[:job_id])

        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        begin
          service = JobDocumentMigrationService.new
          # Pass folder_id for subfolder navigation, recursive for all files
          recursive = params[:recursive] == "true" || params[:recursive] == true
          items = service.list_legacy_files_for_job(job, folder_id: params[:folder_id], recursive: recursive)

          render json: {
            success: true,
            job_id: job.id,
            job_title: job.title,
            items: items,
            count: items.length,
            current_folder_id: params[:folder_id],
            recursive: recursive,
            source_folder: JobDocumentMigrationService::SOURCE_FOLDER_PATH
          }

        rescue StandardError => e
          Rails.logger.error "[Legacy Files] Exception: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to list legacy files: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/import_legacy
      # Import selected files from legacy location to a job's OneDrive folder
      # Params:
      #   - job_id: Target job ID
      #   - file_ids: Array of OneDrive file IDs to import
      def import_legacy
        job = Job.find(params[:job_id])
        file_ids = params[:file_ids] || []

        if file_ids.empty?
          return render json: { error: "No files selected for import" }, status: :bad_request
        end

        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        begin
          # Queue the import as a background job to avoid HTTP timeouts
          # Large imports can take several minutes
          ImportLegacyFilesJob.perform_later(job.id, file_ids, current_user&.id)

          render json: {
            success: true,
            message: "Import of #{file_ids.length} files has been queued. Files will appear in the job folder shortly.",
            job_id: job.id,
            queued: true,
            file_count: file_ids.length
          }

        rescue StandardError => e
          Rails.logger.error "[Import Legacy] Exception: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to queue import: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/organization_onedrive/analyze_job_documents
      # Trigger AI analysis for a job's documents
      # Analyzes unanalyzed documents and suggests document types and filenames
      def analyze_job_documents
        job_id = params[:job_id]
        limit = params[:limit]&.to_i || 25

        unless job_id.present?
          return render json: { error: "job_id is required" }, status: :bad_request
        end

        job = Job.find(job_id)

        # Count documents needing analysis
        unanalyzed_count = JobDocument.where(job_id: job.id, ai_analyzed_at: nil).count

        if unanalyzed_count == 0
          return render json: {
            success: true,
            message: "All documents have already been analyzed",
            job_id: job.id,
            analyzed_count: 0,
            total_unanalyzed: 0
          }
        end

        # Queue the batch analysis job
        BatchJobDocumentAnalysisJob.perform_later(job_id: job.id, limit: limit)

        render json: {
          success: true,
          message: "AI analysis queued for #{[ limit, unanalyzed_count ].min} documents",
          job_id: job.id,
          queued_count: [ limit, unanalyzed_count ].min,
          total_unanalyzed: unanalyzed_count
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Job not found" }, status: :not_found
      end

      # GET /api/v1/organization_onedrive/documents_needing_review
      # List documents with AI suggestions pending review
      # Params:
      #   - job_id: Optional - filter by job
      #   - status: 'pending' (default), 'approved', 'rejected', 'all'
      #   - min_confidence: Optional - only show docs above this confidence (0-100)
      def documents_needing_review
        scope = JobDocument.includes(:job, :document_type, :ai_suggested_type)
                          .where.not(ai_analyzed_at: nil)

        # Filter by job if specified
        if params[:job_id].present?
          scope = scope.where(job_id: params[:job_id])
        end

        # Filter by rename status
        status = params[:status] || "pending"
        unless status == "all"
          scope = scope.where(rename_status: status)
        end

        # Filter by minimum confidence
        if params[:min_confidence].present?
          min_conf = params[:min_confidence].to_i
          scope = scope.where("ai_confidence >= ?", min_conf)
        end

        # Order by confidence descending (highest confidence first)
        documents = scope.order(ai_confidence: :desc, ai_analyzed_at: :desc).limit(100)

        render json: {
          success: true,
          documents: documents.map { |doc| format_document_for_review(doc) },
          count: documents.length,
          filters: {
            job_id: params[:job_id],
            status: status,
            min_confidence: params[:min_confidence]
          }
        }
      end

      # POST /api/v1/organization_onedrive/approve_document_rename
      # Approve or reject AI rename suggestion for a document
      # Params:
      #   - document_id: The JobDocument ID
      #   - action: 'approve' or 'reject'
      #   - custom_name: Optional - use this name instead of AI suggestion
      #   - custom_type_id: Optional - use this document type instead of AI suggestion
      def approve_document_rename
        document = JobDocument.find(params[:document_id])
        action = params[:action]

        unless %w[approve reject].include?(action)
          return render json: { error: "action must be 'approve' or 'reject'" }, status: :bad_request
        end

        if action == "reject"
          document.update!(
            rename_status: "rejected",
            rename_approved_at: Time.current,
            rename_approved_by_id: current_user&.id
          )

          return render json: {
            success: true,
            message: "Rename suggestion rejected",
            document_id: document.id,
            status: "rejected"
          }
        end

        # Action is 'approve' - perform the rename in OneDrive
        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        # Determine the new name
        new_name = params[:custom_name].presence || document.ai_proposed_name

        unless new_name.present?
          return render json: { error: "No proposed name available" }, status: :bad_request
        end

        # Determine the document type
        new_type_id = params[:custom_type_id].presence || document.ai_suggested_type_id

        begin
          client = MicrosoftGraphClient.new(credential)

          # Rename the file in OneDrive
          result = client.patch(
            "/drives/#{credential.drive_id}/items/#{document.onedrive_item_id}",
            { name: new_name }
          )

          # Update the document record
          document.update!(
            file_name: new_name,
            document_type_id: new_type_id,
            rename_status: "completed",
            rename_approved_at: Time.current,
            rename_approved_by_id: current_user&.id,
            web_url: result["webUrl"]
          )

          render json: {
            success: true,
            message: "Document renamed successfully",
            document_id: document.id,
            old_name: document.original_file_name,
            new_name: new_name,
            document_type_id: new_type_id,
            web_url: result["webUrl"]
          }

        rescue MicrosoftGraphClient::APIError => e
          Rails.logger.error "[Approve Rename] OneDrive API error: #{e.message}"
          render json: { error: "Failed to rename in OneDrive: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "[Approve Rename] Error: #{e.message}"
          render json: { error: "Failed to rename: #{e.message}" }, status: :internal_server_error
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Document not found" }, status: :not_found
      end

      # POST /api/v1/organization_onedrive/bulk_approve_renames
      # Bulk approve multiple document renames
      # Params:
      #   - document_ids: Array of JobDocument IDs to approve
      def bulk_approve_renames
        document_ids = params[:document_ids] || []

        if document_ids.empty?
          return render json: { error: "No document IDs provided" }, status: :bad_request
        end

        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        documents = JobDocument.where(id: document_ids, rename_status: "pending")
                              .where.not(ai_proposed_name: nil)

        results = { approved: 0, failed: 0, errors: [] }

        client = MicrosoftGraphClient.new(credential)

        documents.each do |doc|
          begin
            # Rename in OneDrive
            result = client.patch(
              "/drives/#{credential.drive_id}/items/#{doc.onedrive_item_id}",
              { name: doc.ai_proposed_name }
            )

            # Update document record
            doc.update!(
              file_name: doc.ai_proposed_name,
              document_type_id: doc.ai_suggested_type_id,
              rename_status: "completed",
              rename_approved_at: Time.current,
              rename_approved_by_id: current_user&.id,
              web_url: result["webUrl"]
            )

            results[:approved] += 1

          rescue StandardError => e
            results[:failed] += 1
            results[:errors] << { document_id: doc.id, error: e.message }
            Rails.logger.error "[Bulk Approve] Failed for doc #{doc.id}: #{e.message}"
          end
        end

        render json: {
          success: true,
          message: "Approved #{results[:approved]} renames, #{results[:failed]} failed",
          results: results
        }
      end

      # POST /api/v1/organization_onedrive/run_migration
      # Run the bulk job document migration (dry_run by default)
      # Admin only - migrates all documents from legacy folder to job folders
      def run_migration
        unless current_user&.admin?
          return render json: { error: "Admin access required" }, status: :forbidden
        end

        credential = OrganizationSharePointCredential.active_credential

        unless credential&.valid_credential?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        dry_run = params[:dry_run] != "false" && params[:dry_run] != false
        limit = params[:limit]&.to_i

        begin
          service = JobDocumentMigrationService.new
          stats = service.run(dry_run: dry_run, limit: limit)

          render json: {
            success: true,
            dry_run: dry_run,
            stats: stats
          }

        rescue StandardError => e
          Rails.logger.error "[Run Migration] Exception: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Migration failed: #{e.message}" }, status: :internal_server_error
        end
      end

      private

      # Change root folder by folder_id (for folder browser selection)
      def change_root_folder_by_id(credential, folder_id)
        client = MicrosoftGraphClient.new(credential)

        # Get the correct drive path (handles SharePoint vs personal OneDrive)
        drive_path = credential.drive_id.present? ? "/drives/#{credential.drive_id}" : "/me/drive"

        # Get folder info from Graph API
        folder_response = client.get("#{drive_path}/items/#{folder_id}")

        # Build the folder path from parentReference.path
        parent_path = folder_response.dig("parentReference", "path") || ""
        folder_name = folder_response["name"]

        # Path looks like: /drive/root:/Shared Documents/TEEEM Jobs
        if parent_path.include?(":")
          path_after_root = parent_path.split(":").last.to_s
          path_parts = path_after_root.split("/").reject(&:blank?)
          full_path = (path_parts + [ folder_name ]).join("/")
        else
          full_path = folder_name
        end

        # Update credential with new root folder info
        credential.update!(
          root_folder_id: folder_response["id"],
          root_folder_path: full_path,
          metadata: credential.metadata.merge({
            root_folder_name: folder_name,
            root_folder_web_url: folder_response["webUrl"],
            updated_at: Time.current
          })
        )

        render json: {
          message: "Root folder updated successfully",
          root_folder_path: full_path,
          root_folder_web_url: folder_response["webUrl"]
        }

      rescue MicrosoftGraphClient::AuthenticationError => e
        render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
      rescue MicrosoftGraphClient::APIError => e
        render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
      rescue StandardError => e
        Rails.logger.error "Failed to change root folder by ID: #{e.message}"
        Rails.logger.error e.backtrace.join("\n")
        render json: { error: "Failed to change root folder: #{e.message}" }, status: :internal_server_error
      end

      # Get the best available credential for OneDrive operations
      # Prioritizes organization credential, falls back to user's Microsoft token
      # Handles decryption errors gracefully (e.g., when credentials were encrypted with different keys)
      def get_onedrive_credential
        # First try organization-wide credential
        credential = begin
          cred = OrganizationSharePointCredential.active_credential
          # Try to access an encrypted field to verify decryption works
          if cred
            cred.access_token
            cred if cred.valid_credential?
          end
        rescue ActiveRecord::Encryption::Errors::Decryption => e
          Rails.logger.warn "[OneDrive] Decryption error loading org credential: #{e.message}"
          nil
        end

        return credential if credential

        # Fall back to user's Microsoft token
        microsoft_token = current_user&.microsoft_token
        if microsoft_token&.status == "connected" && microsoft_token&.access_token.present?
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
        when "contacts", "contact"
          Contact
        when "jobs", "job"
          Job
        when "companies", "company"
          Company
        when "assets", "asset"
          Asset
        when "documents", "document", "company_documents"
          CorporateCompanyDocument
        when "pay_now_requests", "pay_now_request"
          PayNowRequest
        when "financial_transactions", "financial_transaction"
          FinancialTransaction
        else
          # Try to find a foundation and get its model
          foundation = Foundation.find_by(foundation_id: foundation_id) || Foundation.find_by(id: foundation_id)
          if foundation&.model_class.present?
            # Whitelist valid model classes to prevent RCE via constantize
            valid_models = %w[
              Job Contact Supplier Case Invoice Quote Estimate Task
              SmTask SmTemplate Foundation Record CorporateCompanyDocument
              PayNowRequest FinancialTransaction User PricebookItem
              Column FoundationView WhsIncident WhsInspection WhsInduction
            ]
            model_name = foundation.model_class.to_s
            valid_models.include?(model_name) ? model_name.constantize : nil
          end
        end
      end

      # Get all Active Storage attachments for a record
      def get_attachments_for_record(record)
        attachments = []

        # Check for common attachment names
        attachment_names = [ :file, :files, :photos, :photo, :invoice, :document, :documents, :receipt, :attachments, :proof_photos, :invoice_file ]

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

      # Recursively list all files in a job folder
      # Similar to JobDocumentMigrationService but for the job's own folder
      def list_all_job_files_recursive(client, credential, root_folder_id, max_depth: 5, max_time: 25)
        files = []
        folders_to_process = [ [ root_folder_id, 0, "" ] ] # [folder_id, depth, path]
        start_time = Time.now

        while folders_to_process.any?
          # Check if we've exceeded the time limit
          if Time.now - start_time > max_time
            Rails.logger.warn("[Job All Files] Recursive listing timed out after #{max_time}s with #{files.length} files found")
            break
          end

          current_id, depth, current_path = folders_to_process.shift

          begin
            url = "/drives/#{credential.drive_id}/items/#{current_id}/children?$select=id,name,size,webUrl,lastModifiedDateTime,file,folder&$top=200"
            result = client.get(url)

            result["value"]&.each do |item|
              if item["file"]
                files << {
                  id: item["id"],
                  name: item["name"],
                  size: item["size"],
                  web_url: item["webUrl"],
                  modified: item["lastModifiedDateTime"],
                  type: "file",
                  folder_path: current_path,
                  mime_type: item.dig("file", "mimeType")
                }
              elsif item["folder"] && depth < max_depth
                folder_name = item["name"]
                new_path = current_path.empty? ? folder_name : "#{current_path}/#{folder_name}"
                folders_to_process << [ item["id"], depth + 1, new_path ]
              end
            end
          rescue MicrosoftGraphClient::APIError => e
            Rails.logger.warn("[Job All Files] Failed to list folder #{current_id}: #{e.message}")
          end
        end

        Rails.logger.info("[Job All Files] Listing completed: #{files.length} files in #{(Time.now - start_time).round(2)}s")

        # Sort by folder path then name
        files.sort_by { |f| [ f[:folder_path].to_s.downcase, f[:name].downcase ] }
      end

      # Suggest document types for a file based on filename and folder path
      # Returns array of {id, name, abbreviation, confidence} hashes
      # Uses @cached_doc_types if available (set by job_all_files action)
      def suggest_document_type_for_file(filename, folder_path)
        return [] if filename.blank?

        suggestions = []
        filename_lower = filename.downcase
        folder_lower = (folder_path || "").downcase

        # Use cached doc types if available, otherwise query (fallback)
        job_doc_types = @cached_doc_types || DocumentType.where(scope: %w[job both]).or(DocumentType.where(scope: nil)).to_a

        job_doc_types.each do |dt|
          confidence = 0

          # Check filename patterns
          dt_name_lower = dt.name.to_s.downcase
          abbrev_lower = dt.abbreviation.to_s.downcase

          # High confidence: abbreviation in filename
          if abbrev_lower.present? && filename_lower.include?(abbrev_lower)
            confidence += 50
          end

          # Medium confidence: doc type name keywords in filename
          dt_keywords = dt_name_lower.split(/[\s\-\/]+/).reject { |w| w.length < 3 }
          matching_keywords = dt_keywords.count { |kw| filename_lower.include?(kw) }
          if matching_keywords > 0
            confidence += (matching_keywords * 15)
          end

          # Medium confidence: folder path matches doc type folder
          if dt.folder.present? && folder_lower.include?(dt.folder.downcase)
            confidence += 25
          end

          # Check for common patterns
          case
          when filename_lower.match?(/photo|img_|dsc_|image/i) && dt_name_lower.include?("photo")
            confidence += 40
          when filename_lower.match?(/plan|drawing|cad|dwg/i) && dt_name_lower.include?("plan")
            confidence += 40
          when filename_lower.match?(/contract|agreement|variation/i) && dt_name_lower.match?(/contract|variation|agreement/)
            confidence += 40
          when filename_lower.match?(/certificate|cert/i) && dt_name_lower.include?("certificate")
            confidence += 40
          when filename_lower.match?(/invoice|po|purchase/i) && dt_name_lower.match?(/invoice|purchase|order/)
            confidence += 40
          when filename_lower.match?(/quote|proposal|estimate/i) && dt_name_lower.match?(/quote|proposal|estimate/)
            confidence += 40
          when filename_lower.match?(/engineer|structural/i) && dt_name_lower.match?(/engineer|structural/)
            confidence += 40
          when filename_lower.match?(/survey|soil|geotech/i) && dt_name_lower.match?(/survey|soil|geotech/)
            confidence += 40
          when filename_lower.match?(/insurance|coc|currency/i) && dt_name_lower.match?(/insurance|certificate of currency/)
            confidence += 40
          end

          # Add to suggestions if confidence > threshold
          if confidence >= 25
            suggestions << {
              id: dt.id,
              name: dt.name,
              abbreviation: dt.abbreviation,
              folder: dt.folder,
              confidence: confidence
            }
          end
        end

        # Sort by confidence descending and return top 3
        suggestions.sort_by { |s| -s[:confidence] }.first(3)
      end

      # Format a document for the review UI
      def format_document_for_review(doc)
        {
          id: doc.id,
          job_id: doc.job_id,
          job_title: doc.job&.title,
          onedrive_item_id: doc.onedrive_item_id,
          current_name: doc.file_name,
          original_name: doc.original_file_name,
          proposed_name: doc.ai_proposed_name,
          folder_path: doc.folder_path,
          file_extension: doc.file_extension,
          file_type: doc.file_type,
          file_size: doc.file_size,
          web_url: doc.web_url,
          current_type: doc.document_type ? {
            id: doc.document_type.id,
            name: doc.document_type.name,
            abbreviation: doc.document_type.abbreviation
          } : nil,
          suggested_type: doc.ai_suggested_type ? {
            id: doc.ai_suggested_type.id,
            name: doc.ai_suggested_type.name,
            abbreviation: doc.ai_suggested_type.abbreviation
          } : nil,
          ai_confidence: doc.ai_confidence&.to_f,
          ai_reasoning: doc.ai_reasoning,
          ai_analyzed_at: doc.ai_analyzed_at&.iso8601,
          rename_status: doc.rename_status,
          rename_approved_at: doc.rename_approved_at&.iso8601
        }
      end

      # Dynamically determine the frontend URL from the request
      # This ensures OAuth redirects work correctly across different environments
      def get_frontend_url_from_request
        # Try to get the origin from the Referer header (where the user initiated the OAuth flow)
        referer = request.referer

        if referer.present?
          uri = URI.parse(referer)
          frontend_url = "#{uri.scheme}://#{uri.host}"
          frontend_url += ":#{uri.port}" if uri.port && ![ 80, 443 ].include?(uri.port)
          Rails.logger.info "Using frontend URL from referer: #{frontend_url}"
          return frontend_url
        end

        # Fallback to Origin header if Referer is not present
        origin = request.headers["Origin"]
        if origin.present?
          Rails.logger.info "Using frontend URL from Origin header: #{origin}"
          return origin
        end

        # Final fallback to environment variable
        frontend_url = ENV["FRONTEND_URL"] || "https://teeem.vercel.app"
        Rails.logger.info "Using frontend URL from ENV (fallback): #{frontend_url}"
        frontend_url
      end
    end
  end
end

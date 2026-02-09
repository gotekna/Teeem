module Api
  module V1
    # SSoT: Provider-agnostic document storage controller
    # Handles auth, browse, download for all storage providers (SharePoint, S3, Wasabi)
    # RENAMED: OrganizationOnedriveController → OrganizationSharepointController → DocumentStorageController
    class DocumentStorageController < ApplicationController
      include DocumentProviderAware

      # Skip auth for OAuth callback (comes from Microsoft, not our frontend)
      # Skip auth for download previews (thumbnails) - uses browser caching, file IDs are unguessable
      # Skip auth for job_document_download - opened in new browser tab via window.open()
      skip_before_action :authorize_request, only: [ :callback, :download, :job_document_download ]

      # Skip tenant for public download endpoints - tenant determined from storage key, not user
      skip_before_action :set_tenant, only: [ :download, :job_document_download ], raise: false

      # Require admin for sensitive operations
      before_action :require_admin, only: [ :disconnect, :change_root_folder, :sync_corporate_documents ]

      # SSoT: Setup document provider for provider-agnostic methods
      # Skip for SharePoint-specific admin actions (OAuth, site selection, etc.)
      # Note: download and job_document_download excluded - they create providers directly
      # and can be called without tenant context (public endpoints)
      before_action :setup_storage_provider, only: [
        :browse_folders, :create_root_folder, :validate_folder,
        :folder_contents, :search, :presigned_url,
        :download_url, :upload, :delete_file, :copy_files,
        :job_all_files, :job_document_url
      ]

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

      # GET /api/v1/documents/status
      # Check if organization has OneDrive connected
      # SSoT: WarehouseProvider.provider_type determines THE ONE storage backend
      # No fallback chains - one provider, one credential check
      def status
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

        storage_config = WarehouseProvider.instance
        # FRC (Feb 2026): No hardcoded defaults - return actual configured provider
        provider = storage_config&.provider_type

        unless provider.present?
          return render json: {
            connected: false,
            provider_type: nil,
            error: "Storage provider not configured"
          }
        end

        case provider
        when "s3_compatible"
          # SSoT: S3-compatible storage via S3CompatibleCredential
          # FRC (Feb 2026): Must be tenant-scoped
          credential = S3CompatibleCredential.for_tenant(current_tenant).active.first
          if credential&.status == "connected"
            render json: {
              connected: true,
              provider_type: provider,
              bucket: storage_config&.bucket,
              endpoint: credential.endpoint,
              region: credential.region,
              root_path: storage_config&.root_path
            }
          else
            render json: {
              connected: false,
              provider_type: provider,
              message: "S3 storage not connected. Configure in Admin > System > Connections."
            }
          end

        when "sharepoint"
          # SSoT: SharePoint storage via MicrosoftCredential
          credential = begin
            # FRC (Feb 2026): Must be tenant-scoped
            cred = MicrosoftCredential.for_tenant(current_tenant).refreshable_delegated.org_level.first ||
                   MicrosoftCredential.for_tenant(current_tenant).refreshable_app.first
            cred&.access_token if cred # Verify decryption works
            cred
          rescue ActiveRecord::Encryption::Errors::Decryption => e
            Rails.logger.warn "[Storage Status] Decryption error: #{e.message}"
            nil
          end

          if credential&.valid_credential?
            # Auto-refresh expired tokens
            if credential.token_expired? && credential.refresh_token.present?
              begin
                MicrosoftGraphClient.new(credential).refresh_token!
                credential.reload
              rescue StandardError => e
                Rails.logger.error "[Storage Status] Token refresh failed: #{e.message}"
                return render json: {
                  connected: false,
                  provider_type: provider,
                  message: "Session expired. Reconnect in Admin > System > Connections."
                }
              end
            end

            render json: {
              connected: true,
              provider_type: provider,
              drive_id: storage_config&.drive_id,
              drive_name: storage_config&.drive_name,
              root_folder_id: storage_config&.root_folder_id,  # SSoT: WarehouseProvider
              root_folder_path: storage_config&.root_path,
              connected_at: credential.created_at,
              connected_by: credential.connected_by&.as_json
            }
          else
            render json: {
              connected: false,
              provider_type: provider,
              message: "SharePoint not connected. Configure in Admin > System > Connections."
            }
          end

        else
          render json: {
            connected: false,
            provider_type: provider,
            message: "Unknown storage provider: #{provider}"
          }
        end
      end

      # GET /api/v1/documents/authorize
      # Start OAuth flow - returns authorization URL
      def authorize
        redirect_uri = "#{request.base_url}/api/v1/documents/callback"

        auth_url = MicrosoftGraphClient.authorization_url(
          client_id: ENV["ONEDRIVE_CLIENT_ID"],
          redirect_uri: redirect_uri,
          scope: "Files.ReadWrite.All Sites.ReadWrite.All offline_access"
        )

        render json: { auth_url: auth_url }
      end

      # GET /api/v1/documents/callback
      # OAuth callback - exchange code for tokens
      def callback
        code = params[:code]

        unless code
          return render json: { error: "Authorization code not provided" }, status: :bad_request
        end

        begin
          Rails.logger.info "=== OneDrive OAuth Callback Started ==="

          redirect_uri = "#{request.base_url}/api/v1/documents/callback"

          # Exchange authorization code for tokens
          token_data = MicrosoftGraphClient.exchange_code_for_tokens(
            code: code,
            client_id: ENV["ONEDRIVE_CLIENT_ID"],
            client_secret: ENV["ONEDRIVE_CLIENT_SECRET"],
            redirect_uri: redirect_uri
          )

          Rails.logger.info "Token exchange successful"

          # SSoT: Use MicrosoftCredential for new OAuth credentials
          # Deactivate any existing org-level delegated credentials
          MicrosoftCredential.delegated_credentials.org_level.active.update_all(is_active: false)

          # SSoT (Jan 2026): Derive organization from tenant
          org = current_tenant&.organizations&.first

          # Create new credential with refresh token
          credential = MicrosoftCredential.create!(
            credential_type: "delegated",
            organization: org,
            access_token: token_data[:access_token],
            refresh_token: token_data[:refresh_token],
            token_expires_at: token_data[:expires_at],
            connected_by: current_user,
            status: "connected",
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
            # SSoT: Get SharePoint site name from WarehouseProvider (Jan 2026)
            storage_config = WarehouseProvider.instance
            site_name = storage_config&.site_name.presence || TenantSetting.instance.company_name
            site_name_lower = site_name&.downcase || ""

            Rails.logger.info "Switching to #{site_name} SharePoint site..."
            begin
              result = client.use_sharepoint_site(site_name)
              Rails.logger.info "Connected to SharePoint site: #{result[:site]['displayName'] || site_name}"
            rescue StandardError => e
              Rails.logger.warn "Could not find #{site_name} SharePoint site, trying search..."
              sites = client.list_sharepoint_sites
              matching_site = sites.find { |s| s[:name]&.downcase&.include?(site_name_lower) }
              if matching_site
                result = client.use_sharepoint_site(matching_site[:id])
                Rails.logger.info "Connected to SharePoint site via search: #{matching_site[:name]}"
              else
                Rails.logger.warn "#{site_name} SharePoint site not found, falling back to default drive"
              end
            end

            # Create root folder for all jobs in the SharePoint site (SSoT)
            jobs_folder_name = WarehouseProvider.instance.path_for(:jobs)
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

      # DELETE /api/v1/documents/disconnect
      # Disconnect OneDrive for organization
      def disconnect
        credential = MicrosoftCredential.sharepoint_credential

        if credential
          credential.deactivate!
          render json: { message: "OneDrive disconnected successfully" }
        else
          render json: { message: "OneDrive was not connected" }, status: :not_found
        end
      end

      # PATCH /api/v1/documents/change_root_folder
      # Change the root folder for organization OneDrive
      # Accepts either folder_id (for browsed selection) or folder_name (for typed path)
      def change_root_folder
        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
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

          # SSoT: Update WarehouseProvider with root folder info (not credential)
          storage_config = WarehouseProvider.instance
          if storage_config
            storage_config.root_folder_id = current_folder["id"]
            storage_config.root_folder_path = sanitized_path
            storage_config.save!
          end

          # Store metadata in credential (non-config data like URLs, timestamps)
          credential.update!(
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

      # GET /api/v1/documents/sharepoint_sites
      # List available SharePoint sites
      def sharepoint_sites
        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
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

      # POST /api/v1/documents/use_personal_drive
      # Switch to using personal OneDrive instead of SharePoint
      def use_personal_drive
        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # Get personal OneDrive info
          drive_info = client.get("/me/drive")

          # SSoT: Update WarehouseProvider with new drive info
          storage_config = WarehouseProvider.instance
          if storage_config
            storage_config.update_connection(
              "drive_id" => drive_info["id"],
              "drive_name" => drive_info["name"] || "My OneDrive",
              "root_folder_id" => nil,
              "root_folder_path" => nil
            )
          end

          # Store metadata in credential (non-config data)
          credential.update!(
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

      # POST /api/v1/documents/use_sharepoint_site
      # Switch to using a SharePoint site instead of personal OneDrive
      def use_sharepoint_site
        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        site_name = params[:site_name]

        if site_name.blank?
          return render json: { error: "Site name is required" }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)
          result = client.use_sharepoint_site(site_name)

          # SSoT: Reset root folder in WarehouseProvider (not credential)
          storage_config = WarehouseProvider.instance
          if storage_config
            storage_config.root_folder_id = nil
            storage_config.root_folder_path = nil
            storage_config.save!
          end

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

      # GET /api/v1/documents/browse_folders
      # Browse OneDrive folders - optionally within a specific folder
      # Returns folders and breadcrumb path for navigation
      # Performance: Cached for 2 minutes to reduce SharePoint API calls
      # NOTE: This is SharePoint-specific (admin folder selection UI)
      def browse_folders
        # SSoT: Use helper methods for credential and client
        unless sharepoint_connected?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        folder_id = params[:folder_id] # Optional - if not provided, browse root

        # Skip cache if explicitly requested
        skip_cache = params[:refresh] == "true"
        cache_key = "sharepoint:browse_folders:#{folder_id || 'root'}"

        # Try to get from cache first (2 minute TTL)
        cached_result = Rails.cache.read(cache_key) unless skip_cache
        if cached_result
          return render json: cached_result.merge(from_cache: true)
        end

        begin
          current_folder = nil
          breadcrumbs = []

          # App credentials use different API methods than delegated
          if sharepoint_credential.credential_type == "app"
            # App credentials use MicrosoftAppGraphClient with explicit site/drive
            client = sharepoint_client
            storage_config = WarehouseProvider.instance

            unless storage_config&.connected?
              return render json: { error: "SharePoint not configured" }, status: :unprocessable_entity
            end

            drive_id = storage_config.drive_id

            if folder_id.present?
              # Get current folder info for breadcrumb
              current_folder_response = client.get_drive_item(drive_id, folder_id)
              current_folder = {
                id: current_folder_response[:id],
                name: current_folder_response[:name],
                parent_id: current_folder_response[:parent_id]
              }

              # Build breadcrumb path from parent_path
              parent_path = current_folder_response[:parent_path] || ""
              if parent_path.include?(":")
                path_after_root = parent_path.split(":").last.to_s
                path_parts = path_after_root.split("/").reject(&:blank?)
                breadcrumbs = path_parts.map { |name| { name: name, id: nil } }
              end
              breadcrumbs << { name: current_folder[:name], id: current_folder[:id] }

              # Browse children of specific folder
              items = client.list_drive_items(drive_id, folder_id: folder_id)
            else
              # Browse root drive folders
              items = client.list_drive_items(drive_id)
            end

            # Filter to only show folders (list_drive_items returns formatted items)
            folders = items.select { |item| item[:is_folder] }

            # Format response (already formatted by MicrosoftAppGraphClient)
            formatted_folders = folders.map do |folder|
              {
                id: folder[:id],
                name: folder[:name],
                web_url: folder[:web_url],
                created_at: folder[:created_at],
                child_count: folder[:child_count] || 0
              }
            end.sort_by { |f| f[:name].downcase }
          else
            # Delegated credentials use MicrosoftGraphClient with /me endpoints
            client = sharepoint_client

            # SSoT: Get drive path from WarehouseProvider (Jan 2026)
            config = WarehouseProvider.instance
            drive_path = config&.drive_id.present? ? "/drives/#{config.drive_id}" : "/me/drive"

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
          end

          result = {
            folders: formatted_folders,
            current_folder: current_folder,
            breadcrumbs: breadcrumbs,
            parent_folder_id: folder_id
          }

          # Cache for 2 minutes
          Rails.cache.write(cache_key, result, expires_in: 2.minutes)

          render json: result.merge(from_cache: false)

        rescue MicrosoftGraphClient::AuthenticationError, MicrosoftAppGraphClient::NotConnectedError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError, MicrosoftAppGraphClient::ApiError => e
          render json: { error: "SharePoint API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to browse folders: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to browse folders: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/documents/create_root_folder
      # Create a root folder in the current drive (e.g., "Teeem" folder)
      # Used to auto-create the Teeem folder if it doesn't exist
      def create_root_folder
        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        folder_name = params[:folder_name]

        if folder_name.blank?
          return render json: { error: "Folder name is required" }, status: :bad_request
        end

        begin
          client = MicrosoftGraphClient.new(credential)

          # SSoT: Get drive_id from WarehouseProvider (Jan 2026)
          storage_drive_id = WarehouseProvider.instance&.drive_id
          folder = client.create_folder(folder_name, drive_id: storage_drive_id)

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

      # GET /api/v1/documents/validate_folder
      # Validate the root folder exists and hasn't been renamed or moved
      # Returns folder validation status and auto-updates metadata if folder was renamed
      def validate_folder
        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
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

      # POST /api/v1/documents/create_all_job_folders
      # Queue folder creation for ALL jobs that don't have folders yet
      # SSoT: Uses Job#create_folders_if_needed! (THE ONE way)
      def create_all_job_folders
        # Find jobs that need folders (not already completed, pending, or processing)
        jobs_needing_folders = Job.where(storage_folder_status: [nil, "not_requested", "failed"])

        queued_count = 0
        already_complete_count = Job.where(storage_folder_status: "completed").count
        in_progress_count = Job.where(storage_folder_status: %w[pending processing]).count

        jobs_needing_folders.find_each do |job|
          # SSoT: THE ONE way to create job folders
          job.create_folders_if_needed!
          queued_count += 1
        end

        render json: {
          message: "Bulk folder creation queued",
          total_jobs: Job.count,
          queued: queued_count,
          already_complete: already_complete_count,
          in_progress: in_progress_count
        }, status: :accepted
      end

      # POST /api/v1/documents/create_job_folders
      # Create folder structure for a specific job
      # SSoT: Uses Job#create_folders_if_needed! (THE ONE way)
      def create_job_folders
        job = Job.find(params[:job_id])

        # Check if already completed
        if job.storage_folder_status == "completed"
          return render json: {
            message: "Folder structure already exists for this job",
            status: job.storage_folder_status,
            storage_folder_id: job.storage_folder_id
          }
        end

        # Check if already processing
        if job.storage_folder_status.in?(%w[pending processing])
          return render json: {
            message: "Folder creation already in progress",
            status: job.storage_folder_status
          }
        end

        # SSoT: THE ONE way to create job folders
        job.create_folders_if_needed!

        render json: {
          message: "Folder creation queued",
          status: job.storage_folder_status,
          job_id: job.id
        }, status: :accepted
      end

      # GET /api/v1/documents/job_folders
      # List folders and files for a specific job
      # SSoT: Uses DocumentProviderAware for provider-agnostic storage (Wasabi, SharePoint, S3)
      # Performance: Cached for 5 minutes to reduce API calls
      def list_job_items
        job = Job.find(params[:job_id])

        # SSoT: Setup provider using WarehouseProvider
        begin
          setup_default_provider!
        rescue DocumentProviders::NotConnectedError => e
          return render json: { error: "Storage not connected: #{e.message}" }, status: :unauthorized
        end

        # Skip cache if explicitly requested
        skip_cache = params[:refresh] == "true"
        subfolder = params[:folder_path] # Optional subfolder within job folder
        cache_key = "storage:job_items:#{job.id}:#{subfolder || 'root'}"

        # Try to get from cache first (5 minute TTL)
        cached_result = Rails.cache.read(cache_key) unless skip_cache

        if cached_result
          return render json: cached_result.merge(from_cache: true)
        end

        begin
          # Build job folder path using SSoT pattern
          job_folder_path = build_job_folder_path(job)

          # Check if job folder exists
          unless folder_exists_in_provider?(job_folder_path)
            return render json: {
              error: "Job folder not found. Please create the folder structure first.",
              job_folder_exists: false
            }, status: :not_found
          end

          # Get target path (job folder or subfolder within it)
          target_path = subfolder ? "#{job_folder_path}/#{subfolder}" : job_folder_path

          # List items in folder
          items = list_folder_in_provider(target_path, recursive: false)

          # Transform items to consistent format
          formatted_items = items.map do |item|
            {
              id: item[:id],
              name: item[:name],
              type: item[:type] == :folder ? "folder" : "file",
              size: item[:size],
              path: item[:path],
              webUrl: item[:web_url] || item[:path],
              lastModifiedDateTime: item[:modified_at]&.iso8601,
              thumbnailUrl: item[:thumbnail_url]
            }
          end

          result = {
            items: formatted_items,
            count: formatted_items.length,
            job_folder_path: job_folder_path,
            provider: current_provider_type.to_s
          }

          # Cache for 5 minutes
          Rails.cache.write(cache_key, result, expires_in: 5.minutes)

          render json: result.merge(from_cache: false)

        rescue DocumentProviders::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue DocumentProviders::Error => e
          render json: { error: "Storage error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to list items: #{e.message}"
          Rails.logger.error e.backtrace.first(5).join("\n")
          render json: { error: "Failed to list items: #{e.message}" }, status: :internal_server_error
        end
      end

      # POST /api/v1/documents/upload
      # Upload file to OneDrive
      # NOTE: This is SharePoint-specific (uses folder_id from SharePoint)
      def upload
        job = Job.find(params[:job_id])

        # SSoT: Use helper methods for credential and client
        unless sharepoint_connected?
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
          client = sharepoint_client

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

      # GET /api/v1/documents/folder_contents
      # Get contents of a specific folder by name within a job's folder
      # Supports fetching from multiple folders (e.g., "Photo" and "Client Photo")
      # Performance: Cached for 5 minutes to reduce SharePoint API calls
      # NOTE: This is SharePoint-specific (uses folder IDs and names)
      def folder_contents
        job = Job.find(params[:job_id])
        folder_names = params[:folder_names]&.split(",")&.map(&:strip) || [ params[:folder_name] ]

        # SSoT: Use helper methods for credential and client
        unless sharepoint_connected?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        # Skip cache if explicitly requested
        skip_cache = params[:refresh] == "true"
        sorted_folders = folder_names.compact.sort.join(",")
        cache_key = "sharepoint:folder_contents:#{job.id}:#{sorted_folders}"

        # Try to get from cache first (5 minute TTL)
        cached_result = Rails.cache.read(cache_key) unless skip_cache
        if cached_result
          return render json: cached_result.merge(from_cache: true)
        end

        begin
          client = sharepoint_client

          # SSoT: Use stored sharepoint_folder_id first, fall back to find_job_folder
          job_folder_id = job.storage_folder_id
          job_folder_url = nil

          if job_folder_id.present?
            # Use stored folder ID directly (faster, more reliable)
            begin
              folder_info = client.get_item(job_folder_id)
              job_folder_url = folder_info["webUrl"]
            rescue => e
              Rails.logger.warn "[SharePoint] Stored folder ID invalid for job #{job.id}: #{e.message}"
              job_folder_id = nil
            end
          end

          # Fall back to find_job_folder if no stored ID
          unless job_folder_id
            job_folder = client.find_job_folder(job)
            unless job_folder
              return render json: {
                error: "Job folder not found",
                job_folder_exists: false
              }, status: :not_found
            end
            job_folder_id = job_folder["id"]
            job_folder_url = job_folder["webUrl"]
          end

          # Get all items in the job folder
          job_items = client.list_folder_items(job_folder_id)
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

          result = {
            files: files_only,
            subfolders: subfolders,
            total_count: files_only.length,
            found_folders: found_folders,
            requested_folders: folder_names,
            job_folder_id: job_folder_id,
            job_folder_web_url: job_folder_url
          }

          # Cache for 5 minutes
          Rails.cache.write(cache_key, result, expires_in: 5.minutes)

          render json: result.merge(from_cache: false)

        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to get folder contents: #{e.message}"
          render json: { error: "Failed to get folder contents: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/documents/search
      # Search for files across the entire SharePoint/OneDrive drive
      # NOTE: This is SharePoint-specific search
      def search
        # SSoT: Use helper methods for credential and client
        unless sharepoint_connected?
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        query = params[:q] || params[:query]

        unless query.present?
          return render json: { error: "Search query is required (use ?q=searchterm)" }, status: :bad_request
        end

        begin
          client = sharepoint_client

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

      # GET /api/v1/documents/download
      # Download file from OneDrive
      # For preview=true (thumbnails): Public access with browser caching (7 days)
      # For downloads (attachment): Requires user authentication
      def download
        is_preview = params[:preview] == "true"

        # Require user auth for actual downloads, allow preview without auth
        unless is_preview || current_user
          return render json: { error: "Authentication required for downloads" }, status: :unauthorized
        end

        file_id = params[:file_id]

        unless file_id
          return render json: { error: "No file_id provided" }, status: :bad_request
        end

        begin
          # SSoT: Route by configured provider, not file_id format guessing
          # Check credentials to determine provider (no tenant context needed)
          #
          # For public downloads (preview=true, no auth), we need to set tenant context
          # since S3Compatible provider requires WarehouseProvider which is tenant-scoped.
          # Default to first tenant for public access (single-tenant system).
          unless ActsAsTenant.current_tenant
            ActsAsTenant.current_tenant = Tenant.first
          end

          # FRC (Feb 2026): Must be tenant-scoped
          if S3CompatibleCredential.for_tenant(current_tenant).active.connected.exists?
            download_from_s3_by_key(file_id, is_preview)
          elsif (MicrosoftCredential.for_tenant(current_tenant).refreshable_delegated.org_level.first ||
                 MicrosoftCredential.for_tenant(current_tenant).refreshable_app.first)&.connected?
            download_from_sharepoint_by_id(file_id, is_preview)
          else
            raise DocumentProviders::NotConnectedError, "No storage provider configured"
          end

        rescue DocumentProviders::NotFoundError => e
          render json: { error: "File not found: #{e.message}" }, status: :not_found
        rescue DocumentProviders::NotConnectedError => e
          render json: { error: "Storage not connected: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::AuthenticationError, MicrosoftAppGraphClient::NotConnectedError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError, MicrosoftAppGraphClient::ApiError => e
          render json: { error: "SharePoint API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to download file: #{e.message}"
          Rails.logger.error e.backtrace.first(5).join("\n")
          render json: { error: "Failed to download file: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/documents/presigned_url
      # Returns a presigned URL for direct download (no Rails streaming)
      # SSoT: Used by PDFViewerImpl for fast PDF loading, ImageLightbox for fast image loading
      # Why: Avoids double transfer (S3 → Rails → Browser), browser fetches directly from S3
      # Params:
      #   - file_id: Direct storage reference (S3 key or SharePoint item ID)
      #   - document_id: WarehouseDocument ID (will lookup storage_reference from the model)
      def presigned_url
        file_id = params[:file_id]
        document_id = params[:document_id]

        # Support both file_id (direct storage ID) and document_id (WarehouseDocument lookup)
        if document_id.present?
          document = WarehouseDocument.find_by(id: document_id)
          unless document
            return render json: { success: false, error: "Document not found" }, status: :not_found
          end

          # SSoT: Use storage_path from storage_blob
          file_id = document.storage_blob&.storage_path || document.storage_path
          unless file_id.present?
            return render json: { success: false, error: "Document has no storage reference" }, status: :unprocessable_entity
          end
        elsif !file_id.present?
          return render json: { success: false, error: "No file_id or document_id provided" }, status: :bad_request
        end

        begin
          # Route by file_id format, not just current provider.
          # SharePoint item IDs are alphanumeric (e.g. "01P43HWV5GJTQ6IY66V5AKLYLFE7LSUORX").
          # S3 keys have path separators or extensions (e.g. "Blobs/ab/abc123.pdf").
          if sharepoint_item_id?(file_id)
            presigned_url_for_sharepoint(file_id)
          else
            presigned_url_for_s3(file_id)
          end

        rescue DocumentProviders::NotFoundError => e
          render json: { success: false, error: "File not found: #{e.message}" }, status: :not_found
        rescue DocumentProviders::NotConnectedError => e
          render json: { success: false, error: "Storage not connected: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::AuthenticationError, MicrosoftAppGraphClient::NotConnectedError => e
          render json: { success: false, error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError, MicrosoftAppGraphClient::ApiError => e
          render json: { success: false, error: "SharePoint API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to get presigned URL: #{e.message}"
          render json: { success: false, error: "Failed to get presigned URL: #{e.message}" }, status: :internal_server_error
        end
      end

      # DELETE /api/v1/documents/delete_file
      # Delete a file from SharePoint/OneDrive
      # NOTE: This is SharePoint-specific file deletion
      def delete_file
        # SSoT: Use helper methods for credential and client
        unless sharepoint_connected?
          return render json: { success: false, error: "SharePoint not connected" }, status: :unauthorized
        end

        file_id = params[:file_id]

        unless file_id
          return render json: { success: false, error: "No file_id provided" }, status: :bad_request
        end

        begin
          client = sharepoint_client
          config = WarehouseProvider.instance

          # App credentials use different API methods than delegated
          if sharepoint_credential.credential_type == "app"
            unless config&.connected?
              return render json: { success: false, error: "SharePoint not configured" }, status: :unprocessable_entity
            end

            client.delete_drive_item(
              drive_id: config.drive_id,
              item_id: file_id
            )
          else
            client.delete_file(file_id)
          end

          # SSoT (Jan 2026): Update database to reflect deletion via WarehouseDocument
          # Find StorageBlob and delete associated WarehouseDocuments
          blob = StorageBlob.find_by(storage_path: file_id)
          deleted_count = 0
          if blob
            deleted_count = WarehouseDocument.where(storage_blob: blob).count
            WarehouseDocument.where(storage_blob: blob).destroy_all
            # Note: Don't destroy blob yet - let blob:cleanup handle orphans safely
          end

          Rails.logger.info "[DocumentStorage] Deleted file #{file_id}, removed #{deleted_count} WarehouseDocument(s)"

          render json: { success: true, message: "File deleted successfully" }

        rescue MicrosoftGraphClient::AuthenticationError, MicrosoftAppGraphClient::NotConnectedError => e
          render json: { success: false, error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError, MicrosoftAppGraphClient::ApiError => e
          render json: { success: false, error: "SharePoint API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "Failed to delete file: #{e.message}"
          render json: { success: false, error: "Failed to delete file: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/documents/download_url
      # Get a pre-authenticated download URL for a file (valid ~1 hour)
      # Used for lightbox full-size image viewing - URL works directly in <img> tags
      def download_url
        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        file_id = params[:file_id]

        unless file_id.present?
          return render json: { error: "No file_id provided" }, status: :bad_request
        end

        begin
          # Check if using app credentials (requires different API calls)
          is_app_credential = credential.is_a?(MicrosoftCredential) && credential.credential_type == "app"

          if is_app_credential
            # App credentials use MicrosoftAppGraphClient with explicit site/drive
            client = MicrosoftAppGraphClient.new(credential)
            storage_config = WarehouseProvider.instance

            unless storage_config&.connected?
              return render json: { error: "SharePoint not configured" }, status: :unprocessable_entity
            end

            # Get file metadata with download URL
            item_data = client.get_drive_item(storage_config.drive_id, file_id)
            download_url_value = item_data[:download_url]

            unless download_url_value.present?
              return render json: {
                error: "Download URL not available for this file"
              }, status: :unprocessable_entity
            end

            render json: {
              success: true,
              download_url: download_url_value,
              thumbnail_url: nil, # App credentials don't include thumbnails in get_drive_item
              large_thumbnail_url: nil,
              name: item_data[:name],
              size: item_data[:size],
              mime_type: item_data[:mime_type],
              cache_until: 30.minutes.from_now.iso8601
            }
          else
            # Delegated credentials use MicrosoftGraphClient with /me endpoints
            client = MicrosoftGraphClient.new(credential)
            # SSoT: Get drive path from WarehouseProvider (Jan 2026)
            storage_drive_id = WarehouseProvider.instance&.drive_id
            drive_path = storage_drive_id.present? ? "/drives/#{storage_drive_id}" : "/me/drive"

            # Fetch single item - this returns @microsoft.graph.downloadUrl
            item = client.get("#{drive_path}/items/#{file_id}")

            download_url_value = item["@microsoft.graph.downloadUrl"]

            unless download_url_value.present?
              return render json: {
                error: "Download URL not available for this file"
              }, status: :unprocessable_entity
            end

            # Also return thumbnail URLs for caching
            thumbnails = item.dig("thumbnails", 0) || {}

            render json: {
              success: true,
              download_url: download_url_value,
              thumbnail_url: thumbnails.dig("medium", "url"),
              large_thumbnail_url: thumbnails.dig("large", "url"),
              name: item["name"],
              size: item["size"],
              mime_type: item.dig("file", "mimeType"),
              # URL valid for ~1 hour, suggest caching for 30 mins
              cache_until: 30.minutes.from_now.iso8601
            }
          end

        rescue MicrosoftGraphClient::AuthenticationError, MicrosoftAppGraphClient::NotConnectedError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError, MicrosoftAppGraphClient::ApiError => e
          render json: { error: "SharePoint API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "[DownloadURL] Failed to get download URL: #{e.message}"
          render json: { error: "Failed to get download URL: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/documents/preview_private_folders
      # Preview the folder structure that would be created in 00 TEEEM PRIVATE
      def preview_private_folders
        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
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

      # POST /api/v1/documents/copy_files
      # Copy files from selected records to a SharePoint/OneDrive folder
      # Params:
      #   - foundation_id: The foundation/table name to get records from
      #   - record_ids: Array of record IDs to copy files from
      #   - folder_id: Target folder ID in OneDrive (or null for root)
      #   - new_folder_name: Optional - create a new folder with this name
      def copy_files
        # SSoT: Use helper methods for credential and client
        unless sharepoint_connected?
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
          client = sharepoint_client
          # SSoT: Get storage config for drive_id/root_folder_id (Jan 2026)
          storage_config = WarehouseProvider.instance
          storage_root_folder_id = storage_config&.root_folder_id
          storage_drive_id = storage_config&.drive_id

          # Create new folder if requested
          if new_folder_name.present?
            parent_id = folder_id || storage_root_folder_id
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
          target_folder_id = folder_id || storage_root_folder_id

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
                    "/drives/#{storage_drive_id}/items/#{target_folder_id}:/#{filename}:/content",
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

      # POST /api/v1/documents/create_private_folders
      # Create the folder structure in 00 TEEEM PRIVATE for all company groups
      def create_private_folders
        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
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

      # POST /api/v1/documents/sync_corporate_documents
      # Sync corporate documents from OneDrive to company records
      def sync_corporate_documents
        credential = MicrosoftCredential.sharepoint_credential

        Rails.logger.info "[OneDrive Corporate Sync] Starting corporate document sync"

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
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

      # GET /api/v1/documents/job_all_files
      # List ALL files from the job's OneDrive folder
      # Uses Data Warehouse pattern: reads from WarehouseDocument for instant results
      #
      # Params:
      #   refresh_thumbnails: "true" - Fetch fresh thumbnail URLs from SharePoint (cached ones expire)
      #   folder: Filter by specific folder path
      #   include_descendants: When true, includes documents from all subfolders (cascade view)
      def job_all_files
        job = Job.find(params[:job_id])

        # SSoT (Feb 2026): WarehouseDocument is THE ONE source for job files.
        # SSoT: WarehouseDocument is THE ONE source for job files.
        warehouse_docs = WarehouseDocument.for_job(job).includes(:storage_blob)

        # Filter by folder with optional cascade
        if params[:folder].present?
          if params[:include_descendants] == "true"
            folder_path = params[:folder]
            warehouse_docs = warehouse_docs.where("folder_path = ? OR folder_path LIKE ?", folder_path, "#{folder_path}/%")
          else
            warehouse_docs = warehouse_docs.where(folder_path: params[:folder])
          end
        end

        files = warehouse_docs.map do |doc|
          {
            id: doc.storage_blob&.storage_path || "wd-#{doc.id}",
            document_id: doc.id,
            name: doc.ui_name || doc.original_filename || "Unknown",
            original_name: doc.original_filename,
            size: doc.file_size,
            web_url: nil,
            storage_provider: WarehouseProvider.instance&.provider_type,
            storage_path: doc.storage_blob&.storage_path,
            download_url: "#{request.base_url}/api/v1/documents/job_document_download?document_id=#{doc.id}",
            modified: doc.created_at&.iso8601,
            type: "file",
            folder_path: doc.folder_path || "",
            content_type: doc.content_type,
            from_cache: true
          }
        end

        files.sort_by! { |f| [f[:folder_path].to_s.downcase, f[:name].to_s.downcase] }

        render json: {
          success: true,
          job_id: job.id,
          job_title: job.title,
          items: files,
          count: files.length,
          from_cache: true
        }
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

      # POST /api/v1/documents/upload_signed_version
      # Upload a signed version of an existing draft document
      # SSoT (Jan 2026): Uses WarehouseDocument with version metadata
      # Params:
      #   - parent_document_id: ID of the draft WarehouseDocument
      #   - file: The signed file to upload
      #   - folder_path: Optional subfolder path within the job folder
      def upload_signed_version
        parent_doc = WarehouseDocument.find(params[:parent_document_id])
        job = parent_doc.linkable if parent_doc.linkable_type == "Job"

        unless job
          return render json: { success: false, error: "Document not linked to a job" }, status: :unprocessable_entity
        end

        # Validate the document supports versioning (check metadata)
        doc_type_id = parent_doc.meta("document_type_id")
        doc_type = DocumentType.find_by(id: doc_type_id) if doc_type_id
        unless doc_type&.supports_versioning
          return render json: {
            success: false,
            error: "This document type does not support Draft/Signed versioning"
          }, status: :unprocessable_entity
        end

        # Validate the parent is a draft
        unless parent_doc.meta("version_status") == "draft"
          return render json: {
            success: false,
            error: "Only draft documents can have signed versions uploaded"
          }, status: :unprocessable_entity
        end

        credential = get_onedrive_credential
        unless credential
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        begin
          file = params[:file]
          unless file
            return render json: { error: "No file provided" }, status: :bad_request
          end

          client = MicrosoftGraphClient.new(credential)

          # Find the job folder
          job_folder = client.find_job_folder(job)
          unless job_folder
            return render json: {
              success: false,
              error: "Job folder not found in SharePoint"
            }, status: :not_found
          end

          # Determine upload folder (same as parent document)
          folder_path = parent_doc.folder_path || ""

          # Generate filename with "Signed" suffix
          original_name = File.basename(file.original_filename, ".*")
          extension = File.extname(file.original_filename)
          signed_filename = "#{original_name} - Signed#{extension}"

          # Upload to SharePoint
          target_folder_id = job_folder["id"]
          if folder_path.present?
            subfolder = client.find_or_create_subfolder(target_folder_id, folder_path)
            target_folder_id = subfolder["id"] if subfolder
          end

          uploaded_file = client.upload_file(
            folder_id: target_folder_id,
            file_name: signed_filename,
            content: file.read,
            content_type: file.content_type
          )

          # Create StorageBlob for the uploaded file
          blob = StorageBlob.create!(
            storage_path: uploaded_file["id"],
            filename: signed_filename,
            content_type: file.content_type,
            byte_size: uploaded_file["size"]
          )

          # SSoT: WarehouseDocumentCreator handles metadata + callbacks
          version_number = (parent_doc.meta("version_number") || 1).to_i + 1
          signed_version = WarehouseDocumentCreator.create!(
            filename: signed_filename,
            source_type: parent_doc.source_type,
            linkable: job,
            storage_blob: blob,
            parent_document: parent_doc,
            user: current_user,
            metadata: {
              "document_type_id" => doc_type_id,
              "document_type" => doc_type&.name,
              "version_status" => "signed",
              "version_number" => version_number,
              "signed_at" => Time.current.iso8601,
              "storage_provider" => "sharepoint"
            }
          )

          # Update parent to reflect it has a signed version
          parent_doc.update!(
            metadata: parent_doc.metadata.merge(
              "version_status" => "superseded",
              "signed_version_id" => signed_version.id
            )
          )

          render json: {
            success: true,
            message: "Signed version uploaded successfully",
            signed_document: {
              id: signed_version.id,
              file_name: signed_filename,
              version_status: "signed",
              version_number: version_number,
              signed_at: signed_version.meta("signed_at"),
              signed_by_name: signed_version.meta("signed_by_name"),
              web_url: uploaded_file["webUrl"]
            },
            parent_document: {
              id: parent_doc.id,
              version_status: "superseded"
            }
          }

        rescue ArgumentError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        rescue MicrosoftGraphClient::AuthenticationError => e
          render json: { error: "Authentication failed: #{e.message}" }, status: :unauthorized
        rescue MicrosoftGraphClient::APIError => e
          render json: { error: "OneDrive API error: #{e.message}" }, status: :bad_gateway
        rescue StandardError => e
          Rails.logger.error "[Upload Signed Version] Exception: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: { error: "Failed to upload signed version: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/documents/legacy_files
      # List files from the legacy "Old House Data/00 Active" folder that match a job
      # Used for importing legacy job documents into the new job folder structure
      # POST /api/v1/documents/bulk_categorize_job_documents
      # Bulk categorize documents for a job based on folder paths matching WarehouseFolders
      # Used for client onboarding to automatically assign document types
      # Params:
      #   - job_id: Required - Job ID to categorize
      #   - dry_run: Optional (default: false) - If true, preview only without saving
      #   - force: Optional (default: false) - If true, re-categorize ALL docs (fix wrong assignments)
      # Returns:
      #   - success, stats (total, categorized, skipped, failed, recategorized), details
      def bulk_categorize_job_documents
        job_id = params[:job_id]
        dry_run = params[:dry_run].to_s == 'true'
        force = params[:force].to_s == 'true'

        unless job_id.present?
          return render json: { error: "job_id is required" }, status: :bad_request
        end

        job = Job.find(job_id)

        service = BulkDocumentCategorizationService.new(job, dry_run: dry_run, force: force, user: current_user)
        result = service.categorize_all

        render json: {
          success: true,
          job_id: job.id,
          job_title: job.title,
          dry_run: result[:dry_run],
          stats: result[:stats],
          details: result[:details].first(100),  # Limit for response size
          full_details_count: result[:details].size
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Job not found" }, status: :not_found
      rescue => e
        Rails.logger.error("[BulkCategorize] Error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # GET /api/v1/documents/documents_needing_review
      # List documents with AI suggestions pending review
      # Params:
      #   - job_id: Optional - filter by job
      #   - status: 'pending' (default), 'approved', 'rejected', 'all'
      #   - min_confidence: Optional - only show docs above this confidence (0-100)
      # SSoT: Uses WarehouseDocument
      def documents_needing_review
        scope = WarehouseDocument.where(source_type: "job")
                                 .includes(:storage_blob, :linkable)
                                 .where("metadata->>'ai_analyzed_at' IS NOT NULL")

        # Filter by job if specified
        if params[:job_id].present?
          scope = scope.where(linkable_type: "Job", linkable_id: params[:job_id])
        end

        # Filter by rename status
        status = params[:status] || "pending"
        unless status == "all"
          scope = scope.where("metadata->>'rename_status' = ?", status)
        end

        # Filter by minimum confidence
        if params[:min_confidence].present?
          min_conf = params[:min_confidence].to_i
          scope = scope.where("(metadata->>'ai_confidence')::int >= ?", min_conf)
        end

        # Order by confidence descending (highest confidence first)
        documents = scope.order(Arel.sql("(metadata->>'ai_confidence')::int DESC NULLS LAST, metadata->>'ai_analyzed_at' DESC")).limit(100)

        render json: {
          success: true,
          documents: documents.map { |doc| format_warehouse_document_for_review(doc) },
          count: documents.length,
          filters: {
            job_id: params[:job_id],
            status: status,
            min_confidence: params[:min_confidence]
          }
        }
      end

      # POST /api/v1/documents/approve_document_rename
      # Approve or reject AI rename suggestion for a document
      # Params:
      #   - document_id: WarehouseDocument ID
      #   - action: 'approve' or 'reject'
      #   - custom_name: Optional - use this name instead of AI suggestion
      #   - custom_type_id: Optional - use this document type instead of AI suggestion
      # SSoT: Uses WarehouseDocument
      def approve_document_rename
        document = WarehouseDocument.find(params[:document_id])
        action = params[:action]

        unless %w[approve reject].include?(action)
          return render json: { error: "action must be 'approve' or 'reject'" }, status: :bad_request
        end

        if action == "reject"
          document.update!(
            metadata: (document.metadata || {}).merge(
              "rename_status" => "rejected",
              "rename_approved_at" => Time.current.iso8601,
              "rename_approved_by_id" => current_user&.id
            )
          )

          return render json: {
            success: true,
            message: "Rename suggestion rejected",
            document_id: document.id,
            status: "rejected"
          }
        end

        # Action is 'approve' - perform the rename in OneDrive
        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        # Determine the new name
        new_name = params[:custom_name].presence || document.meta("ai_proposed_name")

        unless new_name.present?
          return render json: { error: "No proposed name available" }, status: :bad_request
        end

        # Determine the document type
        new_type_id = params[:custom_type_id].presence || document.meta("ai_suggested_type_id")

        begin
          client = MicrosoftGraphClient.new(credential)
          # SSoT: Get drive_id from WarehouseProvider (Jan 2026)
          storage_drive_id = WarehouseProvider.instance&.drive_id

          # Rename the file in SharePoint (SSoT: use storage_reference from blob)
          storage_ref = document.storage_blob&.storage_path
          result = client.patch(
            "/drives/#{storage_drive_id}/items/#{storage_ref}",
            { name: new_name }
          )

          # Update the document record
          old_name = document.original_filename || document.ui_name
          document.update!(
            ui_name: new_name,
            original_filename: new_name,
            metadata: (document.metadata || {}).merge(
              "document_type_id" => new_type_id,
              "rename_status" => "completed",
              "rename_approved_at" => Time.current.iso8601,
              "rename_approved_by_id" => current_user&.id,
              "web_url" => result["webUrl"]
            )
          )

          render json: {
            success: true,
            message: "Document renamed successfully",
            document_id: document.id,
            old_name: old_name,
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

      # POST /api/v1/documents/bulk_approve_renames
      # Bulk approve multiple document renames
      # Params:
      #   - document_ids: Array of WarehouseDocument IDs to approve
      # SSoT: Uses WarehouseDocument
      def bulk_approve_renames
        document_ids = params[:document_ids] || []

        if document_ids.empty?
          return render json: { error: "No document IDs provided" }, status: :bad_request
        end

        credential = MicrosoftCredential.sharepoint_credential

        # Use valid_access_token which auto-refreshes expired tokens
        unless credential&.valid_access_token
          return render json: { error: "SharePoint not connected" }, status: :unauthorized
        end

        documents = WarehouseDocument.where(id: document_ids)
                                     .where("metadata->>'rename_status' = ?", "pending")
                                     .where("metadata->>'ai_proposed_name' IS NOT NULL")
                                     .includes(:storage_blob)

        results = { approved: 0, failed: 0, errors: [] }

        client = MicrosoftGraphClient.new(credential)
        # SSoT: Get drive_id from WarehouseProvider (Jan 2026)
        storage_drive_id = WarehouseProvider.instance&.drive_id

        documents.each do |doc|
          begin
            ai_proposed_name = doc.meta("ai_proposed_name")
            storage_ref = doc.storage_blob&.storage_path

            # Rename in SharePoint (SSoT: use storage_reference from blob)
            result = client.patch(
              "/drives/#{storage_drive_id}/items/#{storage_ref}",
              { name: ai_proposed_name }
            )

            # Update document record
            doc.update!(
              display_name: ai_proposed_name,
              original_filename: ai_proposed_name,
              metadata: (doc.metadata || {}).merge(
                "document_type_id" => doc.meta("ai_suggested_type_id"),
                "rename_status" => "completed",
                "rename_approved_at" => Time.current.iso8601,
                "rename_approved_by_id" => current_user&.id,
                "web_url" => result["webUrl"]
              )
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

      # GET /api/v1/documents/job_document_download
      # Unified download endpoint for job documents - routes to correct provider
      #
      # This is THE SSoT for job document downloads. It checks the document's
      # storage_provider field and downloads from the appropriate source:
      # - 's3_compatible': Downloads from Wasabi/S3
      # - 'sharepoint' or nil: Downloads from SharePoint
      #
      # Params:
      #   document_id: WarehouseDocument ID (required)
      #   preview: "true" for inline display, omit for attachment download
      # SSoT: Uses WarehouseDocument
      def job_document_download
        document_id = params[:document_id]
        is_preview = params[:preview] == "true"

        unless document_id.present?
          return render json: { error: "document_id is required" }, status: :bad_request
        end

        # FRC (Feb 2026): This endpoint skips auth (skip_before_action :authorize_request)
        # so <img src> previews work without JWT. Since current_tenant is nil when auth is
        # skipped, use without_tenant to find the document, then set the tenant from it
        # for all subsequent tenant-scoped operations (WarehouseProvider, DocumentProviders).
        document = ActsAsTenant.without_tenant { WarehouseDocument.find_by(id: document_id) }

        unless document
          return render json: { error: "Document not found" }, status: :not_found
        end

        # Set tenant from document for all downstream operations
        if ActsAsTenant.current_tenant.nil? && document.tenant_id.present?
          ActsAsTenant.current_tenant = Tenant.find_by(id: document.tenant_id)
        end

        blob = document.storage_blob
        unless blob&.storage_path.present?
          return render json: { error: "Document has no storage reference" }, status: :unprocessable_entity
        end

        begin
          # SSoT: Only serve documents from current storage provider (no fallback)
          storage_config = WarehouseProvider.instance
          # FRC (Feb 2026): Use actual configured provider, no hardcoded defaults
          doc_provider = document.meta("storage_provider") || storage_config.provider_type

          unless doc_provider
            return render json: {
              error: "Storage provider not configured",
              reason: "Document has no storage_provider and no provider is configured"
            }, status: :service_unavailable
          end

          unless storage_config.document_in_current_provider?(doc_provider)
            return render json: {
              error: "Document not available",
              reason: "Document is in #{doc_provider} but current provider is #{storage_config.provider_type}"
            }, status: :gone
          end

          # Route to correct provider based on document's storage_provider
          case doc_provider
          when "s3_compatible", "wasabi", "s3"
            download_from_s3_warehouse(document, is_preview)
          when "sharepoint"
            download_from_sharepoint_warehouse(document, is_preview)
          else
            render json: { error: "Unknown storage provider: #{doc_provider}" }, status: :bad_request
          end

        rescue DocumentProviders::NotFoundError => e
          render json: { error: "File not found in storage: #{e.message}" }, status: :not_found
        rescue DocumentProviders::NotConnectedError => e
          render json: { error: "Storage provider not connected: #{e.message}" }, status: :service_unavailable
        rescue StandardError => e
          Rails.logger.error "[WarehouseDocumentDownload] Error downloading document #{document_id}: #{e.message}"
          Rails.logger.error e.backtrace.first(5).join("\n")
          render json: { error: "Failed to download: #{e.message}" }, status: :internal_server_error
        end
      end

      # GET /api/v1/documents/job_document_url
      # Get a pre-signed URL for direct browser access to a document
      #
      # Returns a URL that can be used directly in browser for 1 hour.
      # Useful for opening PDFs in new tabs, image previews, etc.
      #
      # Params:
      #   document_id: WarehouseDocument ID (required)
      # SSoT: Uses WarehouseDocument
      def job_document_url
        document_id = params[:document_id]

        unless document_id.present?
          return render json: { success: false, error: "document_id is required" }, status: :bad_request
        end

        document = WarehouseDocument.find_by(id: document_id)

        unless document
          return render json: { success: false, error: "Document not found" }, status: :not_found
        end

        blob = document.storage_blob
        unless blob&.storage_path.present?
          return render json: { success: false, error: "Document has no storage reference" }, status: :unprocessable_entity
        end

        begin
          # SSoT: Only serve documents from current storage provider (no fallback)
          storage_config = WarehouseProvider.instance
          # FRC (Feb 2026): Use actual configured provider, no hardcoded defaults
          doc_provider = document.meta("storage_provider") || storage_config.provider_type

          unless doc_provider
            return render json: {
              error: "Storage provider not configured",
              reason: "Document has no storage_provider and no provider is configured"
            }, status: :service_unavailable
          end

          unless storage_config.document_in_current_provider?(doc_provider)
            return render json: {
              success: false,
              error: "Document not available",
              reason: "Document is in #{doc_provider} but current provider is #{storage_config.provider_type}"
            }, status: :gone
          end

          # Route to correct provider based on document's storage_provider
          case doc_provider
          when "s3_compatible", "wasabi", "s3"
            url = get_s3_presigned_url_warehouse(document)
          when "sharepoint"
            url = get_sharepoint_download_url_warehouse(document)
          else
            return render json: { success: false, error: "Unknown storage provider: #{doc_provider}" }, status: :bad_request
          end

          filename = document.original_filename || document.ui_name
          render json: {
            success: true,
            download_url: url,
            storage_provider: doc_provider,
            file_name: filename,
            mime_type: document.content_type || blob&.content_type,
            expires_in: 3600
          }

        rescue DocumentProviders::NotFoundError => e
          render json: { success: false, error: "File not found in storage" }, status: :not_found
        rescue DocumentProviders::NotConnectedError => e
          render json: { success: false, error: "Storage provider not connected" }, status: :service_unavailable
        rescue StandardError => e
          Rails.logger.error "[WarehouseDocumentUrl] Error getting URL for document #{document_id}: #{e.message}"
          render json: { success: false, error: "Failed to get download URL" }, status: :internal_server_error
        end
      end

      private

      # Build job folder path using SSoT pattern from WarehouseProvider
      # SSoT: Uses job_code ("J" + id), e.g., "J201"
      def build_job_folder_path(job)
        # SSoT: Use WarehouseProvider.job_path for consistent folder naming
        storage_config&.job_path(job.job_code) || "/Jobs/#{job.job_code}"
      end

      def sanitize_folder_name(name)
        name.to_s.gsub(/[<>:"|?*\\]/, "_").strip
      end

      # Detect MIME type from filename extension
      def detect_mime_type(filename)
        ext = File.extname(filename).downcase
        case ext
        when ".jpg", ".jpeg" then "image/jpeg"
        when ".png" then "image/png"
        when ".gif" then "image/gif"
        when ".webp" then "image/webp"
        when ".heic" then "image/heic"
        when ".pdf" then "application/pdf"
        when ".doc" then "application/msword"
        when ".docx" then "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        when ".xls" then "application/vnd.ms-excel"
        when ".xlsx" then "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        when ".txt" then "text/plain"
        else "application/octet-stream"
        end
      end

      # Detect SharePoint Graph API item IDs by format (no API call).
      # SharePoint IDs: alphanumeric + !, no slashes or dots
      # S3 keys: contain path separators / or file extensions .
      # Matches DocumentProviders::SharePoint#looks_like_id?
      def sharepoint_item_id?(file_id)
        file_id.present? && !file_id.include?("/") && file_id.match?(/\A[A-Za-z0-9!_-]+\z/)
      end

      # SSoT: Used by presigned_url action for PDF performance optimization
      def presigned_url_for_s3(s3_key)
        # FRC (Feb 2026): Must be tenant-scoped
        credential = S3CompatibleCredential.for_tenant(current_tenant).active.connected.first

        unless credential
          raise DocumentProviders::NotConnectedError, "S3 storage not configured"
        end

        provider = DocumentProviders::S3Compatible.new(credential)
        url = provider.download_url(s3_key, expires_in: 900)  # 15 minutes

        render json: {
          success: true,
          url: url,
          expires_in: 900
        }
      end

      # Generate presigned URL for SharePoint files
      # SSoT: Uses SharePoint's @microsoft.graph.downloadUrl for direct browser access
      def presigned_url_for_sharepoint(file_id)
        # SSoT: Use helper methods for credential and client
        unless sharepoint_connected?
          raise DocumentProviders::NotConnectedError, "SharePoint not connected"
        end

        client = sharepoint_client
        config = WarehouseProvider.instance

        unless config&.connected?
          raise DocumentProviders::NotConnectedError, "SharePoint not configured"
        end

        # Get file metadata with download URL
        # App credentials use different API method than delegated
        if sharepoint_credential.credential_type == "app"
          item_data = client.get_drive_item(config.drive_id, file_id)
          download_url_value = item_data[:download_url]
        else
          drive_path = config.drive_id.present? ? "/drives/#{config.drive_id}" : "/me/drive"
          file_info = client.get("#{drive_path}/items/#{file_id}?$select=id,name,@microsoft.graph.downloadUrl")
          download_url_value = file_info["@microsoft.graph.downloadUrl"]
        end

        unless download_url_value.present?
          raise DocumentProviders::NotFoundError, "Download URL not available for this file"
        end

        render json: {
          success: true,
          url: download_url_value,
          expires_in: 1800  # SharePoint URLs typically valid ~30 min
        }
      end

      # List all files recursively from provider (Wasabi/S3)
      # Returns array of hashes matching the format from SharePoint listing
      def list_job_files_from_provider(job_folder_path)
        files = []
        list_folder_recursive(job_folder_path, files, "")
        files
      end

      def list_folder_recursive(folder_path, files, relative_path)
        items = list_folder_in_provider(folder_path, recursive: false) rescue []

        items.each do |item|
          item_path = relative_path.present? ? "#{relative_path}/#{item[:name]}" : item[:name]

          # Check for folder type (S3 returns symbol :folder, SharePoint returns string "folder")
          if item[:type].to_s == "folder"
            # Recursively list subfolder
            list_folder_recursive("#{folder_path}/#{item[:name]}", files, item_path)
          else
            # Add file with consistent format
            files << {
              id: item[:id],
              name: item[:name],
              size: item[:size],
              web_url: item[:web_url],
              download_url: item[:download_url],
              modified: item[:modified],
              type: "file",
              folder_path: relative_path,
              thumbnail_url: nil,
              storage_provider: current_provider_type.to_s
            }
          end
        end
      end

      # Download file from S3 by key (for photo gallery and direct file access)
      # SSoT: Uses S3 key directly for file access
      def download_from_s3_by_key(s3_key, is_preview)
        # FRC (Feb 2026): Must be tenant-scoped
        credential = S3CompatibleCredential.for_tenant(current_tenant).active.connected.first

        unless credential
          raise DocumentProviders::NotConnectedError, "S3 storage not configured"
        end

        provider = DocumentProviders::S3Compatible.new(credential)

        # Download file content
        content = provider.download_file(s3_key)
        filename = File.basename(s3_key)
        mime_type = detect_mime_type(filename)

        # Enable browser caching for previews
        if is_preview
          etag = Digest::MD5.hexdigest(s3_key)

          if request.headers["If-None-Match"] == "\"#{etag}\""
            return head :not_modified
          end

          response.headers["Cache-Control"] = "public, max-age=604800"  # 7 days
          response.headers["ETag"] = "\"#{etag}\""
        end

        disposition = is_preview ? "inline" : "attachment"
        send_data content,
          filename: filename,
          type: mime_type,
          disposition: disposition
      end

      # Download file from SharePoint by item ID (for photo gallery)
      # SSoT: Uses helper methods for credential and client
      def download_from_sharepoint_by_id(file_id, is_preview)
        unless sharepoint_connected?
          raise DocumentProviders::NotConnectedError, "SharePoint not connected"
        end

        client = sharepoint_client
        config = WarehouseProvider.instance

        # Get file metadata and content
        # App credentials use different API methods than delegated
        if sharepoint_credential.credential_type == "app"
          unless config&.connected?
            raise DocumentProviders::NotConnectedError, "SharePoint not configured"
          end

          file_metadata = client.get_drive_item(config.drive_id, file_id)
          file_content = client.get_drive_item_content(
            drive_id: config.drive_id,
            item_id: file_id
          )
        else
          file_metadata = client.get_file(file_id)
          file_content = client.download_file(file_id)
        end

        disposition = is_preview ? "inline" : "attachment"
        mime_type = file_metadata["file"]&.dig("mimeType") || "application/octet-stream"

        # Enable browser caching for previews
        if is_preview
          last_modified = file_metadata["lastModifiedDateTime"] || Time.current.iso8601
          etag = Digest::MD5.hexdigest("#{file_id}-#{last_modified}")

          if request.headers["If-None-Match"] == "\"#{etag}\""
            return head :not_modified
          end

          response.headers["Cache-Control"] = "public, max-age=604800"  # 7 days
          response.headers["ETag"] = "\"#{etag}\""
          response.headers["Last-Modified"] = Time.parse(last_modified).httpdate rescue Time.current.httpdate
        end

        send_data file_content,
          filename: file_metadata["name"],
          type: mime_type,
          disposition: disposition
      end

      # Download document content from S3
      def download_from_s3(document, is_preview)
        # SSoT (Jan 2026): Use tenant for storage provider
        provider = DocumentProviders.for_tenant(current_tenant)

        unless provider
          raise DocumentProviders::NotConnectedError, "S3 storage not configured"
        end
        storage_ref = document.storage_reference

        unless storage_ref.present?
          raise DocumentProviders::NotFoundError, "No storage reference for document"
        end

        # Download file content
        content = provider.download_file(storage_ref)

        # Send to browser
        disposition = is_preview ? "inline" : "attachment"
        send_data content,
          filename: document.file_name,
          type: document.mime_type || "application/octet-stream",
          disposition: disposition
      end

      # Download document content from SharePoint
      # SSoT: Uses helper methods for credential and client
      def download_from_sharepoint(document, is_preview)
        unless sharepoint_connected?
          raise DocumentProviders::NotConnectedError, "SharePoint not connected"
        end

        file_id = document.storage_reference

        unless file_id.present?
          raise DocumentProviders::NotFoundError, "No SharePoint file ID for document"
        end

        client = sharepoint_client
        config = WarehouseProvider.instance

        # Get file metadata and content
        # App credentials use different API methods than delegated
        if sharepoint_credential.credential_type == "app"
          unless config&.connected?
            raise DocumentProviders::NotConnectedError, "SharePoint not configured"
          end

          file_metadata = client.get_drive_item(config.drive_id, file_id)
          file_content = client.get_drive_item_content(
            drive_id: config.drive_id,
            item_id: file_id
          )
        else
          file_metadata = client.get_file(file_id)
          file_content = client.download_file(file_id)
        end

        disposition = is_preview ? "inline" : "attachment"
        mime_type = file_metadata["file"]&.dig("mimeType") || document.mime_type || "application/octet-stream"

        send_data file_content,
          filename: document.file_name,
          type: mime_type,
          disposition: disposition
      end

      # Download WarehouseDocument content from S3 via storage_blob
      # SSoT: Uses storage_blob.storage_path as the S3 key
      def download_from_s3_warehouse(document, is_preview)
        provider = DocumentProviders.for_tenant(ActsAsTenant.current_tenant)

        unless provider
          raise DocumentProviders::NotConnectedError, "S3 storage not configured"
        end

        storage_path = document.storage_blob&.storage_path

        unless storage_path.present?
          raise DocumentProviders::NotFoundError, "No storage path for warehouse document"
        end

        # For previews, use ETag caching to avoid re-downloading unchanged files
        if is_preview && request.headers["If-None-Match"].present?
          etag = Digest::MD5.hexdigest("#{document.id}-#{document.updated_at}")
          if request.headers["If-None-Match"] == %("#{etag}")
            head :not_modified
            return
          end
        end

        content = provider.download_file(storage_path)

        disposition = is_preview ? "inline" : "attachment"
        mime_type = document.content_type || document.storage_blob&.content_type || "application/octet-stream"

        headers["ETag"] = %("#{Digest::MD5.hexdigest("#{document.id}-#{document.updated_at}")}") if is_preview

        send_data content,
          filename: document.download_filename,
          type: mime_type,
          disposition: disposition
      end

      # Download WarehouseDocument content from SharePoint via metadata
      # SSoT: Uses metadata["sharepoint_item_id"] as the file ID
      def download_from_sharepoint_warehouse(document, is_preview)
        unless sharepoint_connected?
          raise DocumentProviders::NotConnectedError, "SharePoint not connected"
        end

        file_id = document.meta("sharepoint_item_id") || document.storage_blob&.storage_path

        unless file_id.present?
          raise DocumentProviders::NotFoundError, "No SharePoint file ID for warehouse document"
        end

        client = sharepoint_client
        config = WarehouseProvider.instance

        # For previews, use ETag caching
        if is_preview && request.headers["If-None-Match"].present?
          etag = Digest::MD5.hexdigest("#{document.id}-#{document.updated_at}")
          if request.headers["If-None-Match"] == %("#{etag}")
            head :not_modified
            return
          end
        end

        if sharepoint_credential.credential_type == "app"
          unless config&.connected?
            raise DocumentProviders::NotConnectedError, "SharePoint not configured"
          end

          file_content = client.get_drive_item_content(
            drive_id: config.drive_id,
            item_id: file_id
          )
        else
          file_content = client.download_file(file_id)
        end

        disposition = is_preview ? "inline" : "attachment"
        mime_type = document.content_type || document.storage_blob&.content_type || "application/octet-stream"

        headers["ETag"] = %("#{Digest::MD5.hexdigest("#{document.id}-#{document.updated_at}")}") if is_preview

        send_data file_content,
          filename: document.download_filename,
          type: mime_type,
          disposition: disposition
      end

      # Get S3 pre-signed URL for direct browser access
      def get_s3_presigned_url(document)
        # FRC (Feb 2026): Must be tenant-scoped
        credential = S3CompatibleCredential.for_tenant(current_tenant).active.connected.first

        unless credential
          raise DocumentProviders::NotConnectedError, "S3 storage not configured"
        end

        provider = DocumentProviders::S3Compatible.new(credential)
        storage_ref = document.storage_reference

        unless storage_ref.present?
          raise DocumentProviders::NotFoundError, "No storage reference for document"
        end

        provider.download_url(storage_ref, expires_in: 3600)
      end

      # Get SharePoint download URL for a document
      # SSoT: Uses helper methods for credential and client
      def get_sharepoint_download_url(document)
        unless sharepoint_connected?
          raise DocumentProviders::NotConnectedError, "SharePoint not connected"
        end

        file_id = document.storage_reference

        unless file_id.present?
          raise DocumentProviders::NotFoundError, "No SharePoint file ID for document"
        end

        client = sharepoint_client
        config = WarehouseProvider.instance

        # Get download URL
        # App credentials use different API methods than delegated
        if sharepoint_credential.credential_type == "app"
          unless config&.connected?
            raise DocumentProviders::NotConnectedError, "SharePoint not configured"
          end

          item_data = client.get_drive_item(config.drive_id, file_id)
          item_data[:download_url] || document.web_url
        else
          file_data = client.get_file(file_id)
          file_data["@microsoft.graph.downloadUrl"] || document.web_url
        end
      end

      # Change root folder by folder_id (for folder browser selection)
      def change_root_folder_by_id(credential, folder_id)
        client = MicrosoftGraphClient.new(credential)

        # SSoT: Get drive path from WarehouseProvider (Jan 2026)
        storage_drive_id = WarehouseProvider.instance&.drive_id
        drive_path = storage_drive_id.present? ? "/drives/#{storage_drive_id}" : "/me/drive"

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

        # SSoT: Update WarehouseProvider with root folder info (not credential)
        storage_config = WarehouseProvider.instance
        if storage_config
          storage_config.root_folder_id = folder_response["id"]
          storage_config.root_folder_path = full_path
          storage_config.save!
        end

        # Store metadata in credential (non-config data like URLs, timestamps)
        credential.update!(
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

      # ============================================================================
      # PROVIDER SETUP (SSoT: Uses DocumentProviderAware)
      # ============================================================================

      # Initialize the document provider for this request
      # Uses DocumentProviderAware concern to get the correct provider
      def setup_storage_provider
        setup_default_provider!
      rescue DocumentProviders::NotConnectedError => e
        # Don't fail the action - some actions can work without a provider
        Rails.logger.warn "[DocumentStorage] Provider not configured: #{e.message}"
        @document_provider = nil
      rescue ActiveRecord::Encryption::Errors::Decryption => e
        Rails.logger.warn "[DocumentStorage] Credential decryption error: #{e.message}"
        @document_provider = nil
      end

      # Get SharePoint credential (SSoT: consolidates credential fetching)
      # @return [MicrosoftCredential, nil] The SharePoint credential or nil
      def sharepoint_credential
        @sharepoint_credential ||= begin
          cred = MicrosoftCredential.sharepoint_credential
          # Verify decryption works by accessing encrypted field
          cred&.access_token if cred
          cred
        rescue ActiveRecord::Encryption::Errors::Decryption => e
          Rails.logger.warn "[DocumentStorage] SharePoint credential decryption error: #{e.message}"
          nil
        end
      end

      # Get SharePoint client for the current credential
      # Uses app or delegated client based on credential type
      # @return [MicrosoftAppGraphClient, MicrosoftGraphClient, nil]
      def sharepoint_client
        return nil unless sharepoint_credential&.valid_access_token

        @sharepoint_client ||= if sharepoint_credential.credential_type == "app"
          MicrosoftAppGraphClient.new(sharepoint_credential)
        else
          MicrosoftGraphClient.new(sharepoint_credential)
        end
      end

      # Check if SharePoint is connected and available
      def sharepoint_connected?
        sharepoint_credential&.valid_access_token.present?
      end

      # Get the best available credential for OneDrive operations
      # Prioritizes organization credential, falls back to user's Microsoft token
      # Handles decryption errors gracefully (e.g., when credentials were encrypted with different keys)
      def get_onedrive_credential
        # First try organization-wide credential
        credential = begin
          cred = MicrosoftCredential.sharepoint_credential
          # Try to access an encrypted field to verify decryption works
          # Use valid_access_token which auto-refreshes expired tokens
          if cred
            cred.access_token
            cred if cred.valid_access_token
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
      # SSoT: All documents use WarehouseDocument
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
          WarehouseDocument
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
              SmTask SmScheduleMasterTemplate Foundation Record WarehouseDocument
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

      # Refresh thumbnail URLs for cached documents
      # SharePoint thumbnails expire after ~24-48 hours, so we need to fetch fresh ones
      # Returns hash: { sharepoint_item_id => thumbnail_url }
      def refresh_thumbnails_for_docs(docs)
        return {} if docs.empty?

        credential = get_onedrive_credential
        return {} unless credential

        begin
          client = MicrosoftGraphClient.new(credential)
          fresh_thumbnails = {}

          # Batch process - get thumbnails for each doc
          # Microsoft Graph supports batch requests but for simplicity we'll make individual calls
          # Limited to first 50 docs to avoid timeout
          # SSoT: Only SharePoint docs have Graph API thumbnails
          docs.limit(50).each do |doc|
            # Filter to SharePoint docs only (S3/Wasabi don't have Graph API thumbnails)
            next unless doc.storage_provider == 'sharepoint' || doc.storage_provider.nil?
            next unless doc.storage_reference.present? && doc.storage_drive_id.present?

            begin
              # Get fresh thumbnail from Graph API
              item_data = client.get_drive_item(doc.storage_drive_id, doc.storage_reference, expand: "thumbnails")
              if item_data
                thumbnails = item_data.dig("thumbnails", 0) || {}
                thumb_url = thumbnails.dig("medium", "url") || thumbnails.dig("small", "url")
                if thumb_url
                  fresh_thumbnails[doc.storage_reference] = thumb_url
                  # Also update the cached value
                  doc.update_column(:thumbnail_url, thumb_url)
                end
              end
            rescue => e
              Rails.logger.warn("[Thumbnail Refresh] Failed for doc #{doc.id}: #{e.message}")
            end
          end

          fresh_thumbnails
        rescue => e
          Rails.logger.error("[Thumbnail Refresh] Batch refresh failed: #{e.message}")
          {}
        end
      end

      # Recursively list all files in a job folder
      # SSoT: Uses WarehouseProvider for drive_id
      def list_all_job_files_recursive(client, credential, root_folder_id, max_depth: 5, max_time: 25)
        files = []
        folders_to_process = [ [ root_folder_id, 0, "" ] ] # [folder_id, depth, path]
        start_time = Time.now
        # SSoT: Get drive_id from WarehouseProvider
        storage_drive_id = WarehouseProvider.instance&.drive_id

        while folders_to_process.any?
          # Check if we've exceeded the time limit
          if Time.now - start_time > max_time
            Rails.logger.warn("[Job All Files] Recursive listing timed out after #{max_time}s with #{files.length} files found")
            break
          end

          current_id, depth, current_path = folders_to_process.shift

          begin
            # Note: @microsoft.graph.downloadUrl is automatically included in drive item responses
            url = "/drives/#{storage_drive_id}/items/#{current_id}/children?$select=id,name,size,webUrl,lastModifiedDateTime,file,folder&$expand=thumbnails&$top=200"
            result = client.get(url)

            result["value"]&.each do |item|
              if item["file"]
                # Extract thumbnail URLs from Microsoft Graph response
                # These URLs are publicly accessible (no auth required)
                # Use medium for grid thumbnails, large for full-size lightbox view
                thumbnails = item.dig("thumbnails", 0) || {}
                thumbnail_url = thumbnails.dig("medium", "url") ||
                                thumbnails.dig("small", "url")
                # Large thumbnail for full-size view in lightbox (usually 800-1200px)
                large_thumbnail_url = thumbnails.dig("large", "url") ||
                                      thumbnails.dig("medium", "url")

                files << {
                  id: item["id"],
                  name: item["name"],
                  size: item["size"],
                  web_url: item["webUrl"],
                  modified: item["lastModifiedDateTime"],
                  type: "file",
                  folder_path: current_path,
                  mime_type: item.dig("file", "mimeType"),
                  thumbnail_url: thumbnail_url,
                  download_url: large_thumbnail_url
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
      # SSoT: Uses WarehouseDocument
      def format_warehouse_document_for_review(doc)
        job = doc.linkable if doc.linkable_type == "Job"
        doc_type_id = doc.meta("document_type_id")
        doc_type = DocumentType.find_by(id: doc_type_id) if doc_type_id
        suggested_type_id = doc.meta("ai_suggested_type_id")
        suggested_type = DocumentType.find_by(id: suggested_type_id) if suggested_type_id

        {
          id: doc.id,
          job_id: job&.id,
          job_title: job&.title,
          # SSoT: Use storage_path from blob (provider-agnostic)
          sharepoint_item_id: doc.storage_blob&.storage_path,
          storage_reference: doc.storage_blob&.storage_path,
          current_name: doc.ui_name || doc.original_filename,
          original_name: doc.original_filename,
          proposed_name: doc.meta("ai_proposed_name"),
          folder_path: doc.folder_path,
          file_extension: File.extname(doc.original_filename.to_s).delete("."),
          file_type: doc.storage_blob&.content_type,
          file_size: doc.file_size || doc.storage_blob&.file_size,
          web_url: doc.meta("web_url"),
          current_type: doc_type ? {
            id: doc_type.id,
            name: doc_type.name,
            abbreviation: doc_type.abbreviation
          } : nil,
          suggested_type: suggested_type ? {
            id: suggested_type.id,
            name: suggested_type.name,
            abbreviation: suggested_type.abbreviation
          } : nil,
          ai_confidence: doc.meta("ai_confidence")&.to_f,
          ai_reasoning: doc.meta("ai_reasoning"),
          ai_analyzed_at: doc.meta("ai_analyzed_at"),
          rename_status: doc.meta("rename_status"),
          rename_approved_at: doc.meta("rename_approved_at")
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

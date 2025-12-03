class MicrosoftGraphClient
  GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'
  TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

  class AuthenticationError < StandardError; end
  class APIError < StandardError; end

  def initialize(credential = nil)
    # Support both per-construction and organization-level credentials
    @credential = credential || OrganizationOneDriveCredential.active_credential

    unless @credential
      raise AuthenticationError, "No OneDrive credential found. Please connect OneDrive first."
    end

    ensure_valid_token!
  end

  # OAuth Methods

  # Get authorization URL for user to consent
  def self.authorization_url(client_id:, redirect_uri:, scope:, state: nil)
    params = {
      client_id: client_id,
      response_type: 'code',
      redirect_uri: redirect_uri,
      scope: scope,
      response_mode: 'query'
    }
    params[:state] = state if state.present?

    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?#{params.to_query}"
  end

  # Exchange authorization code for access tokens
  def self.exchange_code_for_tokens(code:, client_id:, client_secret:, redirect_uri:)
    # Manually encode the body as URL-encoded form data
    # HTTParty sometimes doesn't encode hashes correctly with x-www-form-urlencoded
    params = {
      client_id: client_id,
      client_secret: client_secret,
      code: code,
      redirect_uri: redirect_uri,
      grant_type: 'authorization_code'
    }

    encoded_body = URI.encode_www_form(params)

    response = HTTParty.post(TOKEN_URL,
      body: encoded_body,
      headers: { 'Content-Type' => 'application/x-www-form-urlencoded' }
    )

    handle_token_response(response)
  end

  # Legacy method for backward compatibility
  def self.exchange_code_for_token(code, redirect_uri)
    exchange_code_for_tokens(
      code: code,
      client_id: ENV['ONEDRIVE_CLIENT_ID'],
      client_secret: ENV['ONEDRIVE_CLIENT_SECRET'],
      redirect_uri: redirect_uri
    )
  end

  # Client Credentials Flow (for organization-wide auth)
  def self.authenticate_as_application
    params = {
      client_id: ENV['ONEDRIVE_CLIENT_ID'],
      client_secret: ENV['ONEDRIVE_CLIENT_SECRET'],
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    }

    encoded_body = URI.encode_www_form(params)

    response = HTTParty.post(TOKEN_URL,
      body: encoded_body,
      headers: { 'Content-Type' => 'application/x-www-form-urlencoded' }
    )

    handle_token_response(response)
  end

  # Refresh access token
  def refresh_token!
    # Both organization and per-construction credentials now use refresh tokens with delegated permissions
    unless @credential.refresh_token
      raise AuthenticationError, "No refresh token available. Please reconnect OneDrive."
    end

    params = {
      client_id: ENV['ONEDRIVE_CLIENT_ID'],
      client_secret: ENV['ONEDRIVE_CLIENT_SECRET'],
      refresh_token: @credential.refresh_token,
      grant_type: 'refresh_token'
    }

    encoded_body = URI.encode_www_form(params)

    response = HTTParty.post(TOKEN_URL,
      body: encoded_body,
      headers: { 'Content-Type' => 'application/x-www-form-urlencoded' }
    )

    token_data = self.class.handle_token_response(response)

    @credential.update!(
      access_token: token_data[:access_token],
      refresh_token: token_data[:refresh_token] || @credential.refresh_token,
      token_expires_at: token_data[:expires_at]
    )

    token_data
  end

  # Drive/Folder Operations

  # Get user's default drive (or first available drive for app permissions)
  def get_default_drive
    # For delegated permissions (OAuth), use /me/drive to get the signed-in user's drive
    # This only requires Files.ReadWrite.All permission
    begin
      Rails.logger.info "Attempting to get drive using /me/drive (delegated permissions)"
      return get('/me/drive')
    rescue APIError => e
      Rails.logger.warn "Failed to get /me/drive: #{e.message}"
    end

    # Fallback for app permissions with client credentials
    # Option 1: Try to get the first user's drive (requires User.Read.All)
    begin
      users_response = get('/users?$top=1&$filter=accountEnabled eq true')
      if users_response['value']&.any?
        user_id = users_response['value'].first['id']
        Rails.logger.info "Using drive for user: #{users_response['value'].first['userPrincipalName']}"
        return get("/users/#{user_id}/drive")
      end
    rescue APIError => e
      Rails.logger.warn "Failed to get users: #{e.message}"
    end

    # Option 2: Last resort - try to list all drives (requires Sites.Read.All)
    drives_response = get('/drives')
    if drives_response['value']&.any?
      return drives_response['value'].first
    end

    raise APIError.new("Could not find any accessible drives")
  end

  # Get drive by ID
  def get_drive(drive_id)
    get("/drives/#{drive_id}")
  end

  # SharePoint Site Operations

  # List SharePoint sites the user has access to
  def list_sharepoint_sites
    # Search for all sites the user can access
    response = get('/sites?search=*')
    sites = response['value'] || []

    sites.map do |site|
      {
        id: site['id'],
        name: site['displayName'] || site['name'],
        web_url: site['webUrl'],
        description: site['description']
      }
    end
  end

  # Get a specific SharePoint site by name or ID
  def get_sharepoint_site(site_identifier)
    # If it's a full site ID (contains domain), use directly
    if site_identifier.include?(',')
      get("/sites/#{site_identifier}")
    else
      # Search for the site by name
      response = get("/sites?search=#{URI.encode_www_form_component(site_identifier)}")
      sites = response['value'] || []
      sites.first || raise(APIError.new("SharePoint site '#{site_identifier}' not found"))
    end
  end

  # Get the default document library drive for a SharePoint site
  def get_sharepoint_site_drive(site_id)
    get("/sites/#{site_id}/drive")
  end

  # List all drives (document libraries) for a SharePoint site
  def list_sharepoint_site_drives(site_id)
    response = get("/sites/#{site_id}/drives")
    drives = response['value'] || []

    drives.map do |drive|
      {
        id: drive['id'],
        name: drive['name'],
        web_url: drive['webUrl'],
        drive_type: drive['driveType']
      }
    end
  end

  # Set a SharePoint site as the target for job folders
  def use_sharepoint_site(site_identifier)
    site = get_sharepoint_site(site_identifier)
    drive = get_sharepoint_site_drive(site['id'])

    @credential.update!(
      drive_id: drive['id'],
      drive_name: drive['name'],
      metadata: @credential.metadata.merge({
        site_id: site['id'],
        site_name: site['displayName'] || site['name'],
        site_web_url: site['webUrl'],
        drive_type: 'sharepoint'
      })
    )

    { site: site, drive: drive }
  end

  # Create root folder for all jobs (organization-level)
  def create_jobs_root_folder(folder_name = "TEEEM Jobs")
    # Get the drive if we don't have it
    unless @credential.drive_id
      drive = get_default_drive
      @credential.update!(
        drive_id: drive['id'],
        drive_name: drive['name']
      )
    end

    # First, check if the folder already exists in the drive root
    existing_folder = find_folder_in_drive_root(folder_name)

    if existing_folder
      Rails.logger.info "[SharePoint] Found existing '#{folder_name}' folder (ID: #{existing_folder['id']}), reusing it"
      root_folder = existing_folder
    else
      Rails.logger.info "[SharePoint] Creating new '#{folder_name}' folder"
      # Create root folder for all TEEEM jobs with "fail" conflict behavior to prevent duplicates
      root_folder = create_folder_strict(folder_name, drive_id: @credential.drive_id)
    end

    # Update credential with root folder info
    @credential.update!(
      root_folder_id: root_folder['id'],
      root_folder_path: folder_name,
      metadata: @credential.metadata.merge({
        root_folder_name: folder_name,
        root_folder_web_url: root_folder['webUrl'],
        created_at: Time.current
      })
    )

    root_folder
  end

  # Find a folder by exact name in the drive root
  def find_folder_in_drive_root(folder_name)
    results = get("/drives/#{@credential.drive_id}/root/children")
    results['value']&.find { |item| item['name'] == folder_name && item['folder'] }
  rescue APIError => e
    Rails.logger.warn "[SharePoint] Error searching for folder '#{folder_name}' in drive root: #{e.message}"
    nil
  end

  # Create a folder with "fail" conflict behavior (don't rename if exists)
  def create_folder_strict(name, parent_id: nil, drive_id: nil)
    path = if drive_id && !parent_id
      "/drives/#{drive_id}/root/children"
    elsif parent_id
      "/drives/#{@credential.drive_id}/items/#{parent_id}/children"
    else
      "/drives/#{@credential.drive_id}/root/children"
    end

    post(path, {
      name: name,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail"
    })
  end

  # Create folder structure for a specific construction/job
  def create_job_folder_structure(construction, template)
    # Ensure we have a root folder for all jobs
    unless @credential.root_folder_id
      create_jobs_root_folder
    end

    # Prepare job data for variable resolution
    job_data = {
      job_code: construction.id.to_s.rjust(3, '0'),
      project_name: construction.title,
      site_supervisor: construction.site_supervisor_name
    }

    # Create job-specific root folder (e.g., "001 - Malbon Street")
    job_folder_name = "#{job_data[:job_code]} - #{job_data[:project_name]}"
    job_folder = create_folder(job_folder_name, parent_id: @credential.root_folder_id)

    # Create subfolders based on template
    create_subfolders_from_template(template, job_folder['id'], job_data)

    job_folder
  end

  # Create folder structure based on template (legacy per-construction method)
  def create_folder_structure(template, job_data = {})
    drive = get_default_drive
    drive_id = drive['id']

    # Create root folder (e.g., "PROJ-001 - Malbon Street")
    root_folder_name = template.name.gsub(/\{(\w+)\}/) do |match|
      variable_name = $1
      job_data[variable_name.to_sym] || job_data[variable_name] || match
    end

    root_folder = create_folder(root_folder_name, drive_id: drive_id)

    # Update credential with folder information (for per-construction credentials)
    if @credential.is_a?(OneDriveCredential)
      @credential.update!(
        drive_id: drive_id,
        root_folder_id: root_folder['id'],
        folder_path: root_folder_name,
        metadata: @credential.metadata.merge({
          root_folder_name: root_folder_name,
          root_folder_web_url: root_folder['webUrl'],
          created_at: Time.current
        })
      )
    end

    # Create subfolders based on template
    create_subfolders_from_template(template, root_folder['id'], job_data)

    root_folder
  end

  # Create a single folder
  def create_folder(name, parent_id: nil, drive_id: nil)
    path = if drive_id && !parent_id
      "/drives/#{drive_id}/root/children"
    elsif parent_id
      "/drives/#{@credential.drive_id}/items/#{parent_id}/children"
    else
      "/drives/#{@credential.drive_id}/root/children"
    end

    post(path, {
      name: name,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename"
    })
  end

  # List items in a folder
  # include_thumbnails: if true, expands thumbnails for image files
  def list_folder_items(folder_id = nil, include_thumbnails: false)
    folder_id = folder_id || @credential.root_folder_id

    unless folder_id
      raise APIError, "No folder ID provided and no root folder configured"
    end

    path = "/drives/#{@credential.drive_id}/items/#{folder_id}/children"
    path += "?$expand=thumbnails" if include_thumbnails
    get(path)
  end

  # Get folder by path
  def get_folder_by_path(path)
    encoded_path = path.split('/').map { |segment| CGI.escape(segment) }.join('/')
    get("/drives/#{@credential.drive_id}/root:/#{encoded_path}")
  rescue APIError => e
    return nil if e.message.include?('itemNotFound')
    raise
  end

  # Search for job folder by construction
  # Supports both exact match and fuzzy matching for legacy folder naming schemes
  def find_job_folder(construction)
    job_code = construction.id.to_s.rjust(3, '0')
    expected_name = "#{job_code} - #{construction.title}"

    # Normalize title for fuzzy matching (remove common prefixes like "Lot", lowercase, etc.)
    normalized_title = construction.title.to_s.downcase.gsub(/^lot\s+/i, '').strip

    # Determine where to search - use root_folder_id if set, otherwise find "TEEEM Jobs" folder
    search_folder_id = @credential.root_folder_id

    # If no root folder set, try to find "TEEEM Jobs" folder in the drive root
    if search_folder_id.blank?
      begin
        root_results = get("/drives/#{@credential.drive_id}/root/children")
        teeem_jobs_folder = root_results['value']&.find { |item| item['folder'] && item['name'] == 'TEEEM Jobs' }
        search_folder_id = teeem_jobs_folder['id'] if teeem_jobs_folder
        Rails.logger.info "[find_job_folder] Found TEEEM Jobs folder: #{search_folder_id}" if teeem_jobs_folder
      rescue APIError => e
        Rails.logger.warn "[find_job_folder] Could not find TEEEM Jobs folder: #{e.message}"
      end
    end

    # First try direct folder listing (more reliable than search for SharePoint)
    folders = []
    if search_folder_id.present?
      begin
        results = get("/drives/#{@credential.drive_id}/items/#{search_folder_id}/children")
        folders = results['value']&.select { |item| item['folder'] } || []
        Rails.logger.info "[find_job_folder] Found #{folders.length} folders in search location"

        # Try exact match first
        folder = folders.find { |item| item['name'] == expected_name }
        return folder if folder

        # Try fuzzy match: folder contains the job title (with or without "Lot" prefix)
        folder = folders.find do |item|
          name = item['name'].to_s.downcase
          # Match if folder name contains the normalized title
          name.include?(normalized_title) ||
            # Or match if folder contains address-like portions of the title
            (normalized_title.length > 10 && name.include?(normalized_title.split(' ').first(3).join(' ')))
        end
        if folder
          Rails.logger.info "[find_job_folder] Fuzzy matched folder: #{folder['name']}"
          return folder
        end
      rescue APIError => e
        Rails.logger.warn "[find_job_folder] Direct folder listing failed: #{e.message}"
      end
    end

    # Fallback to search with broader terms
    search_terms = [expected_name, construction.title, normalized_title].uniq
    search_terms.each do |term|
      next if term.blank?
      begin
        results = search(term, search_folder_id)
        folder = results['value']&.find { |item| item['folder'] && item['name'].to_s.downcase.include?(normalized_title) }
        return folder if folder
      rescue StandardError => e
        Rails.logger.warn "[find_job_folder] Search for '#{term}' failed: #{e.message}"
      end
    end

    nil
  end

  # Search for folder by name in drive root
  def find_folder_by_name(folder_name)
    # Search in drive root
    results = get("/drives/#{@credential.drive_id}/root/children")

    # Find exact match
    results['value']&.find { |item| item['name'] == folder_name && item['folder'] }
  end

  # File Operations

  # Upload small file (< 4MB)
  def upload_file(file, parent_folder_id, filename = nil)
    filename ||= File.basename(file.path)

    post(
      "/drives/#{@credential.drive_id}/items/#{parent_folder_id}:/#{filename}:/content",
      File.read(file),
      { 'Content-Type' => 'application/octet-stream' }
    )
  end

  # Create upload session for large files (>= 4MB)
  def create_upload_session(parent_folder_id, filename, file_size)
    post(
      "/drives/#{@credential.drive_id}/items/#{parent_folder_id}:/#{filename}:/createUploadSession",
      {
        item: {
          "@microsoft.graph.conflictBehavior": "rename",
          name: filename
        }
      }
    )
  end

  # Download file
  def download_file(file_id)
    response = HTTParty.get(
      "#{GRAPH_API_BASE}/drives/#{@credential.drive_id}/items/#{file_id}/content",
      headers: auth_headers,
      follow_redirects: true
    )

    raise APIError, "Download failed: #{response.code}" unless response.success?
    response.body
  end

  # Get file metadata
  def get_file(file_id)
    get("/drives/#{@credential.drive_id}/items/#{file_id}")
  end

  # Delete file or folder
  def delete_item(item_id)
    delete("/drives/#{@credential.drive_id}/items/#{item_id}")
  end

  # Search for files
  def search(query, folder_id = nil)
    path = if folder_id
      "/drives/#{@credential.drive_id}/items/#{folder_id}/search(q='#{CGI.escape(query)}')"
    else
      "/drives/#{@credential.drive_id}/root/search(q='#{CGI.escape(query)}')"
    end

    get(path)
  end

  # HTTP Methods (public for API access)

  def get(path)
    response = HTTParty.get(
      "#{GRAPH_API_BASE}#{path}",
      headers: auth_headers,
      timeout: 30
    )

    handle_response(response)
  end

  def post(path, body, custom_headers = {})
    headers = auth_headers.merge(custom_headers)

    # Set content type if body is a hash (JSON)
    if body.is_a?(Hash)
      headers['Content-Type'] = 'application/json'
      body = body.to_json
    end

    response = HTTParty.post(
      "#{GRAPH_API_BASE}#{path}",
      body: body,
      headers: headers,
      timeout: 30
    )

    handle_response(response)
  end

  def patch(path, body)
    response = HTTParty.patch(
      "#{GRAPH_API_BASE}#{path}",
      body: body.to_json,
      headers: auth_headers.merge({ 'Content-Type' => 'application/json' }),
      timeout: 30
    )

    handle_response(response)
  end

  def delete(path)
    response = HTTParty.delete(
      "#{GRAPH_API_BASE}#{path}",
      headers: auth_headers,
      timeout: 30
    )

    # Delete returns 204 No Content on success
    return true if response.code == 204

    handle_response(response)
  end

  # Get file content (binary data) from OneDrive
  def get_file_content(file_id)
    ensure_valid_token!

    response = HTTParty.get(
      "#{GRAPH_API_BASE}/me/drive/items/#{file_id}/content",
      headers: auth_headers,
      follow_redirects: true,
      timeout: 120  # Longer timeout for file downloads
    )

    unless response.success?
      raise "Failed to fetch file content: #{response.code} - #{response.body}"
    end

    response.body
  end

  private

  def ensure_valid_token!
    return unless @credential.token_expired?

    Rails.logger.info "Token expired, refreshing..."
    refresh_token!
  end

  def create_subfolders_from_template(template, parent_folder_id, job_data)
    # Get root level items (items with no parent)
    root_items = template.folder_template_items.where(parent_id: nil).order(:order)

    # Track created folder IDs for children
    folder_id_map = {}

    # Process all items in order of level (breadth-first)
    template.folder_template_items.order(:level, :order).each do |item|
      # Determine parent folder ID
      parent_id = if item.parent_id
        folder_id_map[item.parent_id]
      else
        parent_folder_id
      end

      # Skip if parent hasn't been created yet (shouldn't happen with level ordering)
      next unless parent_id

      # Resolve variables in folder name
      folder_name = item.resolve_variables(job_data)

      # Create folder
      created_folder = create_folder(folder_name, parent_id: parent_id)

      # Store mapping for children
      folder_id_map[item.id] = created_folder['id']

      Rails.logger.info "Created folder: #{folder_name} (#{created_folder['id']})"
    end

    folder_id_map
  end

  def self.handle_token_response(response)
    unless response.success?
      error_message = response.parsed_response&.dig('error_description') ||
                     response.parsed_response&.dig('error') ||
                     "Token request failed with status #{response.code}"
      raise AuthenticationError, error_message
    end

    data = response.parsed_response
    {
      access_token: data['access_token'],
      refresh_token: data['refresh_token'],
      expires_in: data['expires_in'],
      expires_at: Time.current + data['expires_in'].to_i.seconds
    }
  end

  def handle_response(response)
    case response.code
    when 200, 201
      response.parsed_response
    when 204
      true
    when 401
      # Token might be expired, try refreshing once
      if @token_refresh_attempted
        error_details = response.parsed_response || {}
        Rails.logger.error "OneDrive API 401 Error: #{error_details.inspect}"
        raise AuthenticationError, "Authentication failed after token refresh. Details: #{error_details}"
      end

      @token_refresh_attempted = true
      refresh_token!
      raise AuthenticationError, "Token expired, please retry request"
    when 404
      error_details = response.parsed_response || {}
      Rails.logger.error "OneDrive API 404 Error: #{error_details.inspect}"
      raise APIError, "Resource not found (404). Details: #{error_details}"
    when 429
      retry_after = response.headers['Retry-After']&.to_i || 60
      raise APIError, "Rate limited. Retry after #{retry_after} seconds"
    else
      error_details = response.parsed_response || {}
      error_code = error_details.dig('error', 'code')
      error_message = error_details.dig('error', 'message') ||
                     error_details.dig('error_description') ||
                     "API request failed with status #{response.code}"

      Rails.logger.error "OneDrive API Error (#{response.code}): #{error_details.inspect}"
      Rails.logger.error "Request URL: #{response.request.uri}"
      Rails.logger.error "Error Code: #{error_code}" if error_code

      full_error = "OneDrive API Error (#{response.code})"
      full_error += " [#{error_code}]" if error_code
      full_error += ": #{error_message}"
      full_error += ". Full response: #{error_details.to_json}"

      raise APIError, full_error
    end
  end

  def auth_headers
    {
      'Authorization' => "Bearer #{@credential.access_token}",
      'Accept' => 'application/json'
    }
  end
end

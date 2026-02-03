# frozen_string_literal: true

# DocumentProviders::SharePoint - SharePoint/OneDrive document provider
#
# Wraps the existing MicrosoftGraphClient to implement the DocumentProviders::Base interface.
# This allows SharePoint to be used interchangeably with other document providers (Box, S3, etc.)
#
# Usage:
#   provider = DocumentProviders::SharePoint.for_organization(organization)
#   provider.list_folder("/Jobs/JOB-001")
#   provider.upload_file("/Jobs/JOB-001", content, "invoice.pdf")
#
module DocumentProviders
  class SharePoint < Base
    # SSoT: Factory method to create provider for a tenant (Jan 2026 fix)
    # @param tenant [Tenant] The tenant
    # @return [DocumentProviders::SharePoint] The provider instance
    def self.for_tenant(tenant)
      credential = find_credential_for_tenant(tenant)
      raise NotConnectedError, "SharePoint not connected. Please connect in Admin > System > Connections." unless credential
      new(credential, tenant: tenant)
    end

    # DEPRECATED: Use for_tenant instead
    # Factory method to create a provider for an organization
    # @param organization [Organization] The organization
    # @return [DocumentProviders::SharePoint] The provider instance
    def self.for_organization(organization)
      Rails.logger.warn "[DEPRECATED] SharePoint.for_organization - use for_tenant instead"
      credential = find_credential_for_organization(organization)
      raise NotConnectedError, "SharePoint not connected. Please connect in Admin > System > Connections." unless credential
      new(credential, tenant: organization&.tenant)
    end

    # Find credential for tenant (SSoT: Jan 2026 fix)
    def self.find_credential_for_tenant(tenant)
      return nil unless defined?(MicrosoftCredential)
      return nil unless tenant

      # Get all organizations in this tenant
      org_ids = tenant.organizations.pluck(:id)

      if org_ids.any?
        # Try tenant's org-specific delegated credentials first
        cred = MicrosoftCredential.active
                                  .where(organization_id: org_ids)
                                  .delegated_credentials
                                  .connected
                                  .first
        return cred if cred

        # Also check app credentials for tenant's orgs
        app_cred = MicrosoftCredential.active
                                      .where(organization_id: org_ids)
                                      .app_credentials
                                      .connected
                                      .first
        return app_cred if app_cred
      end

      # Fall back to any org-level delegated credential
      cred = MicrosoftCredential.delegated_credentials.org_level.active.first
      return cred if cred

      # Also check app credentials
      app_cred = MicrosoftCredential.refreshable_app.first
      return app_cred if app_cred

      # Final fallback: any active SharePoint credential
      MicrosoftCredential.sharepoint_credential
    end

    # Find the appropriate credential for an organization (legacy)
    # Note: Currently credentials are org-wide, not per-organization
    # Future: Add organization_id filtering when multi-org support is added
    def self.find_credential_for_organization(organization)
      # Try new unified MicrosoftCredential first (SSoT)
      if defined?(MicrosoftCredential) && ActiveRecord::Base.connection.table_exists?(:microsoft_credentials)
        # Check for org-specific credential first
        if organization&.id
          cred = MicrosoftCredential.active
                                    .where(organization_id: organization.id)
                                    .delegated_credentials
                                    .connected
                                    .first
          return cred if cred

          # Also check app credentials for this org
          app_cred = MicrosoftCredential.active
                                        .where(organization_id: organization.id)
                                        .app_credentials
                                        .connected
                                        .first
          return app_cred if app_cred
        end

        # Fall back to any org-level delegated credential
        cred = MicrosoftCredential.delegated_credentials.org_level.active.first
        return cred if cred

        # Also check app credentials
        app_cred = MicrosoftCredential.refreshable_app.first
        return app_cred if app_cred
      end

      # Final fallback: any active SharePoint credential
      MicrosoftCredential.sharepoint_credential
    end

    def initialize(credential, tenant: nil)
      super(credential)
      @client = MicrosoftGraphClient.new(credential)
      @tenant = tenant
    end

    # ====================
    # PROVIDER IDENTITY
    # ====================

    def provider_type
      :sharepoint
    end

    def connected?
      @credential.present? && !@credential.refresh_token_dead?
    rescue StandardError
      false
    end

    # ====================
    # FOLDER OPERATIONS
    # ====================

    def list_folder(path, options = {})
      path = normalize_path(path)
      include_thumbnails = options.fetch(:include_thumbnails, false)
      recursive = options.fetch(:recursive, false)
      max_depth = options.fetch(:max_depth, 5)

      # Get folder by path first
      folder = get_folder_by_path(path)
      raise NotFoundError, "Folder not found: #{path}" unless folder

      if recursive
        items = @client.list_folder_recursive(folder["id"], max_depth: max_depth)
        items.map { |item| normalize_item_from_hash(item) }
      else
        response = @client.list_folder_items(folder["id"], include_thumbnails: include_thumbnails)
        (response["value"] || []).map { |item| normalize_item(item) }
      end
    end

    def create_folder(path, options = {})
      path = normalize_path(path)
      create_parents = options.fetch(:create_parents, true)

      if create_parents
        ensure_folder_path(path)
      else
        parent_path = File.dirname(path)
        folder_name = File.basename(path)
        parent = get_folder_by_path(parent_path)
        raise NotFoundError, "Parent folder not found: #{parent_path}" unless parent

        result = @client.create_folder(folder_name, parent_id: parent["id"])
        normalize_item(result)
      end
    end

    def folder_exists?(path)
      path = normalize_path(path)
      folder = get_folder_by_path(path)
      folder.present?
    rescue StandardError
      false
    end

    def get_folder(path)
      path = normalize_path(path)
      folder = get_folder_by_path(path)
      raise NotFoundError, "Folder not found: #{path}" unless folder
      normalize_item(folder)
    end

    # ====================
    # FILE OPERATIONS
    # ====================

    def upload_file(folder_path, content, filename, options = {})
      folder_path = normalize_path(folder_path)
      folder = get_folder_by_path(folder_path)
      raise NotFoundError, "Folder not found: #{folder_path}" unless folder

      # Handle IO objects
      content = content.read if content.respond_to?(:read)

      result = @client.upload_file_content(folder["id"], filename, content)
      {
        id: result[:id],
        name: result[:name],
        path: "#{folder_path}/#{result[:name]}",
        size: content.bytesize,
        web_url: result[:web_url]
      }
    end

    def download_file(path_or_id)
      if looks_like_id?(path_or_id)
        @client.download_file(path_or_id)
      else
        path = normalize_path(path_or_id)
        file = get_file_by_path(path)
        raise NotFoundError, "File not found: #{path}" unless file
        @client.download_file(file["id"])
      end
    end

    def download_url(path_or_id, options = {})
      item = resolve_item(path_or_id)
      raise NotFoundError, "File not found: #{path_or_id}" unless item

      # Microsoft Graph provides a pre-authenticated download URL in the response
      if item["@microsoft.graph.downloadUrl"]
        item["@microsoft.graph.downloadUrl"]
      else
        # Fetch the item again to get the download URL
        fresh_item = @client.get_file(item["id"])
        fresh_item["@microsoft.graph.downloadUrl"] || fresh_item["webUrl"]
      end
    end

    def get_file(path_or_id)
      item = resolve_item(path_or_id)
      raise NotFoundError, "File not found: #{path_or_id}" unless item
      normalize_item(item)
    end

    def delete_file(path_or_id)
      item = resolve_item(path_or_id)
      raise NotFoundError, "File not found: #{path_or_id}" unless item
      @client.delete_item(item["id"])
      true
    end

    def rename_file(path_or_id, new_name)
      item = resolve_item(path_or_id)
      raise NotFoundError, "File not found: #{path_or_id}" unless item
      result = @client.rename_file(item["id"], new_name)
      normalize_item(result)
    end

    def copy_file(source_path_or_id, destination_folder, new_name = nil)
      source_item = resolve_item(source_path_or_id)
      raise NotFoundError, "Source file not found: #{source_path_or_id}" unless source_item

      dest_folder = get_folder_by_path(normalize_path(destination_folder))
      raise NotFoundError, "Destination folder not found: #{destination_folder}" unless dest_folder

      result = @client.copy_file(source_item["id"], dest_folder["id"], new_name: new_name)

      # Copy is async in SharePoint, may return a monitor URL
      if result[:status] == "in_progress"
        { status: :pending, monitor_url: result[:monitor_url] }
      else
        normalize_item(result)
      end
    end

    def move_file(source_path_or_id, destination_folder, new_name = nil)
      source_item = resolve_item(source_path_or_id)
      raise NotFoundError, "Source file not found: #{source_path_or_id}" unless source_item

      dest_folder = get_folder_by_path(normalize_path(destination_folder))
      raise NotFoundError, "Destination folder not found: #{destination_folder}" unless dest_folder

      result = @client.move_file(source_item["id"], dest_folder["id"], new_name: new_name)
      normalize_item(result)
    end

    # ====================
    # SEARCH
    # ====================

    def search(query, options = {})
      folder_path = options[:folder_path]
      limit = options.fetch(:limit, 100)

      folder_id = nil
      if folder_path.present?
        folder = get_folder_by_path(normalize_path(folder_path))
        folder_id = folder["id"] if folder
      end

      response = @client.search(query, folder_id)
      items = response["value"] || []
      items = items.take(limit) if limit

      items.map { |item| normalize_item(item) }
    end

    # ====================
    # THUMBNAILS
    # ====================

    def thumbnail_url(path_or_id, options = {})
      size = options.fetch(:size, :medium)
      size_key = case size
                 when :small then "small"
                 when :large then "large"
                 else "medium"
                 end

      item = resolve_item(path_or_id)
      return nil unless item

      # Try to get thumbnail from item if it was fetched with thumbnails
      if item["thumbnails"].present?
        thumbnail_set = item["thumbnails"].first
        return thumbnail_set&.dig(size_key, "url")
      end

      # Fetch thumbnails separately
      begin
        response = @client.get("#{@client.send(:drive_path)}/items/#{item['id']}/thumbnails")
        thumbnail_set = response["value"]&.first
        thumbnail_set&.dig(size_key, "url")
      rescue StandardError
        nil
      end
    end

    # ====================
    # NATIVE CLIENT ACCESS
    # ====================

    def native_client
      @client
    end

    # ====================
    # SHAREPOINT-SPECIFIC METHODS
    # These are exposed for backward compatibility and SharePoint-specific features
    # ====================

    # Get SharePoint sites available to the user
    def list_sites
      @client.list_sharepoint_sites
    end

    # Switch to a specific SharePoint site
    def use_site(site_identifier)
      @client.use_sharepoint_site(site_identifier)
    end

    # Create job folder structure (TEEEM-specific)
    # SSoT: Folder structure comes from WarehouseFolder hierarchy (template parameter is ignored)
    def create_job_folder_structure(construction, _template = nil)
      @client.create_job_folder_structure(construction)
    end

    # Find job folder (TEEEM-specific)
    def find_job_folder(construction)
      result = @client.find_job_folder(construction)
      result ? normalize_item(result) : nil
    end

    # Validate root folder exists
    def validate_root_folder
      @client.validate_root_folder
    end

    private

    # Get folder by path using the Graph API
    def get_folder_by_path(path)
      return get_root_folder if path == "/" || path.blank?

      @client.get_folder_by_path(path.sub(/^\//, ""))
    end

    # Get file by path
    def get_file_by_path(path)
      # Use %20 for spaces (not +) - required by Microsoft Graph API
      encoded_path = path.sub(/^\//, "").split("/").map { |s| CGI.escape(s).gsub("+", "%20") }.join("/")
      @client.get("#{@client.send(:drive_path)}/root:/#{encoded_path}")
    rescue MicrosoftGraphClient::APIError => e
      return nil if e.message.include?("itemNotFound")
      raise ProviderError, e.message
    end

    # Get the root folder
    def get_root_folder
      @client.get("#{@client.send(:drive_path)}/root")
    end

    # Resolve a path or ID to an item
    def resolve_item(path_or_id)
      if looks_like_id?(path_or_id)
        @client.get_file(path_or_id)
      else
        get_file_by_path(normalize_path(path_or_id))
      end
    rescue MicrosoftGraphClient::APIError => e
      return nil if e.message.include?("itemNotFound")
      raise ProviderError, e.message
    end

    # Check if a string looks like a Microsoft Graph item ID
    def looks_like_id?(str)
      # SharePoint/OneDrive IDs are typically alphanumeric and don't contain slashes
      str.present? && !str.include?("/") && str.match?(/^[A-Za-z0-9!_-]+$/)
    end

    # Ensure all folders in a path exist, creating as needed
    def ensure_folder_path(path)
      parts = path.sub(/^\//, "").split("/")
      current_folder = get_root_folder

      parts.each do |folder_name|
        # Look for existing folder
        response = @client.list_folder_items(current_folder["id"])
        existing = (response["value"] || []).find { |item| item["folder"] && item["name"] == folder_name }

        if existing
          current_folder = existing
        else
          # Create the folder
          current_folder = @client.create_folder(folder_name, parent_id: current_folder["id"])
        end
      end

      normalize_item(current_folder)
    end

    # Normalize a raw Graph API item to our standard format
    def normalize_item(item)
      return nil unless item

      {
        id: item["id"],
        name: item["name"],
        type: item["folder"] ? :folder : :file,
        size: item["size"],
        mime_type: item.dig("file", "mimeType"),
        created_at: parse_time(item["createdDateTime"]),
        modified_at: parse_time(item["lastModifiedDateTime"]),
        thumbnail_url: item.dig("thumbnails", 0, "medium", "url"),
        path: build_path(item),
        web_url: item["webUrl"],
        download_url: item["@microsoft.graph.downloadUrl"]
      }
    end

    # Normalize an item that's already been converted to a hash (from list_folder_recursive)
    def normalize_item_from_hash(item)
      {
        id: item[:id],
        name: item[:name],
        type: item[:is_folder] ? :folder : :file,
        size: item[:size],
        mime_type: item[:mime_type],
        created_at: parse_time(item[:created_at]),
        modified_at: parse_time(item[:modified_at]),
        thumbnail_url: nil,
        path: item[:parent_path] ? "#{item[:parent_path]}/#{item[:name]}" : item[:name],
        web_url: item[:web_url],
        download_url: item[:download_url]
      }
    end

    # Build the full path from an item's parentReference
    def build_path(item)
      parent_path = item.dig("parentReference", "path") || ""
      if parent_path.include?(":")
        # Format is "/drives/{driveId}/root:/path/to/parent"
        path_after_root = parent_path.split(":").last.to_s
        "#{path_after_root}/#{item['name']}"
      else
        "/#{item['name']}"
      end
    end

    # Parse a time string
    def parse_time(time_str)
      return nil unless time_str
      Time.parse(time_str)
    rescue StandardError
      nil
    end
  end
end

# frozen_string_literal: true

# DocumentProviders::Base - Abstract interface for document storage providers
#
# This is the SSoT interface that all document storage providers must implement.
# Supports multiple backends: SharePoint, Box, Google Drive, S3-compatible (AWS, Backblaze, MinIO), etc.
#
# Usage:
#   provider = DocumentProviders.for_organization(organization)
#   provider.list_folder("/Jobs/JOB-001")
#   provider.upload_file("/Jobs/JOB-001/Documents", file_content, "invoice.pdf")
#
# Implementing a new provider:
#   1. Create a new class in document_providers/ that inherits from Base
#   2. Implement all abstract methods (marked with raise NotImplementedError)
#   3. Register the provider in DocumentProviders.for_organization
#
module DocumentProviders
  # Error classes are defined in document_providers.rb (module root)
  # They're available as DocumentProviders::NotFoundError, etc.

  class Base
    # The credential used for authentication
    attr_reader :credential

    def initialize(credential)
      @credential = credential
    end

    # Provider identification
    # Returns a symbol identifying this provider type
    # e.g., :sharepoint, :box, :google_drive, :s3
    def provider_type
      raise NotImplementedError, "#{self.class} must implement #provider_type"
    end

    # Connection status
    # Returns true if the provider is connected and ready to use
    def connected?
      raise NotImplementedError, "#{self.class} must implement #connected?"
    end

    # ====================
    # FOLDER OPERATIONS
    # ====================

    # List contents of a folder
    # @param path [String] The folder path (e.g., "/Jobs/JOB-001")
    # @param options [Hash] Optional parameters:
    #   - include_thumbnails: [Boolean] Include thumbnail URLs for images
    #   - recursive: [Boolean] Include nested folder contents
    #   - max_depth: [Integer] Maximum recursion depth (default: 5)
    # @return [Array<Hash>] Array of items with keys:
    #   - id: [String] Unique identifier
    #   - name: [String] File/folder name
    #   - type: [Symbol] :file or :folder
    #   - size: [Integer] Size in bytes (files only)
    #   - mime_type: [String] MIME type (files only)
    #   - created_at: [Time] Creation timestamp
    #   - modified_at: [Time] Last modification timestamp
    #   - thumbnail_url: [String] Thumbnail URL (if requested and available)
    #   - path: [String] Full path to the item
    def list_folder(path, options = {})
      raise NotImplementedError, "#{self.class} must implement #list_folder"
    end

    # Create a folder
    # @param path [String] The folder path to create (e.g., "/Jobs/JOB-001/Documents")
    # @param options [Hash] Optional parameters:
    #   - create_parents: [Boolean] Create parent folders if they don't exist (default: true)
    # @return [Hash] The created folder with id, name, path
    def create_folder(path, options = {})
      raise NotImplementedError, "#{self.class} must implement #create_folder"
    end

    # Check if a folder exists
    # @param path [String] The folder path to check
    # @return [Boolean] True if the folder exists
    def folder_exists?(path)
      raise NotImplementedError, "#{self.class} must implement #folder_exists?"
    end

    # Get folder metadata
    # @param path [String] The folder path
    # @return [Hash] Folder metadata with id, name, path, created_at, modified_at
    def get_folder(path)
      raise NotImplementedError, "#{self.class} must implement #get_folder"
    end

    # ====================
    # FILE OPERATIONS
    # ====================

    # Upload a file
    # @param folder_path [String] The destination folder path
    # @param content [String, IO] File content (binary string or IO object)
    # @param filename [String] The filename to use
    # @param options [Hash] Optional parameters:
    #   - content_type: [String] MIME type (auto-detected if not provided)
    #   - overwrite: [Boolean] Overwrite if file exists (default: false)
    # @return [Hash] The uploaded file with id, name, path, size
    def upload_file(folder_path, content, filename, options = {})
      raise NotImplementedError, "#{self.class} must implement #upload_file"
    end

    # Download a file
    # @param path_or_id [String] File path or ID
    # @return [String] Binary file content
    def download_file(path_or_id)
      raise NotImplementedError, "#{self.class} must implement #download_file"
    end

    # Get a pre-signed download URL
    # @param path_or_id [String] File path or ID
    # @param options [Hash] Optional parameters:
    #   - expires_in: [Integer] URL expiration in seconds (default: 3600)
    # @return [String] Pre-signed URL for direct download
    def download_url(path_or_id, options = {})
      raise NotImplementedError, "#{self.class} must implement #download_url"
    end

    # Get file metadata
    # @param path_or_id [String] File path or ID
    # @return [Hash] File metadata with id, name, path, size, mime_type, created_at, modified_at
    def get_file(path_or_id)
      raise NotImplementedError, "#{self.class} must implement #get_file"
    end

    # Delete a file
    # @param path_or_id [String] File path or ID
    # @return [Boolean] True if deleted successfully
    def delete_file(path_or_id)
      raise NotImplementedError, "#{self.class} must implement #delete_file"
    end

    # Rename a file
    # @param path_or_id [String] File path or ID
    # @param new_name [String] New filename
    # @return [Hash] Updated file metadata
    def rename_file(path_or_id, new_name)
      raise NotImplementedError, "#{self.class} must implement #rename_file"
    end

    # Copy a file
    # @param source_path_or_id [String] Source file path or ID
    # @param destination_folder [String] Destination folder path
    # @param new_name [String] Optional new filename (uses original if not provided)
    # @return [Hash] The copied file metadata
    def copy_file(source_path_or_id, destination_folder, new_name = nil)
      raise NotImplementedError, "#{self.class} must implement #copy_file"
    end

    # Move a file
    # @param source_path_or_id [String] Source file path or ID
    # @param destination_folder [String] Destination folder path
    # @param new_name [String] Optional new filename (uses original if not provided)
    # @return [Hash] The moved file metadata
    def move_file(source_path_or_id, destination_folder, new_name = nil)
      raise NotImplementedError, "#{self.class} must implement #move_file"
    end

    # ====================
    # SEARCH
    # ====================

    # Search for files and folders
    # @param query [String] Search query
    # @param options [Hash] Optional parameters:
    #   - folder_path: [String] Limit search to a specific folder
    #   - type: [Symbol] :file, :folder, or :all (default: :all)
    #   - limit: [Integer] Maximum results (default: 100)
    # @return [Array<Hash>] Array of matching items
    def search(query, options = {})
      raise NotImplementedError, "#{self.class} must implement #search"
    end

    # ====================
    # THUMBNAILS
    # ====================

    # Get thumbnail URL for a file
    # @param path_or_id [String] File path or ID
    # @param options [Hash] Optional parameters:
    #   - size: [Symbol] :small, :medium, :large (default: :medium)
    # @return [String, nil] Thumbnail URL or nil if not available
    def thumbnail_url(path_or_id, options = {})
      raise NotImplementedError, "#{self.class} must implement #thumbnail_url"
    end

    # ====================
    # PROVIDER-SPECIFIC
    # ====================

    # Get the underlying client (for provider-specific operations)
    # @return [Object] The native client (e.g., MicrosoftGraphClient for SharePoint)
    def native_client
      raise NotImplementedError, "#{self.class} must implement #native_client"
    end

    protected

    # Normalize path (ensure leading slash, remove trailing slash)
    def normalize_path(path)
      return "/" if path.blank?
      path = "/#{path}" unless path.start_with?("/")
      path = path.chomp("/") unless path == "/"
      path
    end

    # Normalize item response to standard format
    def normalize_item(item)
      raise NotImplementedError, "#{self.class} must implement #normalize_item"
    end
  end
end

# frozen_string_literal: true

# DocumentProviderAware - Shared concern for jobs that interact with document storage
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: All jobs MUST use this concern for document storage        ║
# ║  NEVER hardcode MicrosoftCredential or MicrosoftGraphClient       ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Provides a unified interface for jobs to interact with the organization's
# configured document storage provider (SharePoint, S3-compatible, etc.)
# The active provider is determined by WarehouseProvider.provider_type.
#
# Usage in a job:
#   class UploadDocumentJob < ApplicationJob
#     include DocumentProviderAware
#
#     def perform(document_id)
#       # Single-tenant: auto-detects provider from WarehouseProvider
#       setup_default_provider!
#
#       # Get or create nested folders
#       folder = get_or_create_folder_path("/Contacts/ACME Corp/BILLS")
#
#       # Upload file
#       result = upload_to_provider("/Contacts/ACME Corp/BILLS", content, "invoice.pdf")
#     end
#   end
#
module DocumentProviderAware
  extend ActiveSupport::Concern

  included do
    # Track which provider is being used
    attr_reader :document_provider, :organization, :storage_config
  end

  # ========================================
  # PROVIDER SETUP
  # ========================================

  # Initialize the default document provider
  # SSoT (Jan 2026): Uses tenant for storage configuration
  # @return [DocumentProviders::Base] The configured provider
  # @raise [DocumentProviders::NotConnectedError] If no provider is configured
  def setup_default_provider!
    tenant = ActsAsTenant.current_tenant
    raise ::TenantNotFoundError, "Tenant context required for setup_default_provider! - use ActsAsTenant.with_tenant or set ActsAsTenant.current_tenant" unless tenant

    @organization = tenant.organizations&.first || Organization.first
    @storage_config = WarehouseProvider.for_tenant(tenant)

    # SSoT: WarehouseProvider.provider_type determines which provider to use
    # FRC (Feb 2026): No hardcoded defaults - provider must be explicitly configured
    provider_type = @storage_config&.provider_type

    raise DocumentProviders::NotConnectedError, "Storage provider not configured for tenant" unless provider_type.present?

    @document_provider = case provider_type
    when "s3_compatible"
      setup_s3_provider
    when "sharepoint"
      setup_sharepoint_provider
    when "local"
      setup_local_provider
    else
      raise DocumentProviders::NotConnectedError, "Unknown provider type: #{provider_type}. Valid: sharepoint, s3_compatible, local"
    end

    Rails.logger.info "[DocumentProviderAware] Using #{provider_type} provider (#{@document_provider.class.name})"
    @document_provider
  end

  # Initialize the document provider for a specific organization
  # @param organization [Organization] The organization to get the provider for
  # @raise [DocumentProviders::NotConnectedError] If no provider is configured
  def setup_document_provider(organization)
    @organization = organization
    @storage_config = WarehouseProvider.for_organization(organization)

    # SSoT: Only 3 types - sharepoint, s3_compatible, local
    # FRC (Feb 2026): No hardcoded defaults - provider must be explicitly configured
    provider_type = @storage_config&.provider_type

    raise DocumentProviders::NotConnectedError, "Storage provider not configured for organization" unless provider_type.present?

    @document_provider = case provider_type
    when "s3_compatible"
      setup_s3_provider
    when "sharepoint"
      setup_sharepoint_provider
    when "local"
      setup_local_provider
    else
      raise DocumentProviders::NotConnectedError, "Unknown provider type: #{provider_type}. Valid: sharepoint, s3_compatible, local"
    end

    Rails.logger.info "[DocumentProviderAware] Using #{provider_type} for org #{organization&.name}"
  rescue DocumentProviders::NotConnectedError => e
    Rails.logger.warn "[DocumentProviderAware] No document provider configured: #{e.message}"
    raise
  end

  # Check if a document provider is configured and available
  def document_provider_available?
    @document_provider.present? && @document_provider.connected?
  end

  # Check if provider is connected, returning false instead of raising
  def provider_connected?
    return false unless @document_provider
    @document_provider.connected?
  rescue StandardError
    false
  end

  # ========================================
  # FOLDER OPERATIONS
  # ========================================

  # Get or create a folder path (creates all parent folders as needed)
  # @param path [String] The full folder path (e.g., "/Contacts/ACME Corp/BILLS")
  # @return [Hash] The folder info with :id, :name, :path
  def get_or_create_folder_path(path)
    ensure_provider_configured!
    @document_provider.create_folder(path, create_parents: true)
  end

  # Create a folder in the configured provider
  # @param path [String] The folder path to create
  # @return [Hash] The result from the provider
  def create_folder_in_provider(path)
    ensure_provider_configured!
    @document_provider.create_folder(path)
  end

  # Check if a folder exists
  # @param path [String] The folder path
  # @return [Boolean] Whether the folder exists
  def folder_exists_in_provider?(path)
    ensure_provider_configured!
    @document_provider.folder_exists?(path)
  end

  # Get folder info
  # @param path [String] The folder path
  # @return [Hash, nil] Folder info or nil if not found
  def get_folder_in_provider(path)
    ensure_provider_configured!
    @document_provider.get_folder(path)
  rescue DocumentProviders::NotFoundError
    nil
  end

  # ========================================
  # FILE OPERATIONS
  # ========================================

  # Upload a file to the configured provider
  # @param folder_path [String] The folder path to upload to
  # @param content [String, IO] The file content
  # @param filename [String] The filename
  # @param options [Hash] Additional options (content_type, etc.)
  # @return [Hash] The result from the provider (includes :id, :path, etc.)
  def upload_to_provider(folder_path, content, filename, options = {})
    ensure_provider_configured!
    @document_provider.upload_file(folder_path, content, filename, options)
  end

  # Download a file from the configured provider
  # @param path_or_id [String] The file path or item ID
  # @return [String] The file content
  def download_from_provider(path_or_id)
    ensure_provider_configured!
    @document_provider.download_file(path_or_id)
  end

  # Get a download URL for a file
  # @param path_or_id [String] The file path or item ID
  # @param options [Hash] Options like :expires_in
  # @return [String] The download URL
  def download_url_from_provider(path_or_id, options = {})
    ensure_provider_configured!
    @document_provider.download_url(path_or_id, options)
  end

  # List files in a folder
  # @param path [String] The folder path
  # @param options [Hash] Options like :recursive
  # @return [Array<Hash>] Array of file metadata hashes
  def list_folder_in_provider(path, options = {})
    ensure_provider_configured!
    @document_provider.list_folder(path, options)
  end

  # Delete a file from the provider
  # @param path_or_id [String] The file path or item ID
  # @return [Boolean] Success status
  def delete_from_provider(path_or_id)
    ensure_provider_configured!
    @document_provider.delete_file(path_or_id)
  end

  # Check if a file exists in the provider
  # @param path [String] The file path
  # @return [Boolean] Whether the file exists
  def file_exists_in_provider?(path)
    ensure_provider_configured!
    @document_provider.get_file(path)
    true
  rescue DocumentProviders::NotFoundError
    false
  end

  # ========================================
  # PROVIDER INFO
  # ========================================

  # Get the current provider type
  # @return [Symbol] :sharepoint, :s3_compatible, or :local
  def current_provider_type
    return nil unless @document_provider
    @document_provider.provider_type
  end

  # Check if using SharePoint
  def using_sharepoint?
    current_provider_type == :sharepoint
  end

  # Check if using S3-compatible storage (Wasabi, AWS S3, MinIO, etc.)
  def using_s3?
    current_provider_type == :s3_compatible
  end

  # Alias for using_s3? - all S3-compatible providers are treated the same
  # SSoT: Only 3 provider types - sharepoint, s3_compatible, local
  def using_wasabi?
    using_s3?
  end

  # Check if using local filesystem storage
  def using_local?
    current_provider_type == :local
  end

  # Get the storage root path
  # @return [String] The root path (e.g., "/Shared Documents" for SharePoint, "/" for S3)
  def storage_root_path
    @storage_config&.root_path || "/"
  end

  # Get a scope folder path from WarehouseProvider
  # @param scope [Symbol] The scope (:job, :contact, :corporate, etc.)
  # @return [String] The folder name for that scope
  def scope_folder_path(scope)
    @storage_config&.path_for(scope) || scope.to_s.titleize
  end

  private

  def setup_s3_provider
    tenant = ActsAsTenant.current_tenant
    credential = S3CompatibleCredential.active.connected.first
    raise DocumentProviders::NotConnectedError, "S3/Wasabi storage not configured. Check Admin > System > Storage." unless credential
    DocumentProviders::S3Compatible.new(credential, tenant: tenant)
  end

  def setup_sharepoint_provider
    tenant = ActsAsTenant.current_tenant
    credential = MicrosoftCredential.sharepoint_credential
    raise DocumentProviders::NotConnectedError, "SharePoint not connected. Check Admin > System > Connections." unless credential
    DocumentProviders::SharePoint.new(credential, tenant: tenant)
  end

  def setup_local_provider
    raise DocumentProviders::NotConnectedError, "Storage configuration required for local provider - setup_default_provider! must be called first" unless @storage_config
    DocumentProviders::Local.new(@storage_config, tenant: ActsAsTenant.current_tenant)
  end

  def ensure_provider_configured!
    raise DocumentProviders::NotConnectedError, "Document provider not configured. Call setup_default_provider! first." unless @document_provider
  end
end

# frozen_string_literal: true

# DocumentProviderAware - Shared concern for jobs that interact with document storage
#
# Provides a unified interface for jobs to interact with the organization's
# configured document storage provider (SharePoint, S3-compatible, etc.)
#
# Usage in a job:
#   class CreateJobFoldersJob < ApplicationJob
#     include DocumentProviderAware
#
#     def perform(job_id)
#       job = Job.find(job_id)
#       setup_document_provider(job.organization)
#
#       create_folder_in_provider("/Jobs/#{job.job_number}")
#       upload_to_provider("/Jobs/#{job.job_number}", content, "file.pdf")
#     end
#   end
#
module DocumentProviderAware
  extend ActiveSupport::Concern

  included do
    # Track which provider is being used
    attr_reader :document_provider, :organization
  end

  # Initialize the document provider for the given organization
  # @param organization [Organization] The organization to get the provider for
  # @raise [DocumentProviders::NotConnectedError] If no provider is configured
  def setup_document_provider(organization)
    @organization = organization
    @document_provider = DocumentProviders.for_organization(organization)

    Rails.logger.info "[DocumentProviderAware] Using #{@document_provider.class.name} for org #{organization.name}"
  rescue DocumentProviders::NotConnectedError => e
    Rails.logger.warn "[DocumentProviderAware] No document provider configured: #{e.message}"
    raise
  end

  # Check if a document provider is configured and available
  def document_provider_available?
    @document_provider.present? && @document_provider.connected?
  end

  # Create a folder in the configured provider
  # @param path [String] The folder path to create
  # @return [Hash] The result from the provider
  def create_folder_in_provider(path)
    ensure_provider_configured!
    @document_provider.create_folder(path)
  end

  # Upload a file to the configured provider
  # @param folder_path [String] The folder path to upload to
  # @param content [String, IO] The file content
  # @param filename [String] The filename
  # @param options [Hash] Additional options (mime_type, etc.)
  # @return [Hash] The result from the provider (includes item_id, path, etc.)
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

  # List files in a folder
  # @param path [String] The folder path
  # @param recursive [Boolean] Whether to list recursively
  # @return [Array<Hash>] Array of file metadata hashes
  def list_folder_in_provider(path, recursive: false)
    ensure_provider_configured!
    @document_provider.list_folder(path, recursive: recursive)
  end

  # Delete a file from the provider
  # @param path_or_id [String] The file path or item ID
  # @return [Boolean] Success status
  def delete_from_provider(path_or_id)
    ensure_provider_configured!
    @document_provider.delete_file(path_or_id)
  end

  # Check if a file exists in the provider
  # @param path_or_id [String] The file path or item ID
  # @return [Boolean] Whether the file exists
  def file_exists_in_provider?(path_or_id)
    ensure_provider_configured!
    @document_provider.file_exists?(path_or_id)
  end

  # Get the current provider type
  # @return [String] 'sharepoint' or 's3_compatible'
  def current_provider_type
    @organization&.document_provider || 'sharepoint'
  end

  # Check if using SharePoint
  def using_sharepoint?
    current_provider_type == 'sharepoint'
  end

  # Check if using S3-compatible storage
  def using_s3?
    current_provider_type == 's3_compatible'
  end

  private

  def ensure_provider_configured!
    raise DocumentProviders::NotConnectedError, "Document provider not configured. Call setup_document_provider first." unless @document_provider
  end
end

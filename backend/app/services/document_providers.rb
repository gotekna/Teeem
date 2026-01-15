# frozen_string_literal: true

# DocumentProviders - Multi-provider document storage abstraction
#
# SSoT: Only 3 provider types (consolidated Jan 2026)
# - sharepoint: Microsoft SharePoint/OneDrive (Graph API)
# - s3_compatible: ALL S3-API storage (AWS S3, Wasabi, MinIO, Backblaze B2, etc.)
# - local: Local filesystem storage
#
# Usage:
#   provider = DocumentProviders.for_organization(organization)
#   provider.list_folder("/Jobs/JOB-001")
#   provider.upload_file("/Jobs/JOB-001", content, "invoice.pdf")
#
module DocumentProviders
  # Error classes
  class Error < StandardError; end
  class AuthenticationError < Error; end
  class NotConnectedError < Error; end
  class NotFoundError < Error; end
  class PermissionError < Error; end
  class QuotaExceededError < Error; end
  class ProviderError < Error; end

  # Factory method to get the appropriate provider for an organization
  # SSoT: StorageConfiguration.provider_type determines which provider to use
  # @param organization [Organization] The organization
  # @return [DocumentProviders::Base] The configured provider
  def self.for_organization(organization)
    # SSoT: StorageConfiguration determines provider type based on active credentials
    config = StorageConfiguration.for_organization(organization)
    provider_type = config.provider_type

    case provider_type.to_s
    when "sharepoint"
      DocumentProviders::SharePoint.for_organization(organization)
    when "s3_compatible"
      DocumentProviders::S3Compatible.for_organization(organization)
    when "local"
      DocumentProviders::Local.for_organization(organization)
    else
      raise Error, "Unknown document provider: #{provider_type}. Valid types: sharepoint, s3_compatible, local"
    end
  end
end

# frozen_string_literal: true

# DocumentProviders - Multi-provider document storage abstraction
#
# Provides a unified interface for different document storage backends:
# - SharePoint (Microsoft 365)
# - S3-compatible (AWS S3, Backblaze B2, MinIO, Wasabi, Synology NAS)
# - Box (planned)
# - Google Drive (planned)
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
    when "s3", "wasabi"
      DocumentProviders::S3Compatible.for_organization(organization)
    when "box"
      raise NotConnectedError, "Box provider not yet implemented"
    when "google_drive"
      raise NotConnectedError, "Google Drive provider not yet implemented"
    when "local"
      raise NotConnectedError, "Local storage provider not yet implemented"
    else
      raise Error, "Unknown document provider: #{provider_type}. Check StorageConfiguration."
    end
  end
end

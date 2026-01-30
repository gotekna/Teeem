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
  class ConfigurationError < Error; end  # Missing/invalid configuration (SSoT Jan 2026)
  class NotConnectedError < Error; end
  class NotFoundError < Error; end
  class PermissionError < Error; end
  class QuotaExceededError < Error; end
  class ProviderError < Error; end

  # SSoT: Factory method to get provider for a tenant (Jan 2026 fix)
  # @param tenant [Tenant] The tenant
  # @return [DocumentProviders::Base] The configured provider
  def self.for_tenant(tenant)
    raise ::TenantNotFoundError, "Tenant required for DocumentProviders.for_tenant" unless tenant

    config = WarehouseProvider.for_tenant(tenant)
    provider_type = config.provider_type

    case provider_type.to_s
    when "sharepoint"
      DocumentProviders::SharePoint.for_tenant(tenant)
    when "s3_compatible"
      DocumentProviders::S3Compatible.for_tenant(tenant)
    when "local"
      DocumentProviders::Local.for_tenant(tenant)
    else
      raise Error, "Unknown document provider: #{provider_type}. Valid types: sharepoint, s3_compatible, local"
    end
  end

  # DEPRECATED: Use for_tenant instead
  # Factory method to get the appropriate provider for an organization
  # SSoT: WarehouseProvider.provider_type determines which provider to use
  # @param organization [Organization] The organization
  # @return [DocumentProviders::Base] The configured provider
  def self.for_organization(organization)
    Rails.logger.warn "[DEPRECATED] DocumentProviders.for_organization - use for_tenant instead"

    # SSoT: Derive tenant from organization and delegate to for_tenant
    tenant = organization&.tenant
    raise ::TenantNotFoundError.new(context: "DocumentProviders.for_organization - organization has no tenant") unless tenant

    for_tenant(tenant)
  end
end

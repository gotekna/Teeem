# frozen_string_literal: true

# =============================================================================
# Tenant Error Classes - SSoT for Multi-Tenancy Error Handling
# =============================================================================
#
# These errors are used for fail-fast behavior when tenant context is required.
# Instead of silently falling back to Organization.first or returning nil,
# we raise explicit errors to catch multi-tenancy issues early.
#
# Usage:
#   raise TenantErrors::TenantNotFoundError, "Tenant required for WarehouseDocument##{id}"
#
# Or include the module for cleaner syntax:
#   include TenantErrors
#   raise TenantNotFoundError, "..."
#
module TenantErrors
  # Raised when a tenant cannot be derived from the record chain
  # This replaces the anti-pattern of using Organization.first as fallback
  class TenantNotFoundError < StandardError
    attr_reader :record_class, :record_id, :context

    def initialize(message = nil, record: nil, context: nil)
      @record_class = record&.class&.name
      @record_id = record&.id
      @context = context

      message ||= build_default_message
      super(message)
    end

    private

    def build_default_message
      parts = ["Tenant required"]
      parts << "for #{record_class}##{record_id}" if record_class
      parts << "(#{context})" if context
      parts.join(" ")
    end
  end

  # Raised when an organization is required but cannot be determined
  # Used for credential routing where each SPV needs its own credentials
  class OrganizationNotFoundError < StandardError
    attr_reader :record_class, :record_id, :context

    def initialize(message = nil, record: nil, context: nil)
      @record_class = record&.class&.name
      @record_id = record&.id
      @context = context

      message ||= build_default_message
      super(message)
    end

    private

    def build_default_message
      parts = ["Organization required for credential routing"]
      parts << "for #{record_class}##{record_id}" if record_class
      parts << "(#{context})" if context
      parts.join(" ")
    end
  end

  # Raised when storage configuration is missing for a tenant
  class StorageNotConfiguredError < StandardError
    def initialize(tenant)
      super("Storage not configured for tenant: #{tenant&.name || 'unknown'}")
    end
  end
end

# Make error classes available at top level for convenience
TenantNotFoundError = TenantErrors::TenantNotFoundError
OrganizationNotFoundError = TenantErrors::OrganizationNotFoundError
StorageNotConfiguredError = TenantErrors::StorageNotConfiguredError

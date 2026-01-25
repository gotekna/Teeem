# frozen_string_literal: true

# TenantResolvable - SSoT Concern for Tenant Derivation
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Fail-Fast Tenant Derivation (Jan 2026)                     ║
# ║                                                                   ║
# ║  Replaces the anti-pattern of Organization.first fallback        ║
# ║  with proper tenant derivation from record associations.         ║
# ║                                                                   ║
# ║  If tenant cannot be derived → TenantNotFoundError (fail fast)   ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   class WarehouseDocument < ApplicationRecord
#     include TenantResolvable
#   end
#
#   document.resolved_tenant  # => Tenant or raises TenantNotFoundError
#
# Derivation Chain (in order):
# 1. Direct tenant association (acts_as_tenant models)
# 2. Through credential association
# 3. Through parent record (job, contact, etc.)
# 4. Through documentable association
# 5. Through organization association (legacy)
# 6. ActsAsTenant.current_tenant (thread context)
# 7. FAIL FAST - raise TenantNotFoundError
#
module TenantResolvable
  extend ActiveSupport::Concern

  included do
    # Optional: Add tenant association if not already present
    # belongs_to :tenant, optional: true
  end

  # SSoT: Resolve tenant from record associations (fail-fast)
  #
  # @return [Tenant] The resolved tenant
  # @raise [TenantNotFoundError] If tenant cannot be derived
  #
  def resolved_tenant
    # Cache the result to avoid repeated lookups
    @resolved_tenant ||= derive_tenant
  end

  # Clear cached tenant (use after association changes)
  def clear_resolved_tenant_cache
    @resolved_tenant = nil
  end

  # Check if tenant can be resolved (doesn't raise)
  def tenant_resolvable?
    derive_tenant.present?
  rescue TenantNotFoundError
    false
  end

  private

  # Derive tenant from associations (ordered by priority)
  # Raises TenantNotFoundError if no tenant can be found
  def derive_tenant
    # 1. Direct tenant association (acts_as_tenant models)
    if respond_to?(:tenant) && tenant.present?
      return tenant
    end

    # 2. Through credential association (credentials belong to organization or user, not tenant)
    if respond_to?(:microsoft_credential) && microsoft_credential&.organization&.tenant.present?
      return microsoft_credential.organization.tenant
    end
    if respond_to?(:imap_credential) && imap_credential&.user&.tenant.present?
      return imap_credential.user.tenant
    end
    if respond_to?(:s3_compatible_credential) && s3_compatible_credential&.organization&.tenant.present?
      return s3_compatible_credential.organization.tenant
    end

    # 3. Through parent record associations
    # Job
    if respond_to?(:job) && job&.respond_to?(:tenant) && job.tenant.present?
      return job.tenant
    end
    # Contact
    if respond_to?(:contact) && contact&.respond_to?(:tenant) && contact.tenant.present?
      return contact.tenant
    end
    # Corporate Company
    if respond_to?(:corporate_company) && corporate_company.present?
      tenant = corporate_company_tenant(corporate_company)
      return tenant if tenant.present?
    end
    # User
    if respond_to?(:user) && user&.respond_to?(:tenant) && user.tenant.present?
      return user.tenant
    end

    # 4. Through documentable association (polymorphic)
    if respond_to?(:documentable) && documentable.present?
      documentable_tenant = resolve_tenant_from_documentable(documentable)
      return documentable_tenant if documentable_tenant.present?
    end

    # 5. Through organization association (legacy - deprecated)
    if respond_to?(:organization) && organization&.tenant.present?
      Rails.logger.debug "[TenantResolvable] Derived tenant via organization for #{self.class}##{id}"
      return organization.tenant
    end

    # 6. ActsAsTenant.current_tenant (thread context)
    if ActsAsTenant.current_tenant.present?
      Rails.logger.debug "[TenantResolvable] Using ActsAsTenant.current_tenant for #{self.class}##{id}"
      return ActsAsTenant.current_tenant
    end

    # 7. FAIL FAST - No tenant found
    Rails.logger.error "[TenantResolvable] No tenant found for #{self.class}##{id}"
    raise TenantNotFoundError.new(record: self, context: "TenantResolvable#derive_tenant")
  end

  # Resolve tenant from a documentable record
  def resolve_tenant_from_documentable(doc)
    return nil unless doc

    # Direct tenant
    if doc.respond_to?(:tenant) && doc.tenant.present?
      return doc.tenant
    end

    # Through job
    if doc.respond_to?(:job) && doc.job&.respond_to?(:tenant) && doc.job.tenant.present?
      return doc.job.tenant
    end

    # Through contact
    if doc.respond_to?(:contact) && doc.contact&.respond_to?(:tenant) && doc.contact.tenant.present?
      return doc.contact.tenant
    end

    # Through corporate company
    if doc.respond_to?(:corporate_company) && doc.corporate_company.present?
      return corporate_company_tenant(doc.corporate_company)
    end

    # Through organization (legacy)
    if doc.respond_to?(:organization) && doc.organization&.tenant.present?
      return doc.organization.tenant
    end

    nil
  end

  # Get tenant from a corporate company (through group)
  def corporate_company_tenant(company)
    return nil unless company

    # CorporateCompany → CorporateGroup → Tenant
    if company.respond_to?(:corporate_group) && company.corporate_group&.tenant.present?
      return company.corporate_group.tenant
    end

    # Direct tenant on company (if added)
    if company.respond_to?(:tenant) && company.tenant.present?
      return company.tenant
    end

    nil
  end
end

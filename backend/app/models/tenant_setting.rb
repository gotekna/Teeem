# frozen_string_literal: true

# TenantSetting - Per-tenant company settings
#
# This model holds all configuration settings for a tenant.
# It replaces the singleton CorporateCompanySetting pattern with per-tenant settings.
#
# Each tenant has exactly one TenantSetting record.
#
class TenantSetting < ApplicationRecord
  belongs_to :tenant
  belongs_to :corporate_group, optional: true  # DEPRECATED: Use tenant instead

  # SaaS customer contact linkage (for billing via existing SaaS infrastructure)
  belongs_to :saas_customer_contact, class_name: "Contact", optional: true

  # =============================================================================
  # Validations
  # =============================================================================
  validates :tenant_id, uniqueness: true

  # =============================================================================
  # Callbacks
  # =============================================================================
  before_validation :set_defaults, on: :create

  # =============================================================================
  # Class Methods
  # =============================================================================

  # Get or create settings for a tenant
  def self.for_tenant(tenant)
    find_or_create_by!(tenant: tenant)
  end

  # =============================================================================
  # Instance Methods
  # =============================================================================

  # Get the timezone for this tenant (default: Brisbane)
  def effective_timezone
    timezone.presence || "Australia/Brisbane"
  end

  # Get the locale for this tenant (default: en-AU)
  def effective_locale
    locale.presence || "en-AU"
  end

  # Get the currency for this tenant (default: AUD)
  def effective_currency
    currency.presence || "AUD"
  end

  # Get primary branding color (fallback to tenant if not set)
  def effective_primary_color
    primary_color.presence || tenant&.primary_color.presence || "#3B82F6"
  end

  # Get secondary branding color
  def effective_secondary_color
    secondary_color.presence || tenant&.secondary_color.presence || "#64748B"
  end

  # Get logo URL (fallback to tenant if not set)
  def effective_logo_url
    logo_url.presence || tenant&.logo_url
  end

  # Get the default job type for this tenant
  def default_job_type
    return nil unless default_job_type_id

    JobType.find_by(id: default_job_type_id, tenant_id: tenant_id)
  end

  # Get the default job status for this tenant
  def default_job_status
    return nil unless default_job_status_id

    JobStatus.find_by(id: default_job_status_id, tenant_id: tenant_id)
  end

  # Get the default job stage for this tenant
  def default_job_stage
    return nil unless default_job_stage_id

    JobStage.find_by(id: default_job_stage_id, tenant_id: tenant_id)
  end

  # Check if Stripe billing is configured
  def stripe_configured?
    stripe_customer_id.present?
  end

  private

  def set_defaults
    self.timezone ||= "Australia/Brisbane"
    self.locale ||= "en-AU"
    self.currency ||= "AUD"
  end
end

# frozen_string_literal: true

# TenantSetting - Per-tenant company settings
#
# This model holds all configuration settings for a tenant (CorporateGroup).
# It replaces the singleton CorporateCompanySetting pattern with per-tenant settings.
#
# Each tenant has exactly one TenantSetting record.
#
class TenantSetting < ApplicationRecord
  belongs_to :corporate_group

  # SaaS customer contact linkage (for billing via existing SaaS infrastructure)
  belongs_to :saas_customer_contact, class_name: "Contact", optional: true

  # =============================================================================
  # Validations
  # =============================================================================
  validates :corporate_group_id, uniqueness: true

  # =============================================================================
  # Callbacks
  # =============================================================================
  before_validation :set_defaults, on: :create

  # =============================================================================
  # Class Methods
  # =============================================================================

  # Get or create settings for a tenant
  def self.for_tenant(tenant)
    find_or_create_by!(corporate_group: tenant)
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

  # Get primary branding color (fallback to corporate_group if not set)
  def effective_primary_color
    primary_color.presence || corporate_group.primary_color.presence || "#3B82F6"
  end

  # Get secondary branding color
  def effective_secondary_color
    secondary_color.presence || corporate_group.secondary_color.presence || "#64748B"
  end

  # Get logo URL (fallback to corporate_group if not set)
  def effective_logo_url
    logo_url.presence || corporate_group.logo_url
  end

  # Get the default job type for this tenant
  def default_job_type
    return nil unless default_job_type_id

    corporate_group.job_types.find_by(id: default_job_type_id)
  end

  # Get the default job status for this tenant
  def default_job_status
    return nil unless default_job_status_id

    corporate_group.job_statuses.find_by(id: default_job_status_id)
  end

  # Get the default job stage for this tenant
  def default_job_stage
    return nil unless default_job_stage_id

    corporate_group.job_stages.find_by(id: default_job_stage_id)
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

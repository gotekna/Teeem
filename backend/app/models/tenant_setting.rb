# frozen_string_literal: true

# TenantSetting - THE SSoT for all tenant-level settings
#
# This model holds all configuration settings for a tenant, including:
# - Company information (name, ABN, contact details)
# - Email configuration (internal domains, monitored mailboxes)
# - Brand colors (HSL format for CSS variables)
# - API environment (production/beta/staging)
# - Timezone and business day configuration
# - Link expiry settings
#
# Each tenant has exactly one TenantSetting record.
#
# MIGRATION NOTE: This model consolidates the former CorporateCompanySetting.
# All references to CorporateCompanySetting should use TenantSetting instead.
#
class TenantSetting < ApplicationRecord
  belongs_to :tenant
  belongs_to :company_group, optional: true  # DEPRECATED: Use tenant instead

  # SaaS customer contact linkage (for billing via existing SaaS infrastructure)
  belongs_to :saas_customer_contact, class_name: "Contact", optional: true

  # Encrypt sensitive credentials (SSoT pattern from MicrosoftCredential)
  encrypts :twilio_auth_token

  # ========================================
  # API Environment Configuration (SSoT)
  # ========================================
  VALID_API_ENVIRONMENTS = %w[production beta staging].freeze

  API_ENVIRONMENT_URLS = {
    "production" => "https://teeem-production-121159e1ff9d.herokuapp.com",
    "beta" => "https://teeem-beta-6e3e9cb59225.herokuapp.com",
    "staging" => "https://teeem-staging-d60a657ed68a.herokuapp.com"
  }.freeze

  FRONTEND_ENVIRONMENT_URLS = {
    "production" => "https://teeem.vercel.app",
    "beta" => "https://teeem-beta.vercel.app",
    "staging" => "https://teeem-staging.vercel.app"
  }.freeze

  # =============================================================================
  # Validations
  # =============================================================================
  validates :tenant_id, uniqueness: true
  validates :api_environment, inclusion: { in: VALID_API_ENVIRONMENTS }, allow_nil: true

  # =============================================================================
  # Callbacks
  # =============================================================================
  before_validation :set_defaults, on: :create

  # =============================================================================
  # Class Methods - SSoT Instance Access
  # =============================================================================

  # Get or create settings for a tenant (THE ONE way to access tenant settings)
  def self.for_tenant(tenant)
    find_or_create_by!(tenant: tenant) do |setting|
      setting.timezone ||= "Australia/Brisbane"
      setting.locale ||= "en-AU"
      setting.currency ||= "AUD"
      # corporate_group_id is NOT NULL in schema, derive from tenant
      setting.company_group_id ||= tenant.company_groups.first&.id
    end
  end

  # Backward compatibility: instance method using current tenant
  # SSoT (Jan 2026): acts_as_tenant auto-scopes queries to current_tenant
  def self.instance
    tenant = ActsAsTenant.current_tenant
    if tenant
      for_tenant(tenant)
    else
      # Fallback for contexts without tenant (e.g., console, migrations)
      first_or_create! do |setting|
        fallback_tenant = Tenant.first
        setting.tenant_id ||= fallback_tenant&.id
        # company_group_id is NOT NULL in schema
        setting.company_group_id ||= fallback_tenant&.company_groups&.first&.id || CompanyGroup.first&.id
        setting.timezone ||= "Australia/Brisbane"
        setting.locale ||= "en-AU"
        setting.currency ||= "AUD"
      end
    end
  end

  # =============================================================================
  # Timezone Methods (SSoT)
  # =============================================================================

  # Get today's date in the company timezone
  def self.today
    Time.use_zone(timezone) do
      Time.zone.today
    end
  end

  # Get current time in the company timezone
  def self.now
    Time.use_zone(timezone) do
      Time.zone.now
    end
  end

  # Execute block in company timezone (SSoT for timezone operations)
  # Usage: TenantSetting.in_company_timezone { Date.today }
  def self.in_company_timezone(&block)
    Time.use_zone(timezone, &block)
  end

  # Get the company timezone string (SSoT)
  def self.timezone
    instance.timezone || "Australia/Brisbane"
  end

  # =============================================================================
  # Business Day Methods (SSoT)
  # =============================================================================

  # Default working days configuration
  DEFAULT_WORKING_DAYS = {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  }.freeze

  # Check if a date is a working day (respects working_days config)
  def self.working_day?(date)
    settings = instance
    working_days = settings.working_days || DEFAULT_WORKING_DAYS
    day_name = date.strftime("%A").downcase
    working_days[day_name.to_sym] || working_days[day_name] || false
  end

  # Check if a date is a public holiday
  def self.public_holiday?(date)
    PublicHoliday.where(date: date).exists?
  end

  # Check if a date is a business day (working day AND not a holiday)
  def self.business_day?(date)
    working_day?(date) && !public_holiday?(date)
  end

  # =============================================================================
  # Document Base Path Methods (SSoT: WarehouseProvider)
  # =============================================================================

  def self.company_documents_base_path
    WarehouseProvider.instance&.path_for(:corporate) || "Corporate"
  end

  def self.people_documents_base_path
    WarehouseProvider.instance&.path_for(:people) || "People"
  end

  def self.job_documents_base_path
    WarehouseProvider.instance&.path_for(:job) || "Jobs"
  end

  # =============================================================================
  # Template Resolution Utilities
  # =============================================================================

  # Resolve template placeholders with provided values
  # Used by WarehouseFolder and DocumentMigrationJob
  def self.resolve_template(template, values)
    result = template.dup
    values.each do |key, value|
      result.gsub!("{{#{key}}}", value.to_s)
    end
    result
  end

  # =============================================================================
  # Team Email Domains (SSoT for Split Inbox)
  # =============================================================================

  # Get team email domains for split inbox "Team" category
  def self.team_email_domains
    instance.team_email_domains || []
  end

  # Update team email domains
  def self.update_team_email_domains(domains)
    normalized = domains.map { |d| d.to_s.downcase.strip }.reject(&:blank?)
    instance.update!(team_email_domains: normalized)
  end

  # =============================================================================
  # Corporate Entity Types (SSoT)
  # =============================================================================

  DEFAULT_ENTITY_TYPES = [
    "Company",
    "Trust",
    "Superfund",
    "Charity",
    "Corporate Trustee",
    "Sole Trader"
  ].freeze

  # Get all configured entity types
  def self.corporate_entity_types
    instance.corporate_entity_types.presence || DEFAULT_ENTITY_TYPES
  end

  # Update entity types
  def self.update_corporate_entity_types(types)
    instance.update!(corporate_entity_types: types)
  end

  # =============================================================================
  # Email Configuration (SSoT)
  # =============================================================================

  # SSoT: No hardcoded domains - tenant must configure their own
  # Empty array means all emails treated as external until configured
  DEFAULT_INTERNAL_DOMAINS = [].freeze

  # Get internal email domains as array
  # SSoT: Used for detecting internal vs external emails
  # Tenant must configure via Settings > Company > Email Config
  def self.internal_email_domains
    domains = instance.internal_email_domains.presence
    return DEFAULT_INTERNAL_DOMAINS if domains.blank?

    domains.split(",").map(&:strip).reject(&:blank?)
  end

  # Check if an email address is internal
  def self.internal_email?(email)
    return false if email.blank?
    return false if internal_email_domains.empty?  # No domains configured = all external

    domain = email.to_s.split("@").last&.downcase
    internal_email_domains.any? { |d| domain == d.downcase }
  end

  # Get internal domains formatted for SQL LIKE patterns
  # Returns configured domains with @ prefix, e.g., ["@example.com", "@company.com"]
  def self.internal_domain_patterns
    internal_email_domains.map { |d| "@#{d}" }
  end

  # Monitored mailbox addresses (SSoT)
  # SSoT: No hardcoded emails - returns nil if not configured
  # Tenant must configure via Settings > Company > Email Config
  def self.monitored_mailbox_pay
    instance.monitored_mailbox_pay.presence
  end

  def self.monitored_mailbox_newtask
    instance.monitored_mailbox_newtask.presence
  end

  def self.monitored_mailbox_newjob
    instance.monitored_mailbox_newjob.presence
  end

  def self.monitored_mailbox_newcase
    instance.monitored_mailbox_newcase.presence
  end

  def self.monitored_mailbox_docsort
    instance.monitored_mailbox_docsort.presence
  end

  # Get email config hash for API responses
  def self.email_config
    {
      internal_domains: internal_email_domains,
      monitored_mailboxes: {
        pay: monitored_mailbox_pay,
        newtask: monitored_mailbox_newtask,
        newjob: monitored_mailbox_newjob,
        newcase: monitored_mailbox_newcase,
        docsort: monitored_mailbox_docsort
      }
    }
  end

  # =============================================================================
  # Brand Colors (SSoT for UI Theming)
  # =============================================================================

  # Default brand colors (generic professional colors)
  # Tenant should configure their own brand colors via Settings > Company > Brand Colors
  # These are HSL values to match CSS variable format
  DEFAULT_BRAND_COLORS = {
    primary: "220 70% 50%",           # Professional blue
    primary_foreground: "0 0% 100%",  # White
    secondary: "0 0% 97%",            # Light gray
    muted: "0 0% 38%",                # Gray
    accent: "200 80% 50%"             # Accent blue
  }.freeze

  # Get brand colors for API responses and CSS injection
  # Returns HSL values ready for CSS variables
  def self.brand_colors
    setting = instance
    {
      primary: setting.brand_color_primary.presence || DEFAULT_BRAND_COLORS[:primary],
      primaryForeground: setting.brand_color_primary_foreground.presence || DEFAULT_BRAND_COLORS[:primary_foreground],
      secondary: setting.brand_color_secondary.presence || DEFAULT_BRAND_COLORS[:secondary],
      muted: setting.brand_color_muted.presence || DEFAULT_BRAND_COLORS[:muted],
      accent: setting.brand_color_accent.presence || DEFAULT_BRAND_COLORS[:accent]
    }
  end

  # Convert hex color to HSL string for CSS variables
  # Input: "#0c352d" or "0c352d"
  # Output: "161 63% 13%"
  def self.hex_to_hsl(hex)
    hex = hex.gsub("#", "")
    r = hex[0..1].to_i(16) / 255.0
    g = hex[2..3].to_i(16) / 255.0
    b = hex[4..5].to_i(16) / 255.0

    max = [r, g, b].max
    min = [r, g, b].min
    l = (max + min) / 2.0

    if max == min
      h = s = 0.0
    else
      d = max - min
      s = l > 0.5 ? d / (2.0 - max - min) : d / (max + min)
      h = case max
          when r then ((g - b) / d + (g < b ? 6 : 0)) / 6.0
          when g then ((b - r) / d + 2) / 6.0
          when b then ((r - g) / d + 4) / 6.0
          end
    end

    "#{(h * 360).round} #{(s * 100).round}% #{(l * 100).round}%"
  end

  # Convert HSL string back to hex color
  # Input: "161 63% 13%" (HSL format from CSS variables)
  # Output: "#0c352d"
  def self.hsl_to_hex(hsl_string)
    return nil if hsl_string.blank?

    # Parse "161 63% 13%" format
    match = hsl_string.match(/(\d+)\s+(\d+)%\s+(\d+)%/)
    return nil unless match

    h = match[1].to_f / 360.0
    s = match[2].to_f / 100.0
    l = match[3].to_f / 100.0

    if s == 0
      r = g = b = l
    else
      q = l < 0.5 ? l * (1 + s) : l + s - l * s
      p = 2 * l - q
      r = hue_to_rgb(p, q, h + 1.0/3.0)
      g = hue_to_rgb(p, q, h)
      b = hue_to_rgb(p, q, h - 1.0/3.0)
    end

    "#%02x%02x%02x" % [(r * 255).round, (g * 255).round, (b * 255).round]
  end

  # Helper for HSL to RGB conversion
  def self.hue_to_rgb(p, q, t)
    t += 1 if t < 0
    t -= 1 if t > 1
    return p + (q - p) * 6 * t if t < 1.0/6.0
    return q if t < 1.0/2.0
    return p + (q - p) * (2.0/3.0 - t) * 6 if t < 2.0/3.0
    p
  end

  # Get brand colors in HEX format (for email signatures, PDFs, etc.)
  # Returns hex values like "#0c352d"
  def self.brand_colors_hex
    setting = instance
    {
      primary: hsl_to_hex(setting.brand_color_primary) || "#1a3c34",
      primaryForeground: hsl_to_hex(setting.brand_color_primary_foreground) || "#ffffff",
      secondary: hsl_to_hex(setting.brand_color_secondary) || "#64748b",
      muted: hsl_to_hex(setting.brand_color_muted) || "#f1f5f9",
      accent: hsl_to_hex(setting.brand_color_accent) || "#0ea5e9"
    }
  end

  # Update brand colors from hex values (for API convenience)
  def self.update_brand_colors_from_hex(colors)
    updates = {}
    updates[:brand_color_primary] = hex_to_hsl(colors[:primary]) if colors[:primary].present?
    updates[:brand_color_primary_foreground] = hex_to_hsl(colors[:primaryForeground]) if colors[:primaryForeground].present?
    updates[:brand_color_secondary] = hex_to_hsl(colors[:secondary]) if colors[:secondary].present?
    updates[:brand_color_muted] = hex_to_hsl(colors[:muted]) if colors[:muted].present?
    updates[:brand_color_accent] = hex_to_hsl(colors[:accent]) if colors[:accent].present?

    instance.update!(updates) if updates.any?
  end

  # =============================================================================
  # Link Expiry Configuration (SSoT)
  # =============================================================================

  # Default expiry for presigned download URLs (in days)
  DEFAULT_LINK_EXPIRY_DAYS = 7

  # Get link expiry duration in days
  # Used for presigned URLs sent to external parties (zip downloads, document shares)
  def self.link_expiry_days
    instance.link_expiry_days.presence || DEFAULT_LINK_EXPIRY_DAYS
  end

  # Get link expiry duration in seconds (for presigned URL generation)
  def self.link_expiry_seconds
    link_expiry_days.days.to_i
  end

  # =============================================================================
  # API Environment Methods (SSoT)
  # =============================================================================

  # Get the current API environment setting (defaults to 'production')
  def self.api_environment
    instance.api_environment.presence || "production"
  end

  # Get the API URL for the current environment
  # Used in login response to direct frontend to correct backend
  def self.api_url
    API_ENVIRONMENT_URLS[api_environment] || API_ENVIRONMENT_URLS["production"]
  end

  # Get full API environment config for login response
  # In development mode, don't return redirect URLs but still return the company's environment
  def self.api_environment_config
    env = api_environment

    # In development: return the company's api_environment setting but skip redirect URLs
    # This way the badge shows the correct environment, but we stay on localhost
    if Rails.env.development?
      {
        environment: env,
        api_url: nil,
        frontend_url: nil
      }
    # Dev Heroku apps (teeem-sam-dev, teeem-rob-dev) should not redirect
    # They're for isolated testing and shouldn't route to other environments
    elsif ENV["HEROKU_APP_NAME"]&.include?("-dev")
      {
        environment: "dev",
        api_url: nil,
        frontend_url: nil
      }
    else
      {
        environment: env,
        api_url: API_ENVIRONMENT_URLS[env] || API_ENVIRONMENT_URLS["production"],
        frontend_url: FRONTEND_ENVIRONMENT_URLS[env] || FRONTEND_ENVIRONMENT_URLS["production"]
      }
    end
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

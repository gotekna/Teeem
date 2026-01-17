class CorporateCompanySetting < ApplicationRecord
  # Encrypt sensitive credentials (SSoT pattern from MicrosoftCredential)
  encrypts :twilio_auth_token

  # ========================================
  # API Environment Configuration (SSoT)
  # ========================================
  # Allows company-wide backend environment selection.
  # Production backend is the "router" - stores all companies' env preferences.
  # Returns appropriate api_url on login.
  VALID_API_ENVIRONMENTS = %w[production beta staging].freeze

  API_ENVIRONMENT_URLS = {
    "production" => "https://teeem-production-cb7898c69bd3.herokuapp.com",
    "beta" => "https://teeem-beta-6e3e9cb59225.herokuapp.com",
    "staging" => "https://teeem-staging-d60a657ed68a.herokuapp.com"
  }.freeze

  # Validations
  validates :company_name, presence: true
  validates :api_environment, inclusion: { in: VALID_API_ENVIRONMENTS }, allow_nil: true

  # Singleton pattern - only one company settings record should exist
  def self.instance
    first_or_create!(
      company_name: "Tekna Homes",
      abn: "TBD",
      gst_number: "TBD",
      email: "info@teknahomes.com.au",
      phone: "TBD",
      address: "TBD",
      timezone: "Australia/Brisbane",
      working_days: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: true
      }
    )
  end

  # Get today's date in the company timezone
  def self.today
    Time.use_zone(instance.timezone || "Australia/Brisbane") do
      Time.zone.today
    end
  end

  # Get current time in the company timezone
  def self.now
    Time.use_zone(instance.timezone || "Australia/Brisbane") do
      Time.zone.now
    end
  end

  # Execute block in company timezone (SSoT for timezone operations)
  # Usage: CorporateCompanySetting.in_company_timezone { Date.today }
  def self.in_company_timezone(&block)
    Time.use_zone(instance.timezone || "Australia/Brisbane", &block)
  end

  # Get the company timezone string (SSoT)
  def self.timezone
    instance.timezone || "Australia/Brisbane"
  end

  # Check if a date is a working day (respects working_days config)
  def self.working_day?(date)
    settings = instance
    working_days = settings.working_days || default_working_days
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

  # Get base path for document storage by scope
  # SSoT: Uses sharepoint_* columns (not legacy *_documents_base_path columns)
  # The sharepoint_* columns are THE SSoT - configured at /admin/system/entity-config/sharepoint_config
  def self.base_path_for_scope(scope)
    setting = instance
    storage_config = StorageConfiguration.instance
    case scope.to_s
    when "company", "both"
      setting.sharepoint_company_path.presence || storage_config&.path_for(:corporate) || "Corporate"
    when "people"
      setting.sharepoint_people_path.presence || storage_config&.path_for(:people) || "Corporate/People"
    when "job"
      setting.sharepoint_jobs_path.presence || storage_config&.path_for(:job) || "Jobs"
    else
      raise ArgumentError, "Unknown scope: #{scope}"
    end
  end

  # Convenience methods for accessing document base paths
  def self.company_documents_base_path
    base_path_for_scope("company")
  end

  def self.people_documents_base_path
    base_path_for_scope("people")
  end

  def self.job_documents_base_path
    base_path_for_scope("job")
  end

  # ========================================
  # Template Resolution Utilities
  # ========================================

  # Resolve template placeholders with provided values
  # Used by EntityTab and DocumentMigrationJob
  def self.resolve_template(template, values)
    result = template.dup
    values.each do |key, value|
      result.gsub!("{{#{key}}}", value.to_s)
    end
    result
  end

  # ========================================
  # Team Email Domains (SSoT for Split Inbox)
  # ========================================

  # Get team email domains for split inbox "Team" category
  def self.team_email_domains
    instance.team_email_domains || []
  end

  # Update team email domains
  def self.update_team_email_domains(domains)
    normalized = domains.map { |d| d.to_s.downcase.strip }.reject(&:blank?)
    instance.update!(team_email_domains: normalized)
  end

  # ========================================
  # Corporate Entity Types (SSoT)
  # ========================================

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

  # ========================================
  # Email Configuration (SSoT)
  # ========================================

  # Default internal email domains (used if not configured)
  DEFAULT_INTERNAL_DOMAINS = %w[tekna.com.au teeem.au teeem.com].freeze

  # Get internal email domains as array
  # SSoT: Used for detecting internal vs external emails
  def self.internal_email_domains
    domains = instance.internal_email_domains.presence
    return DEFAULT_INTERNAL_DOMAINS if domains.blank?

    domains.split(",").map(&:strip).reject(&:blank?)
  end

  # Check if an email address is internal
  def self.internal_email?(email)
    return false if email.blank?

    domain = email.to_s.split("@").last&.downcase
    internal_email_domains.any? { |d| domain == d.downcase }
  end

  # Get internal domains formatted for SQL LIKE patterns
  # Returns: ["@tekna.com.au", "@teeem.au", "@teeem.com"]
  def self.internal_domain_patterns
    internal_email_domains.map { |d| "@#{d}" }
  end

  # Monitored mailbox addresses (SSoT)
  def self.monitored_mailbox_pay
    instance.monitored_mailbox_pay.presence || "Pay@tekna.com.au"
  end

  def self.monitored_mailbox_newtask
    instance.monitored_mailbox_newtask.presence || "newtask@tekna.com.au"
  end

  def self.monitored_mailbox_newjob
    instance.monitored_mailbox_newjob.presence || "newjob@tekna.com.au"
  end

  def self.monitored_mailbox_newcase
    instance.monitored_mailbox_newcase.presence || "newcase@tekna.com.au"
  end

  # Get email config hash for API responses
  def self.email_config
    {
      internal_domains: internal_email_domains,
      monitored_mailboxes: {
        pay: monitored_mailbox_pay,
        newtask: monitored_mailbox_newtask,
        newjob: monitored_mailbox_newjob,
        newcase: monitored_mailbox_newcase
      }
    }
  end

  # ========================================
  # Brand Colors (SSoT for UI Theming)
  # ========================================

  # Default brand colors (Tekna's colors as fallback)
  # These are HSL values to match CSS variable format
  DEFAULT_BRAND_COLORS = {
    primary: "161 63% 13%",           # #0c352d - Tekna dark teal
    primary_foreground: "0 0% 100%",  # #ffffff - White
    secondary: "0 0% 97%",            # #f8f8f8 - Light gray
    muted: "0 0% 38%",                # #616161 - Gray
    accent: "40 11% 77%"              # #cbc9c0 - Beige/tan
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

  # ========================================
  # API Environment Methods (SSoT)
  # ========================================

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
  def self.api_environment_config
    env = api_environment
    {
      environment: env,
      api_url: API_ENVIRONMENT_URLS[env] || API_ENVIRONMENT_URLS["production"]
    }
  end

  private

  def self.default_working_days
    {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: true
    }
  end
end

class CorporateCompanySetting < ApplicationRecord
  # Encrypt sensitive credentials (SSoT pattern from MicrosoftCredential)
  encrypts :twilio_auth_token

  # Validations
  validates :company_name, presence: true

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
  # SharePoint Configuration (DEPRECATED)
  # ========================================
  #
  # DEPRECATION NOTICE: These methods are deprecated.
  # Use StorageConfiguration instead:
  #
  #   config = StorageConfiguration.for_organization(Organization.first)
  #   config.site_id
  #   config.drive_id
  #   config.resolve_path(:job, JobCode: "J-001")
  #
  # These methods will be removed in a future release.
  # ========================================

  # DEPRECATED: Use StorageConfiguration.for_organization(org).site_id instead
  def self.sharepoint_configured?
    Rails.deprecator.warn(
      "CorporateCompanySetting.sharepoint_configured? is deprecated. " \
      "Use StorageConfiguration.for_organization(org).connected? instead."
    )
    setting = instance
    setting.sharepoint_site_id.present? && setting.sharepoint_drive_id.present?
  end

  # DEPRECATED: Use StorageConfiguration.for_organization(org).site_url instead
  def self.sharepoint_site_url
    Rails.deprecator.warn(
      "CorporateCompanySetting.sharepoint_site_url is deprecated. " \
      "Use StorageConfiguration.for_organization(org).site_url instead."
    )
    instance.sharepoint_site_url.presence
  end

  # DEPRECATED: Use StorageConfiguration.for_organization(org).path_for(scope) instead
  def self.sharepoint_full_path(scope)
    Rails.deprecator.warn(
      "CorporateCompanySetting.sharepoint_full_path is deprecated. " \
      "Use StorageConfiguration.for_organization(org).path_for(scope) instead."
    )
    setting = instance
    # SSoT: root_path now comes from StorageConfiguration
    root = StorageConfiguration.instance&.root_path.presence || ""
    sub_path = case scope.to_sym
               when :jobs, :job
                 setting.sharepoint_jobs_path.presence || "Jobs"
               when :tasks, :task
                 setting.sharepoint_tasks_path.presence || "Tasks"
               when :people
                 setting.sharepoint_people_path.presence || "Corporate/People"
               when :company
                 setting.sharepoint_company_path.presence || "Corporate"
               when :contacts
                 setting.sharepoint_contacts_path.presence || "Contacts"
               else
                 raise ArgumentError, "Unknown SharePoint scope: #{scope}"
               end

    # Combine root and sub-path, ensuring no double slashes
    "#{root.chomp('/')}/#{sub_path.sub(/^\//, '')}"
  end

  # DEPRECATED: Use StorageConfiguration.for_organization(org).to_config_hash instead
  def self.sharepoint_config
    Rails.deprecator.warn(
      "CorporateCompanySetting.sharepoint_config is deprecated. " \
      "Use StorageConfiguration.for_organization(org).to_config_hash instead."
    )
    setting = instance
    config = StorageConfiguration.instance
    {
      configured: setting.sharepoint_site_id.present? && setting.sharepoint_drive_id.present?,
      site_url: setting.sharepoint_site_url,
      site_id: setting.sharepoint_site_id,
      drive_id: setting.sharepoint_drive_id,
      drive_name: setting.sharepoint_drive_name,
      # SSoT: root_path now comes from StorageConfiguration
      root_path: StorageConfiguration.instance&.root_path.presence || "",
      paths: {
        jobs: setting.sharepoint_jobs_path.presence || "Jobs",
        tasks: setting.sharepoint_tasks_path.presence || "Tasks",
        people: setting.sharepoint_people_path.presence || "Corporate/People",
        company: setting.sharepoint_company_path.presence || "Corporate",
        contacts: setting.sharepoint_contacts_path.presence || "Contacts"
      },
      # SSoT: Templates now come from StorageConfiguration
      templates: {
        job: config.template_for(:job) || "{{JobCode}}/{{Category}}",
        task: config.template_for(:task) || "Task-{{TaskId}}/{{Category}}",
        company: config.template_for(:corporate_entity) || "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
        people: config.template_for(:people) || "{{ContactName}}/{{Category}}",
        contacts: config.template_for(:contacts) || "{{ContactName}}/{{Category}}"
      }
    }
  end

  # ========================================
  # SharePoint Path Resolution (DEPRECATED)
  # ========================================
  #
  # DEPRECATION NOTICE: These methods are deprecated.
  # Use StorageConfiguration instead:
  #
  #   config = StorageConfiguration.for_organization(Organization.first)
  #   config.job_path(job_code, category)
  #   config.contacts_path(contact_name, category)
  #   config.resolve_path(:job, JobCode: "J-001", Category: "Plans")
  #
  # These methods will be removed in a future release.
  # ========================================

  # DEPRECATED: Use EntityTab.find_by(scope: scope).storage_folder_path instead
  # SSoT: EntityTab owns folder paths, StorageConfiguration owns templates
  def self.sharepoint_template(scope)
    Rails.deprecator.warn(
      "CorporateCompanySetting.sharepoint_template is deprecated. " \
      "SSoT: Use StorageConfiguration.instance.template_for(scope)."
    )
    config = StorageConfiguration.instance
    case scope.to_sym
    when :jobs, :job
      config.template_for(:job) || "{{JobCode}}/{{Category}}"
    when :tasks, :task
      config.template_for(:task) || "Task-{{TaskId}}/{{Category}}"
    when :people
      config.template_for(:people) || "{{ContactName}}/{{Category}}"
    when :company
      config.template_for(:corporate_entity) || "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}"
    when :contacts
      config.template_for(:contacts) || "{{ContactName}}/{{Category}}"
    else
      raise ArgumentError, "Unknown SharePoint scope: #{scope}"
    end
  end

  # DEPRECATED: Use StorageConfiguration.for_organization(org).job_path(job_code, category) instead
  def self.job_path(job_code, category = nil)
    Rails.deprecator.warn(
      "CorporateCompanySetting.job_path is deprecated. " \
      "Use StorageConfiguration.for_organization(org).job_path(job_code, category) instead."
    )
    base = sharepoint_full_path(:jobs)
    template = sharepoint_template(:job)
    resolved = resolve_template(template, {
      "JobCode" => job_code,
      "Category" => category || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # DEPRECATED: Use StorageConfiguration.for_organization(org).task_path(task_id, category) instead
  def self.task_path(task_id, category = nil)
    Rails.deprecator.warn(
      "CorporateCompanySetting.task_path is deprecated. " \
      "Use StorageConfiguration.for_organization(org).task_path(task_id, category) instead."
    )
    base = sharepoint_full_path(:tasks)
    template = sharepoint_template(:task)
    resolved = resolve_template(template, {
      "TaskId" => task_id.to_s,
      "Category" => category || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # DEPRECATED: Use StorageConfiguration.for_organization(org).corporate_path(...) instead
  def self.company_path(company_group: nil, company_code: nil, tab_name: nil)
    Rails.deprecator.warn(
      "CorporateCompanySetting.company_path is deprecated. " \
      "Use StorageConfiguration.for_organization(org).corporate_path(...) instead."
    )
    base = sharepoint_full_path(:company)
    template = sharepoint_template(:company)
    resolved = resolve_template(template, {
      "CompanyGroup" => company_group || "",
      "CompanyCode" => company_code || "",
      "TabName" => tab_name || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # DEPRECATED: Use StorageConfiguration.for_organization(org).people_path(name, category) instead
  def self.people_path(contact_name, category = nil)
    Rails.deprecator.warn(
      "CorporateCompanySetting.people_path is deprecated. " \
      "Use StorageConfiguration.for_organization(org).people_path(name, category) instead."
    )
    base = sharepoint_full_path(:people)
    template = sharepoint_template(:people)
    resolved = resolve_template(template, {
      "ContactName" => contact_name,
      "Category" => category || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # DEPRECATED: Use StorageConfiguration.for_organization(org).contacts_path(name, category) instead
  def self.contacts_path(contact_name, category = nil)
    Rails.deprecator.warn(
      "CorporateCompanySetting.contacts_path is deprecated. " \
      "Use StorageConfiguration.for_organization(org).contacts_path(name, category) instead."
    )
    base = sharepoint_full_path(:contacts)
    template = sharepoint_template(:contacts)
    resolved = resolve_template(template, {
      "ContactName" => contact_name,
      "Category" => category || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # Resolve template placeholders with provided values
  def self.resolve_template(template, values)
    result = template.dup
    values.each do |key, value|
      result.gsub!("{{#{key}}}", value.to_s)
    end
    result
  end

  # Clean path - remove double slashes and trailing slashes
  def self.clean_path(path)
    path.gsub(/\/+/, "/").chomp("/")
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

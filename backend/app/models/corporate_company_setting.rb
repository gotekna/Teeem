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
    case scope.to_s
    when "company", "both"
      setting.sharepoint_company_path.presence || "Corporate"
    when "people"
      setting.sharepoint_people_path.presence || "Corporate/People"
    when "job"
      setting.sharepoint_jobs_path.presence || "Jobs"
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
  # SharePoint Configuration (SSoT)
  # ========================================

  # Check if SharePoint is configured
  def self.sharepoint_configured?
    setting = instance
    setting.sharepoint_site_id.present? && setting.sharepoint_drive_id.present?
  end

  # Get SharePoint site URL
  # SSoT: Returns configured URL or nil - no hardcoded fallbacks
  def self.sharepoint_site_url
    instance.sharepoint_site_url.presence
  end

  # Get full path for a document scope
  # Returns: "/Jobs" for scope: :jobs
  # SSoT: All paths come from database - NO HARDCODED FALLBACKS
  def self.sharepoint_full_path(scope)
    setting = instance
    root = setting.sharepoint_root_path.presence || ""
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

  # Get SharePoint config hash for API responses
  # SSoT: Returns actual database values - frontend handles empty states
  def self.sharepoint_config
    setting = instance
    {
      configured: sharepoint_configured?,
      site_url: setting.sharepoint_site_url,
      site_id: setting.sharepoint_site_id,
      drive_id: setting.sharepoint_drive_id,
      drive_name: setting.sharepoint_drive_name,
      root_path: setting.sharepoint_root_path.presence || "",
      paths: {
        jobs: setting.sharepoint_jobs_path.presence || "Jobs",
        tasks: setting.sharepoint_tasks_path.presence || "Tasks",
        people: setting.sharepoint_people_path.presence || "Corporate/People",
        company: setting.sharepoint_company_path.presence || "Corporate",
        contacts: setting.sharepoint_contacts_path.presence || "Contacts"
      },
      templates: {
        job: setting.sharepoint_job_template.presence || "{{JobCode}}/{{Category}}",
        task: setting.sharepoint_task_template.presence || "Task-{{TaskId}}/{{Category}}",
        company: setting.sharepoint_company_template.presence || "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
        people: setting.sharepoint_people_template.presence || "{{ContactName}}/{{Category}}",
        contacts: setting.sharepoint_contacts_template.presence || "{{ContactName}}/{{Category}}"
      }
    }
  end

  # ========================================
  # SharePoint Path Resolution (SSoT)
  # ========================================

  # Get template for a scope
  def self.sharepoint_template(scope)
    setting = instance
    case scope.to_sym
    when :jobs, :job
      setting.sharepoint_job_template.presence || "{{JobCode}}/{{Category}}"
    when :tasks, :task
      setting.sharepoint_task_template.presence || "Task-{{TaskId}}/{{Category}}"
    when :people
      setting.sharepoint_people_template.presence || "{{ContactName}}/{{Category}}"
    when :company
      setting.sharepoint_company_template.presence || "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}"
    when :contacts
      setting.sharepoint_contacts_template.presence || "{{ContactName}}/{{Category}}"
    else
      raise ArgumentError, "Unknown SharePoint scope: #{scope}"
    end
  end

  # Resolve a full path for a job document
  # Returns: "/Jobs/JOB-001/Plans"
  def self.job_path(job_code, category = nil)
    base = sharepoint_full_path(:jobs)
    template = sharepoint_template(:job)
    resolved = resolve_template(template, {
      "JobCode" => job_code,
      "Category" => category || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # Resolve a full path for a standalone task document (tasks without a job)
  # Returns: "/Tasks/Task-123/Responses"
  def self.task_path(task_id, category = nil)
    base = sharepoint_full_path(:tasks)
    template = sharepoint_template(:task)
    resolved = resolve_template(template, {
      "TaskId" => task_id.to_s,
      "Category" => category || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # Resolve a full path for a company document
  # Returns: "/Corporate/GroupName/COMP-001/TabName"
  def self.company_path(company_group: nil, company_code: nil, tab_name: nil)
    base = sharepoint_full_path(:company)
    template = sharepoint_template(:company)
    resolved = resolve_template(template, {
      "CompanyGroup" => company_group || "",
      "CompanyCode" => company_code || "",
      "TabName" => tab_name || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # Resolve a full path for a people document
  # Returns: "/Corporate/People/John Smith/Contracts"
  def self.people_path(contact_name, category = nil)
    base = sharepoint_full_path(:people)
    template = sharepoint_template(:people)
    resolved = resolve_template(template, {
      "ContactName" => contact_name,
      "Category" => category || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # Resolve a full path for a contact document
  def self.contacts_path(contact_name, category = nil)
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

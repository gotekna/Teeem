class CorporateCompanySetting < ApplicationRecord
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
  def self.base_path_for_scope(scope)
    setting = instance
    case scope.to_s
    when "company", "both"
      setting.company_documents_base_path.presence || "00 TEEEM PRIVATE"
    when "people"
      setting.people_documents_base_path.presence || "teeem/Corporate/People"
    when "job"
      setting.job_documents_base_path.presence || "TEEEM Jobs"
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
  def self.sharepoint_site_url
    instance.sharepoint_site_url.presence || "https://gotekna.sharepoint.com/sites/TEEEM"
  end

  # Get full path for a document scope
  # Returns: "/Shared Documents/TEEEM Jobs" for scope: :jobs
  def self.sharepoint_full_path(scope)
    setting = instance
    root = setting.sharepoint_root_path.presence || "/Shared Documents"
    sub_path = case scope.to_sym
               when :jobs, :job
                 setting.sharepoint_jobs_path.presence || "TEEEM Jobs"
               when :people
                 setting.sharepoint_people_path.presence || "Corporate/People"
               when :company
                 setting.sharepoint_company_path.presence || "00 TEEEM PRIVATE"
               when :contacts
                 setting.sharepoint_contacts_path.presence || "Contacts"
               else
                 raise ArgumentError, "Unknown SharePoint scope: #{scope}"
               end

    # Combine root and sub-path, ensuring no double slashes
    "#{root.chomp('/')}/#{sub_path.sub(/^\//, '')}"
  end

  # Get SharePoint config hash for API responses
  def self.sharepoint_config
    setting = instance
    {
      configured: sharepoint_configured?,
      site_url: setting.sharepoint_site_url,
      site_id: setting.sharepoint_site_id,
      drive_id: setting.sharepoint_drive_id,
      drive_name: setting.sharepoint_drive_name,
      root_path: setting.sharepoint_root_path.presence || "/Shared Documents",
      paths: {
        jobs: setting.sharepoint_jobs_path.presence || "TEEEM Jobs",
        people: setting.sharepoint_people_path.presence || "Corporate/People",
        company: setting.sharepoint_company_path.presence || "00 TEEEM PRIVATE",
        contacts: setting.sharepoint_contacts_path.presence || "Contacts"
      },
      templates: {
        job: setting.sharepoint_job_template.presence || "{{JobCode}}/{{Category}}",
        company: setting.sharepoint_company_template.presence || "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}",
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
    when :people
      setting.sharepoint_people_template.presence || "{{ContactName}}/{{Category}}"
    when :company
      setting.sharepoint_company_template.presence || "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}"
    when :contacts
      setting.sharepoint_contacts_template.presence || "{{ContactName}}/{{Category}}"
    else
      raise ArgumentError, "Unknown SharePoint scope: #{scope}"
    end
  end

  # Resolve a full path for a job document
  # Returns: "/Shared Documents/TEEEM Jobs/JOB-001/Plans"
  def self.job_path(job_code, category = nil)
    base = sharepoint_full_path(:jobs)
    template = sharepoint_template(:job)
    resolved = resolve_template(template, {
      "JobCode" => job_code,
      "Category" => category || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # Resolve a full path for a company document
  # Returns: "/Shared Documents/00 TEEEM PRIVATE/GroupName/COMP-001/Folder"
  def self.company_path(company_group: nil, company_code: nil, folder: nil)
    base = sharepoint_full_path(:company)
    template = sharepoint_template(:company)
    resolved = resolve_template(template, {
      "CompanyGroup" => company_group || "",
      "CompanyCode" => company_code || "",
      "Folder" => folder || ""
    })
    clean_path("#{base}/#{resolved}")
  end

  # Resolve a full path for a people document
  # Returns: "/Shared Documents/Corporate/People/John Smith/Contracts"
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

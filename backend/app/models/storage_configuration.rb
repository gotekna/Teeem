# frozen_string_literal: true

# StorageConfiguration - SSoT for all document storage configuration
#
# This is THE ONE place for:
# - Which storage provider to use (SharePoint, S3, Wasabi, local)
# - Connection config (site IDs, buckets, endpoints)
# - Path configuration for all document scopes
# - Path templates with placeholders
#
# Previously this config was scattered across:
# - CorporateCompanySetting (sharepoint_* columns)
# - MicrosoftCredential (sharepoint_site_id, sharepoint_drive_id)
# - Organization (document_provider)
#
# Usage:
#   config = StorageConfiguration.for_organization(org)
#   config.resolve_path(:job, JobCode: "J-001", Category: "Plans")
#   # => "/Shared Documents/Jobs/J-001/Plans"
#
#   config.resolve_path(:contacts, ContactName: "ATO", Category: "BILLS")
#   # => "/Shared Documents/Contacts/ATO/BILLS"
#
class StorageConfiguration < ApplicationRecord
  # Associations
  belongs_to :organization
  belongs_to :credential, polymorphic: true, optional: true

  # Provider types - what storage backend to use
  PROVIDER_TYPES = %w[sharepoint s3 wasabi local].freeze

  # Connection statuses
  STATUSES = %w[disconnected connected error].freeze

  # Default paths for each scope
  DEFAULT_PATHS = {
    "jobs" => "Jobs",
    "corporate" => "Corporate",
    "people" => "People",
    "contacts" => "Contacts",
    "tasks" => "Tasks",
    "accounts" => "Accounts",
    "emails" => "Emails"
  }.freeze

  # Default templates for each scope
  DEFAULT_TEMPLATES = {
    "job" => "{{JobCode}}/{{Category}}",
    "corporate" => "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}",
    "people" => "{{ContactName}}/{{Category}}",
    "contacts" => "{{ContactName}}/{{Category}}",
    "task" => "Task-{{TaskId}}/{{Category}}",
    "account" => "{{Source}}/{{ContactName}}/{{Category}}"
  }.freeze

  # Validations
  validates :organization, presence: true, uniqueness: true
  validates :provider_type, presence: true, inclusion: { in: PROVIDER_TYPES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :root_path, presence: true
  validates :paths, presence: true
  validates :templates, presence: true

  # Scopes
  scope :connected, -> { where(status: "connected") }
  scope :for_provider, ->(type) { where(provider_type: type) }

  # ========================================
  # Class Methods
  # ========================================

  # Get storage configuration for an organization
  # SSoT: This is THE ONE way to get storage config
  def self.for_organization(org)
    find_by(organization: org) || create_default_for(org)
  end

  # Singleton accessor for single-tenant systems
  def self.instance
    first || create_default_for(Organization.first)
  end

  # Create default configuration for an organization
  def self.create_default_for(org)
    return nil unless org

    create!(
      organization: org,
      provider_type: org.document_provider || "sharepoint",
      status: "disconnected",
      root_path: "/Shared Documents",
      paths: DEFAULT_PATHS,
      templates: DEFAULT_TEMPLATES
    )
  rescue ActiveRecord::RecordNotUnique
    # Handle race condition
    find_by(organization: org)
  end

  # ========================================
  # Path Resolution (SSoT)
  # ========================================

  # Resolve a full path for any document scope
  #
  # @param scope [Symbol, String] The document scope (:job, :contacts, :corporate, etc.)
  # @param values [Hash] Placeholder values to substitute in template
  # @return [String] The resolved full path
  #
  # Examples:
  #   resolve_path(:job, JobCode: "J-001", Category: "Plans")
  #   # => "/Shared Documents/Jobs/J-001/Plans"
  #
  #   resolve_path(:contacts, ContactName: "ATO", Category: "BILLS")
  #   # => "/Shared Documents/Contacts/ATO/BILLS"
  #
  def resolve_path(scope, **values)
    scope_key = scope.to_s
    base_path = path_for(scope_key)
    template = template_for(scope_key)

    # Resolve template placeholders
    resolved = resolve_template(template, values)

    # Build full path
    parts = [root_path, base_path, resolved].reject(&:blank?)
    File.join(*parts)
  end

  # Get base path for a scope (without template resolution)
  #
  # @param scope [String, Symbol] The scope name
  # @return [String] The base path for that scope
  #
  # Note: Handles both singular (job) and plural (jobs) scope names
  #
  def path_for(scope)
    key = scope.to_s
    # Try exact match, then plural, then singular
    paths[key] ||
      paths["#{key}s"] ||
      paths[key.chomp("s")] ||
      DEFAULT_PATHS[key] ||
      DEFAULT_PATHS["#{key}s"] ||
      key.titleize
  end

  # Get template for a scope
  #
  # @param scope [String, Symbol] The scope name
  # @return [String] The template string with placeholders
  #
  def template_for(scope)
    templates[scope.to_s] || DEFAULT_TEMPLATES[scope.to_s] || "{{Name}}"
  end

  # Resolve template placeholders with provided values
  #
  # @param template [String] Template with {{Placeholder}} syntax
  # @param values [Hash] Key-value pairs to substitute
  # @return [String] Resolved template
  #
  def resolve_template(template, values)
    result = template.dup

    values.each do |key, value|
      # Support both symbol and string keys
      placeholder = "{{#{key}}}"
      result.gsub!(placeholder, value.to_s) if result.include?(placeholder)
    end

    # Remove any unresolved placeholders
    result.gsub(/\{\{[^}]+\}\}/, "").gsub(%r{//+}, "/").gsub(%r{/$}, "")
  end

  # ========================================
  # Full Path Methods (Convenience)
  # ========================================

  # Get full path for a job document
  def job_path(job_code, category = nil)
    resolve_path(:job, JobCode: job_code, Category: category)
  end

  # Get full path for a contact document
  def contacts_path(contact_name, category = nil)
    resolve_path(:contacts, ContactName: contact_name, Category: category)
  end

  # Get full path for a corporate document
  def corporate_path(company_group: nil, company_code: nil, folder: nil)
    resolve_path(:corporate, CompanyGroup: company_group, CompanyCode: company_code, Folder: folder)
  end

  # Get full path for a people document
  def people_path(contact_name, category = nil)
    resolve_path(:people, ContactName: contact_name, Category: category)
  end

  # Get full path for a task document
  def task_path(task_id, category = nil)
    resolve_path(:task, TaskId: task_id, Category: category)
  end

  # Get full path for an account document (Xero/MYOB/QuickBooks)
  def account_path(source, contact_name, category = nil)
    resolve_path(:account, Source: source, ContactName: contact_name, Category: category)
  end

  # ========================================
  # Connection Config Accessors
  # ========================================

  # SharePoint-specific config
  def site_id
    connection_config["site_id"]
  end

  def drive_id
    connection_config["drive_id"]
  end

  def site_url
    connection_config["site_url"]
  end

  def drive_name
    connection_config["drive_name"]
  end

  # S3-specific config
  def endpoint
    connection_config["endpoint"]
  end

  def bucket
    connection_config["bucket"]
  end

  def region
    connection_config["region"]
  end

  # Update connection config
  def update_connection(new_config)
    update!(connection_config: connection_config.merge(new_config))
  end

  # Sync connection config from associated credential
  # Call this when credential changes or is first set up
  def sync_from_credential!
    return unless credential

    case credential
    when MicrosoftCredential
      update!(
        provider_type: "sharepoint",
        connection_config: connection_config.merge(
          "site_id" => credential.sharepoint_site_id,
          "drive_id" => credential.sharepoint_drive_id,
          "site_url" => credential.respond_to?(:site_url) ? credential.site_url : nil,
          "drive_name" => credential.respond_to?(:drive_name) ? credential.drive_name : "Shared Documents"
        ).compact,
        status: credential.connected? ? "connected" : "disconnected"
      )
    when S3CompatibleCredential
      update!(
        provider_type: credential.provider_type == "wasabi" ? "wasabi" : "s3",
        connection_config: connection_config.merge(
          "endpoint" => credential.endpoint,
          "bucket" => credential.bucket,
          "region" => credential.region
        ).compact,
        status: credential.status == "connected" ? "connected" : "disconnected"
      )
    end
  end

  # Get connection info for display (syncs from credential if empty)
  def effective_connection_info
    # If we have stored connection_config, use it
    return connection_config if connection_config.present? && connection_config.keys.any?

    # Otherwise, try to get from associated credential
    return {} unless credential

    case credential
    when MicrosoftCredential
      {
        "site_id" => credential.sharepoint_site_id,
        "drive_id" => credential.sharepoint_drive_id,
        "site_url" => credential.respond_to?(:site_url) ? credential.site_url : nil,
        "drive_name" => credential.respond_to?(:drive_name) ? credential.drive_name : "Shared Documents"
      }.compact
    when S3CompatibleCredential
      {
        "endpoint" => credential.endpoint,
        "bucket" => credential.bucket,
        "region" => credential.region
      }.compact
    else
      {}
    end
  end

  # ========================================
  # Provider Helpers
  # ========================================

  def sharepoint?
    provider_type == "sharepoint"
  end

  def s3?
    provider_type == "s3"
  end

  def wasabi?
    provider_type == "wasabi"
  end

  def local?
    provider_type == "local"
  end

  def connected?
    status == "connected"
  end

  def disconnected?
    status == "disconnected"
  end

  # ========================================
  # Provider Detection (SSoT: credentials are source of truth)
  # ========================================

  # Detect the actual provider from credentials
  # SSoT: Credentials determine which provider is active, not the stored provider_type
  def detected_provider_type
    s3_credential = S3CompatibleCredential.active.first rescue nil
    ms_credential = MicrosoftCredential.connected.first rescue nil

    if s3_credential&.status == "connected"
      s3_credential.provider_type == "wasabi" ? "wasabi" : "s3"
    elsif ms_credential&.status == "connected"
      "sharepoint"
    else
      provider_type # Fall back to stored value if no credentials
    end
  end

  # Detect if actually connected based on credentials
  def detected_connected?
    s3_credential = S3CompatibleCredential.active.first rescue nil
    ms_credential = MicrosoftCredential.connected.first rescue nil

    case detected_provider_type
    when "wasabi", "s3" then s3_credential&.status == "connected"
    when "sharepoint" then ms_credential&.status == "connected"
    else false
    end
  end

  # Get connection info from the active credential
  def detected_connection_info
    s3_credential = S3CompatibleCredential.active.first rescue nil
    ms_credential = MicrosoftCredential.connected.first rescue nil

    case detected_provider_type
    when "wasabi", "s3"
      return {} unless s3_credential
      {
        "endpoint" => s3_credential.endpoint,
        "bucket" => s3_credential.bucket,
        "region" => s3_credential.region
      }.compact
    when "sharepoint"
      return {} unless ms_credential
      {
        "site_url" => ms_credential.respond_to?(:site_url) ? ms_credential.site_url : nil,
        "site_id" => ms_credential.sharepoint_site_id,
        "drive_id" => ms_credential.sharepoint_drive_id,
        "drive_name" => ms_credential.respond_to?(:drive_name) ? ms_credential.drive_name : "Shared Documents"
      }.compact
    else
      {}
    end
  end

  # ========================================
  # Configuration Export (for API/UI)
  # ========================================

  # Returns config in format expected by SharePointTab.tsx frontend
  # SSoT: StorageConfiguration IS the source of truth for paths/templates
  # (Data migrated from CorporateCompanySetting via migration 20260112120003)
  def to_config_hash
    actual_provider = detected_provider_type
    actual_connected = detected_connected?
    actual_connection = detected_connection_info

    {
      configured: actual_connected,
      provider_type: actual_provider,
      status: actual_connected ? "connected" : "disconnected",
      # Connection details from active credential (flat, not nested)
      site_url: actual_connection["site_url"] || site_url,
      site_id: actual_connection["site_id"] || site_id,
      drive_id: actual_connection["drive_id"] || drive_id,
      drive_name: actual_connection["drive_name"] || drive_name,
      # S3/Wasabi details from active credential
      endpoint: actual_connection["endpoint"] || endpoint,
      bucket: actual_connection["bucket"] || bucket,
      region: actual_connection["region"] || region,
      # Paths - SSoT: StorageConfiguration is THE source of truth
      root_path: root_path,
      paths: paths,
      templates: templates
    }
  end
end

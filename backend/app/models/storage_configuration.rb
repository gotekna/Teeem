# frozen_string_literal: true

# StorageConfiguration - SSoT for storage CONNECTION configuration
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: provider_type is DERIVED from active credentials           ║
# ║                                                                   ║
# ║  The active credential (S3CompatibleCredential or                 ║
# ║  MicrosoftCredential) determines the provider, NOT the stored     ║
# ║  column. This prevents config drift when switching providers.     ║
# ║                                                                   ║
# ║  Priority:                                                        ║
# ║    1. S3CompatibleCredential.active.connected → wasabi/s3         ║
# ║    2. MicrosoftCredential.connected → sharepoint                  ║
# ║    3. Stored column (fallback only)                               ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# This model handles CONNECTION ONLY:
# - Which storage provider to use (SharePoint, S3, Wasabi, local)
# - Connection config (site IDs, buckets, endpoints)
# - Root path for the storage location
#
# FOLDER STRUCTURE is handled by EntityTab (SSoT for paths per tab)
# Each EntityTab defines its own storage_folder_path template.
#
# Usage:
#   config = StorageConfiguration.for_organization(org)
#   config.provider_type  # => "wasabi" (derived from active credential)
#   config.root_path      # => "/"
#   config.bucket         # => "teeem-docs"
#
class StorageConfiguration < ApplicationRecord
  # Associations
  belongs_to :organization
  belongs_to :credential, polymorphic: true, optional: true

  # Provider types - what storage backend to use
  PROVIDER_TYPES = %w[sharepoint s3 wasabi local].freeze

  # Connection statuses
  STATUSES = %w[disconnected connected error].freeze

  # SSoT: Base folder names for each scope
  # These match the Entity Config UI at /admin/system/entity-config/sharepoint_config
  # Only include scopes that are actually shown in Entity Config
  SCOPE_FOLDERS = {
    # Primary document scopes
    "job" => "Jobs",
    "corporate" => "Corporate",
    "people" => "Corporate/People",
    "contact" => "Contacts",
    # User scopes
    "users" => "Users",
    "user_photos" => "Users/Photos",
    "user_contracts" => "Users/Contracts",
    "my_docs" => "Users/MyDocs",
    # Email scopes
    "email" => "Emails/eml",
    "email_attachments" => "Emails/attachments",
    # Warehouse scopes
    "warehouse" => "Warehousing",
    "task" => "Tasks/Attachments",
    "task_responses" => "Tasks/Responses",
    "bill_inbox" => "Warehousing/BillInbox",
    "pricebook_photos" => "Warehousing/Pricebook Photos",
    "chat" => "Warehousing/Chat",
    "notes" => "Warehousing/Notes",
    "excel_documents" => "Warehousing/Excel",
    "word_documents" => "Warehousing/Word",
    "powerpoint_documents" => "Warehousing/PowerPoint",
    # Template scopes
    "templates" => "Warehousing/Templates",
    "bank_statements" => "Warehousing/Templates/Bank Statements",
    "contracts" => "Warehousing/Templates/Contracts",
    # Custom storage
    "custom" => "Documents",
    # System storage
    "active_storage" => "ActiveStorage"
  }.freeze

  # Validations
  # Note: provider_type is now DERIVED from active credentials (SSoT)
  # The stored column is just a fallback default, so we validate it exists but don't require it to be "correct"
  validates :organization, presence: true, uniqueness: true
  validate :stored_provider_type_valid
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :root_path, presence: true

  def stored_provider_type_valid
    stored = read_attribute(:provider_type)
    if stored.present? && !PROVIDER_TYPES.include?(stored)
      errors.add(:provider_type, "must be one of: #{PROVIDER_TYPES.join(', ')}")
    end
  end

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
      root_path: "/Shared Documents"
    )
  rescue ActiveRecord::RecordNotUnique
    # Handle race condition
    find_by(organization: org)
  end

  # ========================================
  # Scope Folder Lookup (for EntityTab)
  # ========================================

  # Get base folder name for a scope
  # SSoT: Reads from database column `scope_folders`, falls back to SCOPE_FOLDERS constant
  # Used by EntityTab.storage_base_path to build: root_path + scope_folder
  #
  # @param scope [String, Symbol] The scope name (job, corporate, contact, etc.)
  # @return [String] The folder name for that scope
  #
  # Examples:
  #   path_for(:job)        # => "Jobs"
  #   path_for(:corporate)  # => "Corporate"
  #   path_for(:contact)    # => "Contacts"
  #
  def path_for(scope)
    # SSoT: Database column first, then hardcoded fallback
    scope_folders&.dig(scope.to_s) || SCOPE_FOLDERS[scope.to_s] || scope.to_s.titleize
  end

  # Get all scope folders (for UI editing)
  def effective_scope_folders
    SCOPE_FOLDERS.merge(scope_folders || {})
  end

  # Default templates for path generation
  # SSoT: These are fallback defaults. EntityTab.storage_folder_path is the true SSoT.
  SCOPE_TEMPLATES = {
    "job" => "{{JobCode}}/{{TabName}}",
    "jobs" => "{{JobCode}}/{{TabName}}",
    "task" => "{{TaskId}}",
    "tasks" => "{{TaskId}}",
    "task_responses" => "{{TaskId}}",
    "corporate" => "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
    "corporate_entity" => "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
    "company" => "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
    "people" => "{{ContactName}}/{{TabName}}",
    "contact" => "{{ContactName}}/{{TabName}}",
    "contacts" => "{{ContactName}}/{{TabName}}",
    "account" => "{{Source}}/{{ContactName}}/{{Category}}",
    "accounts" => "{{Source}}/{{ContactName}}/{{Category}}",
    "email" => "{{Year}}/{{Month}}",
    "emails" => "{{Year}}/{{Month}}",
    # Warehouse document scopes
    "notes" => "{{UserName}}/{{Year}}",
    "excel_documents" => "{{UserName}}/{{Year}}",
    "word_documents" => "{{UserName}}/{{Year}}",
    "powerpoint_documents" => "{{UserName}}/{{Year}}"
  }.freeze

  # Get template for a scope
  # SSoT: Database `templates` column first, then hardcoded fallback
  # @param scope [String, Symbol] The scope name
  # @return [String] The template string for path generation
  def template_for(scope)
    # SSoT: Check database templates column first
    templates&.dig(scope.to_s).presence || SCOPE_TEMPLATES[scope.to_s] || "{{Name}}/{{Category}}"
  end

  # ========================================
  # Path Building Helpers
  # ========================================

  # Build full path for a job folder
  # @param job_code [String] The job code (e.g., "JOB-001")
  # @param subfolder [String] Optional subfolder within job (e.g., "Responses", "Task Attachments")
  # @return [String] Full path like "/Jobs/JOB-001/Responses"
  def job_path(job_code, subfolder = nil)
    # Use template from config (e.g., "{{JobCode}}/{{TabName}}")
    template = template_for(:job)
    resolved = template.gsub("{{JobCode}}", job_code.to_s)
    resolved = resolved.gsub("{{TabName}}", subfolder.to_s) if subfolder.present?
    # Remove any remaining template tokens if subfolder not provided
    resolved = resolved.gsub(/\/?\{\{[^\}]+\}\}/, "")
    base = File.join(root_path, path_for(:job), resolved)
    base
  end

  # Build full path for a standalone task folder
  # @param task_id [Integer, String] The task ID
  # @param subfolder [String] Optional subfolder within task (e.g., "Task Attachments")
  # @return [String] Full path like "/Tasks/123/Task Attachments"
  def task_path(task_id, subfolder = nil)
    # Use template from config (e.g., "{{TaskId}}" → "123")
    template = template_for(:task)
    resolved = template.gsub("{{TaskId}}", task_id.to_s)
    base = File.join(root_path, path_for(:task), resolved)
    subfolder.present? ? File.join(base, subfolder) : base
  end

  # Build full path for any scope with template substitution
  # @param scope [String, Symbol] The scope name (job, task, contact, etc.)
  # @param substitutions [Hash] Values to substitute in template (e.g., { JobCode: "JOB-001" })
  # @return [String] Full resolved path
  def resolve_path(scope, substitutions = {})
    base_folder = path_for(scope)
    template = template_for(scope)

    # Substitute template variables
    resolved = template.dup
    substitutions.each do |key, value|
      resolved.gsub!("{{#{key}}}", value.to_s)
    end

    File.join(root_path, base_folder, resolved)
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
  # Provider Type (SSoT: Derived from active credential)
  # ========================================

  # SSoT: provider_type is DERIVED from which credential is active
  # The stored column is only a fallback when no credentials exist
  def provider_type
    detected_provider_type
  end

  # Access the raw stored value (for migrations/debugging only)
  def stored_provider_type
    read_attribute(:provider_type)
  end

  # ========================================
  # Provider Helpers (use derived provider_type)
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

  # SSoT: connected? is DERIVED from active credential status
  def connected?
    detected_connected?
  end

  def disconnected?
    !connected?
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
  # SSoT: StorageConfiguration handles CONNECTION only
  # Folder paths are managed by EntityTab (Entity Configurator)
  def to_config_hash
    actual_provider = detected_provider_type
    actual_connected = detected_connected?
    actual_connection = detected_connection_info

    {
      configured: actual_connected,
      provider_type: actual_provider,
      status: actual_connected ? "connected" : "disconnected",
      # Connection details from active credential
      site_url: actual_connection["site_url"] || site_url,
      site_id: actual_connection["site_id"] || site_id,
      drive_id: actual_connection["drive_id"] || drive_id,
      drive_name: actual_connection["drive_name"] || drive_name,
      # S3/Wasabi details from active credential
      endpoint: actual_connection["endpoint"] || endpoint,
      bucket: actual_connection["bucket"] || bucket,
      region: actual_connection["region"] || region,
      # Root path and scope folders
      root_path: root_path,
      scope_folders: effective_scope_folders,
      # Templates for Entity Config auto-save
      scope_templates: templates || {},
      file_name_templates: file_name_templates || {},
      # Config links for scope folders (URL to external config page)
      config_links: config_links || {}
    }
  end
end

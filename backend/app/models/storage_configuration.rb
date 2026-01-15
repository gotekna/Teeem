# frozen_string_literal: true

# StorageConfiguration - SSoT for storage CONNECTION configuration
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: provider_type column IS THE ONE                            ║
# ║                                                                   ║
# ║  Whatever is stored in provider_type is THE provider.             ║
# ║  No detection, no fallbacks, no complexity.                       ║
# ║                                                                   ║
# ║  Providers: wasabi | s3 | sharepoint | local                      ║
# ║  Default: wasabi                                                  ║
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
  # SSoT: Only 3 types - consolidated Jan 2026
  # - sharepoint: Microsoft SharePoint/OneDrive (Graph API)
  # - s3_compatible: ALL S3-API storage (AWS S3, Wasabi, MinIO, Backblaze B2, etc.)
  # - local: Local filesystem storage
  PROVIDER_TYPES = %w[sharepoint s3_compatible local].freeze

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
    "task" => "Tasks",
    "task_attachments" => "Tasks",
    "task_responses" => "Tasks",
    "bill_inbox" => "Warehousing/BillInbox",
    "pricebook_photos" => "Warehousing/Pricebook Photos",
    "chat" => "Warehousing/Chat",
    "notes" => "Warehousing/Notes",
    "excel_documents" => "Warehousing/Excel",
    "word_documents" => "Warehousing/Word",
    "powerpoint_documents" => "Warehousing/PowerPoint",
    "pdf_documents" => "Warehousing/PDF",
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
  # SSoT: Uses org.document_provider - no hardcoded fallback
  def self.create_default_for(org)
    return nil unless org

    provider = org.document_provider
    return nil unless provider.present?

    # SSoT: Root path differs by provider
    # - SharePoint: /Shared Documents (Microsoft convention)
    # - S3/Wasabi/local: / (bucket root - bucket name is separate)
    root = case provider
           when "sharepoint" then "/Shared Documents"
           else "/" # S3, Wasabi, s3_compatible, local all use bucket/folder root
           end

    create!(
      organization: org,
      provider_type: provider,
      status: "disconnected",
      root_path: root
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
    "task_attachments" => "{{TaskId}}/Attachments",
    "task_responses" => "{{TaskId}}/Responses",
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
    "powerpoint_documents" => "{{UserName}}/{{Year}}",
    "pdf_documents" => "{{UserName}}/{{Year}}"
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
    # Use template from config (e.g., "{{JobCode}}/{{TabName}}" or "{{JobCode}}/{{Category}}")
    template = template_for(:job)
    resolved = template.gsub("{{JobCode}}", job_code.to_s)
    # Support both {{TabName}} and {{Category}} placeholders
    resolved = resolved.gsub("{{TabName}}", subfolder.to_s) if subfolder.present?
    resolved = resolved.gsub("{{Category}}", subfolder.to_s) if subfolder.present?
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

  # SSoT: Jobs root folder location (SharePoint folder ID where job folders are created)
  # This was previously stored in MicrosoftCredential (wrong) - now consolidated here
  def root_folder_id
    connection_config&.dig("root_folder_id")
  end

  def root_folder_id=(value)
    self.connection_config = (connection_config || {}).merge("root_folder_id" => value)
  end

  def root_folder_path
    connection_config&.dig("root_folder_path")
  end

  def root_folder_path=(value)
    self.connection_config = (connection_config || {}).merge("root_folder_path" => value)
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
        provider_type: "s3_compatible",
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
  # Provider Type (SSoT: Stored value is THE ONE)
  # ========================================

  # SSoT: provider_type is the stored column value - no detection/derivation
  # Whatever is configured is THE ONE provider
  # Fallback to s3_compatible for legacy records (handles old "wasabi"/"s3" values)
  def provider_type
    stored = read_attribute(:provider_type)
    case stored
    when "wasabi", "s3"
      "s3_compatible"  # Normalize legacy values
    when nil, ""
      "s3_compatible"  # Default
    else
      stored
    end
  end

  # ========================================
  # Provider Helpers
  # SSoT: Only 3 provider types - sharepoint, s3_compatible, local
  # ========================================

  def sharepoint?
    provider_type == "sharepoint"
  end

  def s3_compatible?
    provider_type == "s3_compatible"
  end

  def local?
    provider_type == "local"
  end

  # Legacy aliases for backwards compatibility during migration
  # TODO: Remove after all code updated to use s3_compatible?
  def s3?
    s3_compatible?
  end

  def wasabi?
    s3_compatible?
  end

  # SSoT: Check if a document's storage_provider matches the current provider
  # Documents store "s3_compatible" for S3/Wasabi, "sharepoint" for SharePoint
  # This is THE ONE method to check provider compatibility
  def document_in_current_provider?(doc_storage_provider)
    return false if doc_storage_provider.blank?

    case provider_type
    when "s3_compatible"
      # Legacy docs may have "wasabi" or "s3" - treat as s3_compatible
      %w[s3_compatible wasabi s3].include?(doc_storage_provider)
    when "sharepoint"
      doc_storage_provider == "sharepoint"
    when "local"
      doc_storage_provider == "local"
    else
      false
    end
  end

  # SSoT: Get the storage_provider values that match the current provider
  # Use this for filtering queries (includes legacy values for existing docs)
  def current_provider_storage_values
    case provider_type
    when "s3_compatible"
      %w[s3_compatible wasabi s3]  # Include legacy values
    when "sharepoint"
      %w[sharepoint]
    when "local"
      %w[local]
    else
      []
    end
  end

  # SSoT: Get the storage_provider value to use when CREATING new documents
  # This is THE ONE value to set on new JobDocument, CorporateCompanyDocument, etc.
  def storage_provider_for_new_documents
    case provider_type
    when "s3_compatible"
      "s3_compatible"
    when "sharepoint"
      "sharepoint"
    when "local"
      "local"
    else
      "s3_compatible"
    end
  end

  # SSoT: connected? checks the appropriate credential for the configured provider
  def connected?
    case provider_type
    when "s3_compatible"
      S3CompatibleCredential.active.first&.status == "connected"
    when "sharepoint"
      MicrosoftCredential.sharepoint_credential&.status == "connected"
    when "local"
      true  # Local storage is always "connected"
    else
      false
    end
  rescue StandardError
    false
  end

  def disconnected?
    !connected?
  end

  # ========================================
  # Warehouse Sync Settings
  # ========================================

  # Check if warehouse sync is enabled
  # SSoT: Controls whether documents auto-sync to S3 on save
  def warehouse_sync_enabled?
    # Only sync if connected to S3/Wasabi
    return false unless connected?
    return false unless %w[s3 wasabi].include?(provider_type)

    # Check the warehouse_sync_enabled flag (defaults to true if column doesn't exist)
    respond_to?(:warehouse_sync_enabled) ? warehouse_sync_enabled : true
  end

  # ========================================
  # SSoT: Warehouse Path Resolution
  # ========================================

  # SSoT: Resolve warehouse path for any document entity
  # This is THE ONE method for computing storage paths for:
  # - TeeemSpreadsheet, TeeemDocument, TeeemPresentation, TeeemPdf, NotebookPageAttachment
  #
  # @param entity [ActiveRecord] The document entity (must respond to :job, :user, :created_at)
  # @param scope [Symbol] The warehouse scope (:excel_documents, :word_documents, :powerpoint_documents, :notes, :pdf_documents)
  # @param tab_name [String] Optional tab name for job-attached documents (default: derived from scope)
  # @return [String] The resolved folder path
  #
  # Examples:
  #   resolve_warehouse_path(spreadsheet, :excel_documents)
  #   # Job attached: "Jobs/JOB-001/Excel"
  #   # No job:       "Warehousing/Excel/Robert Harder/2026"
  #
  def resolve_warehouse_path(entity, scope:, tab_name: nil)
    job = entity.respond_to?(:job) ? entity.job : nil
    user = entity.respond_to?(:user) ? entity.user : nil
    uploaded_by = entity.respond_to?(:uploaded_by) ? entity.uploaded_by : nil
    effective_user = user || uploaded_by
    created_at = entity.respond_to?(:created_at) ? entity.created_at : Time.current

    if job.present?
      # Job-attached: Use job folder structure
      # SSoT: EntityTab defines the folder name, but we use tab_name for document type
      effective_tab_name = tab_name || default_tab_name_for(scope)
      job_path(job.job_code, effective_tab_name)
    else
      # Standalone: Use warehousing folder structure
      # SSoT: StorageConfiguration.path_for + template_for
      resolve_path(scope, {
        UserName: effective_user&.name || "Unknown",
        Year: created_at&.year&.to_s || Time.current.year.to_s,
        Month: created_at&.strftime("%m") || Time.current.strftime("%m")
      })
    end
  end

  # Default tab name for each document scope (used when job-attached)
  def default_tab_name_for(scope)
    case scope.to_sym
    when :excel_documents then "Excel"
    when :word_documents then "Word"
    when :powerpoint_documents then "PowerPoint"
    when :pdf_documents then "PDF"
    when :notes then "Notes"
    else scope.to_s.titleize
    end
  end

  # ========================================
  # Document Routing (SSoT for document model selection)
  # ========================================

  # Default routing configuration (fallback when database doesn't have it)
  DEFAULT_DOCUMENT_ROUTING = {
    "xero_primary_invoice" => { "model" => "ContactDocument", "scope" => "contact", "description" => "Primary Xero invoice/bill PDF" },
    "xero_attachment" => { "model" => "CorporateCompanyDocument", "scope" => "corporate_entity", "description" => "Xero invoice/bill attachments" },
    "sharepoint_scan" => { "model" => "CorporateCompanyDocument", "scope" => "corporate_entity", "description" => "SharePoint scanned documents" },
    "email_attachment" => { "model" => "CorporateCompanyDocument", "scope" => "corporate_entity", "description" => "Email attachments" }
  }.freeze

  # SSoT: Get routing configuration for a document source
  # @param source [String, Symbol] The document source (xero_primary_invoice, xero_attachment, etc.)
  # @return [Hash] { "model" => "...", "scope" => "...", "description" => "..." }
  def routing_for(source)
    effective_document_routing[source.to_s] || DEFAULT_DOCUMENT_ROUTING[source.to_s]
  end

  # SSoT: Get the document model class for a source
  # @param source [String, Symbol] The document source
  # @return [Class] The ActiveRecord model class (ContactDocument, CorporateCompanyDocument, etc.)
  def document_model_for(source)
    routing = routing_for(source)
    return CorporateCompanyDocument unless routing # Default fallback

    model_name = routing["model"]
    model_name.constantize
  rescue NameError
    Rails.logger.warn("[StorageConfiguration] Unknown model '#{model_name}' for source '#{source}', falling back to CorporateCompanyDocument")
    CorporateCompanyDocument
  end

  # SSoT: Get the EntityTab scope for a source
  # @param source [String, Symbol] The document source
  # @return [String] The scope name (contact, corporate_entity, etc.)
  def document_scope_for(source)
    routing = routing_for(source)
    routing&.dig("scope") || "corporate_entity"
  end

  # Get effective document routing (database + defaults)
  def effective_document_routing
    DEFAULT_DOCUMENT_ROUTING.merge(document_routing || {})
  end

  # Update routing for a specific source
  def update_routing(source, model:, scope:, description: nil)
    new_routing = (document_routing || {}).merge(
      source.to_s => {
        "model" => model,
        "scope" => scope,
        "description" => description || "Custom routing"
      }
    )
    update!(document_routing: new_routing)
  end

  # ========================================
  # Configuration Export (for API/UI)
  # ========================================

  # Returns config in format expected by frontend
  # SSoT: provider_type is the stored value, connected? checks that provider's credential
  def to_config_hash
    {
      configured: connected?,
      provider_type: provider_type,
      status: connected? ? "connected" : "disconnected",
      # Connection details from connection_config
      site_url: site_url,
      site_id: site_id,
      drive_id: drive_id,
      drive_name: drive_name,
      endpoint: endpoint,
      bucket: bucket,
      region: region,
      # Root path and scope folders
      root_path: root_path,
      scope_folders: effective_scope_folders,
      # Templates for Entity Config auto-save
      scope_templates: templates || {},
      file_name_templates: file_name_templates || {},
      # Config links for scope folders (URL to external config page)
      config_links: config_links || {},
      # Document routing configuration (SSoT for model selection)
      document_routing: effective_document_routing
    }
  end
end

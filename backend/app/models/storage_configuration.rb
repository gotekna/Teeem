# frozen_string_literal: true

# StorageConfiguration - SSoT for storage CONNECTION configuration
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Tenant-Level Storage Configuration (Jan 2026)              ║
# ║                                                                   ║
# ║  StorageConfiguration belongs to TENANT (not Organization)        ║
# ║  One storage config per tenant = one S3 bucket per customer       ║
# ║                                                                   ║
# ║  provider_type column IS THE ONE - no detection/fallbacks         ║
# ║  Providers: sharepoint | s3_compatible | local                    ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# This model handles CONNECTION ONLY:
# - Which storage provider to use (SharePoint, S3, Wasabi, local)
# - Connection config (site IDs, buckets, endpoints)
# - Root path for the storage location
#
# FOLDER STRUCTURE is handled by EntityTab (SSoT for paths per tab)
# Each EntityTab defines its own warehouse_folder template.
#
# SSoT Hierarchy (Jan 2026 fix):
#   Tenant       → StorageConfiguration (one per tenant)
#   Organization → Credentials (Microsoft, S3, etc. - per SPV)
#
# Usage (SSoT - use for_tenant):
#   config = StorageConfiguration.for_tenant(tenant)
#   config.provider_type  # => "s3_compatible"
#   config.root_path      # => "/"
#   config.bucket         # => "teeem-docs"
#
# Deprecated (use for_tenant instead):
#   config = StorageConfiguration.for_organization(org)  # -> for_tenant(org.tenant)
#
class StorageConfiguration < ApplicationRecord
  # Associations
  # SSoT: StorageConfiguration belongs to TENANT (Jan 2026 fix)
  # Organization association deprecated but kept for backward compatibility
  belongs_to :tenant
  belongs_to :organization, optional: true  # DEPRECATED: Use tenant instead
  belongs_to :credential, polymorphic: true, optional: true

  # Provider types - what storage backend to use
  # SSoT: Only 3 types - consolidated Jan 2026
  # - sharepoint: Microsoft SharePoint/OneDrive (Graph API)
  # - s3_compatible: ALL S3-API storage (AWS S3, Wasabi, MinIO, Backblaze B2, etc.)
  # - local: Local filesystem storage
  PROVIDER_TYPES = %w[sharepoint s3_compatible local].freeze

  # Connection statuses
  STATUSES = %w[disconnected connected error].freeze

  # Warehouse types (SSoT - renamed from SCOPES)
  # Valid warehouse types that can have storage enabled
  # SSoT: 'contact' is THE ONE for all individuals (Jan 2026 - 'people' merged into 'contact')
  # SSoT: 'user' is for personal user documents (My Docs feature - Jan 2026)
  # SSoT: All valid warehouse types for File Warehouse
  WAREHOUSE_TYPES = %w[
    corporate job document contact email email_body email_attachments warehouse
    task task_attachments task_responses
    case case_documents case_emails
    asset asset_expenses asset_service asset_readings
    compliance bank_statement template
    template_documents template_bank_statements template_invoices template_email_signatures template_pdf_fields
    esignature esignature_pending esignature_completed
    plan
    xero user
  ].freeze

  # Legacy column aliases for backward compatibility
  # These allow code referencing old column names to continue working
  alias_attribute :scope_root_folders, :warehouse_folders
  alias_attribute :virtual_scopes, :virtual_warehouses
  # Note: scope_options was deleted and replaced with exclude_sm_tasks boolean

  # Validations
  # SSoT: StorageConfiguration validates TENANT (not organization) - Jan 2026 fix
  # Note: provider_type is now DERIVED from active credentials (SSoT)
  # The stored column is just a fallback default, so we validate it exists but don't require it to be "correct"
  validates :tenant, presence: true, uniqueness: true
  validate :stored_provider_type_valid
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :root_path, presence: true

  def stored_provider_type_valid
    stored = read_attribute(:provider_type)
    if stored.present? && !PROVIDER_TYPES.include?(stored)
      errors.add(:provider_type, "must be one of: #{PROVIDER_TYPES.join(', ')}")
    end
  end

  # Callbacks
  # Auto-sync root_path when provider_type changes
  # SharePoint uses "/Shared Documents", S3/Wasabi/local use "/" (bucket root)
  before_save :sync_root_path_for_provider, if: :provider_type_changed?

  # Clear warehouse folder tree cache when templates change
  # This ensures File Warehouse instantly reflects template changes
  after_save :invalidate_warehouse_folder_cache, if: :warehouse_folders_changed?

  def invalidate_warehouse_folder_cache
    Rails.cache.delete("warehouse_folder_tree_v2")
    Rails.logger.info "[StorageConfiguration] Cleared warehouse folder tree cache after template change"
  end

  # Auto-sync root_path based on provider_type
  # SSoT: SharePoint = "/Shared Documents", S3/Wasabi/local = "/" (bucket root)
  def sync_root_path_for_provider
    new_root = case provider_type
               when "sharepoint" then "/Shared Documents"
               else "/" # S3, Wasabi, s3_compatible, local all use bucket root
               end
    self.root_path = new_root
    Rails.logger.info "[StorageConfiguration] Auto-synced root_path to '#{new_root}' for provider '#{provider_type}'"
  end

  # Scopes
  scope :connected, -> { where(status: "connected") }
  scope :for_provider, ->(type) { where(provider_type: type) }

  # ========================================
  # Class Methods
  # ========================================

  # SSoT: Get storage configuration for a tenant (Jan 2026 fix)
  # This is THE ONE way to get storage config
  #
  # @param tenant [Tenant] The tenant to get storage config for
  # @return [StorageConfiguration] The storage configuration
  def self.for_tenant(tenant)
    raise ::TenantNotFoundError, "Tenant required for storage configuration" unless tenant

    find_by(tenant: tenant) || create_default_for_tenant(tenant)
  end

  # DEPRECATED: Use for_tenant instead
  # Get storage configuration via organization (delegates to for_tenant)
  def self.for_organization(org)
    Rails.logger.warn "[DEPRECATED] StorageConfiguration.for_organization - use for_tenant instead"
    return nil unless org

    # Delegate to for_tenant
    for_tenant(org.tenant)
  end

  # Singleton accessor - uses ActsAsTenant.current_tenant
  # Raises TenantNotFoundError if no tenant context (fail-fast)
  def self.instance
    tenant = ActsAsTenant.current_tenant
    raise ::TenantNotFoundError, "Tenant context required for StorageConfiguration.instance - use for_tenant(tenant) or set ActsAsTenant.current_tenant" unless tenant

    for_tenant(tenant)
  end

  # Create default configuration for a tenant
  # SSoT: Uses tenant.document_provider - no hardcoded fallback
  def self.create_default_for_tenant(tenant)
    return nil unless tenant

    provider = tenant.document_provider || "s3_compatible"

    # SSoT: Root path differs by provider
    # - SharePoint: /Shared Documents (Microsoft convention)
    # - S3/Wasabi/local: / (bucket root - bucket name is separate)
    root = case provider
           when "sharepoint" then "/Shared Documents"
           else "/" # S3, Wasabi, s3_compatible, local all use bucket/folder root
           end

    create!(
      tenant: tenant,
      provider_type: provider,
      status: "disconnected",
      root_path: root
    )
  rescue ActiveRecord::RecordNotUnique
    # Handle race condition
    find_by(tenant: tenant)
  end

  # DEPRECATED: Use create_default_for_tenant instead
  def self.create_default_for(org)
    Rails.logger.warn "[DEPRECATED] StorageConfiguration.create_default_for(org) - use create_default_for_tenant(tenant) instead"
    return nil unless org

    create_default_for_tenant(org.tenant)
  end

  # ========================================
  # Warehouse Root Folders (SSoT: warehouse_folders column ONLY)
  # ========================================

  # Default warehouse root folders - used ONLY for initialization
  # After init, warehouse_folders column is THE ONE SSoT (no merging)
  #
  # SSoT: These MUST include the root folder prefix (Jobs/, Corporate/, Emails/, etc.)
  # Code uses these keys directly - if a key is missing, you get an error (no fallbacks!)
  #
  WAREHOUSE_ROOT_DEFAULTS = {
    # User personal documents (Teeem Docs feature - Jan 2026)
    'user' => 'Teeem Docs/{{UserName}}/{{Folder}}',
    # Job documents - {{TeeemXL}} resolves to tab's display_name
    'job' => 'Jobs/{{JobCode}}/{{TeeemXL}}',
    # Contact documents (SSoT for all individuals - Jan 2026 'people' merged into 'contact')
    'contact' => 'Contacts/{{ContactName}}/{{TeeemXL}}',
    # Corporate documents (SSoT: 'corporate' is THE ONE - Jan 2026 consolidation)
    'corporate' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/{{TeeemXL}}',
    # Task documents
    # SSoT: Virtual folder paths for File Warehouse display (SmTaskAttachment.virtual_folder_path)
    # Actual files stored in Blobs/{hash}.ext - these paths are for UI organization only
    'task' => 'Tasks/{{TaskId}}',
    'task_attachments' => 'Tasks/{{TaskId}}/Attachments',
    'task_responses' => 'Tasks/{{TaskId}}/Responses',
    # Case documents (Jan 2026)
    # SSoT: Virtual folder paths for File Warehouse - actual files in Blobs/{hash}.ext
    'case' => 'Cases/{{CaseId}}',
    'case_documents' => 'Cases/{{CaseId}}/Documents',
    'case_emails' => 'Cases/{{CaseId}}/Emails',
    # Asset documents (Jan 2026) - under Corporate since assets belong to corporate entities
    # For: asset_expense, asset_odometer_reading, asset_service_history
    'asset' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}',
    'asset_expenses' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}/Expenses',
    'asset_service' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}/Service',
    'asset_readings' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}/Readings',
    # Compliance documents (Jan 2026)
    # For: document_task (job compliance - permits, approvals, certifications)
    'compliance' => 'Jobs/{{JobCode}}/Compliance',
    # Bank statement documents (Jan 2026)
    # For: bank_statement_report (ATO compliance PDFs)
    'bank_statement' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/XERO/Bank',
    # Document templates (Jan 2026) - internal system files under Warehousing
    # For: document_template (HTML templates, PDF overlays)
    'template' => 'Warehousing/Templates/{{TemplateType}}',
    # Template sub-scopes (Jan 2026) - organized by template type
    'template_documents' => 'Templates/Documents',
    'template_bank_statements' => 'Templates/Bank Statements',
    'template_invoices' => 'Templates/Invoices',
    'template_email_signatures' => 'Templates/Email Signatures',
    'template_pdf_fields' => 'Templates/PDF Fields',
    # E-signature documents (Jan 2026) - internal system files under Warehousing
    # For: e_signature_request (DocuSign envelopes)
    'esignature' => 'Warehousing/E-Signatures/{{Year}}/{{Month}}',
    'esignature_pending' => 'Warehousing/E-Signatures/Pending',
    'esignature_completed' => 'Warehousing/E-Signatures/Completed',
    # Construction plans (Jan 2026)
    # For: job_plan_revision, plan_folder_scan
    'plan' => 'Jobs/{{JobCode}}/Plans',
    # Email documents
    # SSoT: Consistent with Tasks pattern (task/task_responses/task_attachments)
    'email' => 'Emails/{{Mailbox}}/{{Year}}/{{Month}}',
    'email_body' => 'Emails/{{Mailbox}}/{{Year}}/{{Month}}/Body',
    'email_attachments' => 'Emails/{{Mailbox}}/{{Year}}/{{Month}}/Attachments',
    # Warehousing sub-types (all under Warehousing/ root)
    'warehouse' => 'Warehousing/{{TeeemXL}}',
    'chat' => 'Warehousing/Conversations/{{Context}}/{{Year}}/{{Month}}',
    'bill_inbox' => 'Warehousing/Bill Inbox/{{Status}}/{{Year}}/{{Month}}',
    'notebook' => 'Warehousing/Notebooks/{{UserName}}/{{NotebookName}}/{{Year}}'
  }.freeze

  # Legacy alias for backward compatibility
  SCOPE_ROOT_DEFAULTS = WAREHOUSE_ROOT_DEFAULTS

  # SSoT: Key aliases for warehouse types
  # Maps common variations to canonical warehouse type keys
  # Fixes root cause of files going to wrong folders (Jan 2026)
  WAREHOUSE_KEY_ALIASES = {
    'contacts' => 'contact',        # XeroAttachmentSyncService uses plural
    'people' => 'contact',          # Legacy alias (merged Jan 2026)
    'jobs' => 'job',                # Plural alias
    'tasks' => 'task',              # Plural alias
    'emails' => 'email',            # Plural alias
    'assets' => 'asset',            # Plural alias
    'templates' => 'template',      # Plural alias
    'plans' => 'plan',              # Plural alias
    'cases' => 'case',              # Plural alias
    'payments' => 'payment',        # Plural alias
    'corporate_companies' => 'corporate',  # Model name alias
    'corporate_entity' => 'corporate',     # Legacy alias (Jan 2026 consolidation)
  }.freeze

  # SSoT: Display labels for warehouse types (used in Data Warehouse, File Warehouse UI)
  WAREHOUSE_LABELS = {
    'email_body' => 'Email Bodies',
    'email_attachment' => 'Email Attachments',
    'email' => 'Emails',
    'corporate' => 'Corporate',
    'contact' => 'Contacts',
    'job' => 'Jobs',
    'task' => 'Tasks',
    'warehouse' => 'Warehouse',
    'user' => 'User (Teeem Docs)',
    'xero' => 'Xero',
    'template' => 'Templates',
    'template_documents' => 'Document Templates',
    'template_bank_statements' => 'Bank Statements',
    'template_invoices' => 'Invoice Templates',
    'template_email_signatures' => 'Email Signatures',
    'template_pdf_fields' => 'PDF Fields',
    'asset' => 'Assets',
    'case' => 'Cases',
    'esignature' => 'E-Signatures',
    'plan' => 'Plans',
    'compliance' => 'Compliance',
    'bank_statement' => 'Bank Statements',
  }.freeze

  # Get display label for a warehouse type (SSoT)
  def self.label_for(warehouse_type)
    type = warehouse_type.to_s
    WAREHOUSE_LABELS[type] || type.titleize
  end

  # SSoT: Merge warehouse_folders with defaults (adds missing keys)
  # This ensures new warehouse types get added while preserving customizations
  after_initialize :ensure_warehouse_folders

  def ensure_warehouse_folders
    # Merge: defaults first, then existing values override
    # New types from WAREHOUSE_ROOT_DEFAULTS get added automatically
    self.warehouse_folders = WAREHOUSE_ROOT_DEFAULTS.merge(warehouse_folders || {})
  end

  # Legacy alias
  alias_method :ensure_scope_root_folders, :ensure_warehouse_folders

  # Get root folder for a warehouse type
  # Check if a warehouse type is enabled (not "DISABLED")
  # @param warehouse_type [String, Symbol] The warehouse type name
  # @return [Boolean] true if warehouse type has storage enabled
  def warehouse_enabled?(warehouse_type)
    path = root_folder_for(warehouse_type)
    path.present? && path != "DISABLED"
  end

  # Legacy alias
  alias_method :scope_enabled?, :warehouse_enabled?

  # Check if SM-linked tasks should be excluded from task storage
  # When true, tasks with sm_schedule_master_id use PO storage instead
  # @return [Boolean]
  def exclude_sm_linked_tasks?
    # Now reads from dedicated boolean column instead of JSONB
    exclude_sm_tasks == true
  end

  # SSoT: warehouse_folders column is THE ONE source for warehouse roots
  #
  # @param warehouse_type [String, Symbol] The warehouse type name (job, contact, task, etc.)
  # @return [String, nil] The root folder name for that warehouse type, or nil if disabled
  #
  # Supports key aliases (e.g., :corporate → :corporate_entity, :contacts → :contact)
  # See WAREHOUSE_KEY_ALIASES for all supported aliases.
  #
  # Examples:
  #   root_folder_for(:job)       # => "Jobs/{{JobCode}}"
  #   root_folder_for(:contact)   # => "Contacts/{{ContactName}}"
  #   root_folder_for(:corporate) # => "Corporate/{{CompanyGroup}}" (via alias)
  #   root_folder_for(:task)      # => nil (if disabled)
  #
  def root_folder_for(warehouse_type)
    type_key = warehouse_type.to_s
    # SSoT: Normalize aliased keys (e.g., 'contacts' → 'contact')
    type_key = WAREHOUSE_KEY_ALIASES[type_key] || type_key
    # SSoT: Check database first, fall back to defaults for new warehouse types
    path = warehouse_folders&.dig(type_key) || WAREHOUSE_ROOT_DEFAULTS[type_key]
    return nil if path.blank? || path == "DISABLED"
    path
  end

  # Legacy alias for backward compatibility
  alias_method :path_for, :root_folder_for

  # SSoT: template_for returns the folder template pattern with tokens (e.g., "Jobs/{{JobCode}}")
  # This is an alias for root_folder_for since warehouse_folders stores the full template
  alias_method :template_for, :root_folder_for

  # SSoT: virtual_template_for returns folder template for virtual warehouse paths
  # Used by Phase 4 Virtual File Warehouse for organizing documents by virtual folder
  # Falls back to root_folder_for since templates are stored in warehouse_folders
  alias_method :virtual_template_for, :root_folder_for

  # Get all warehouse folders
  # SSoT: warehouse_folders column is THE ONE source (no merging with EntityTab)
  # EntityTab.warehouse_folder is DEPRECATED - all paths derived from warehouse_folders
  def effective_warehouse_folders
    warehouse_folders || {}
  end

  # Legacy aliases
  alias_method :effective_scope_root_folders, :effective_warehouse_folders
  alias_method :effective_scope_folders, :effective_warehouse_folders

  # ========================================
  # Path Building Helpers
  # ========================================

  # Build full path for a job folder
  # SSoT: warehouse_folders has full pattern like "Jobs/{{JobCode}}"
  # @param job_code [String] The job code (e.g., "JOB-001")
  # @param subfolder [String] Optional subfolder within job (e.g., "Plans", "Site")
  # @return [String] Full path like "/Jobs/JOB-001/Plans"
  def job_path(job_code, subfolder = nil)
    resolve_path(:job, { JobCode: job_code }, subfolder)
  end

  # Build full path for a standalone task folder
  # @param task_id [Integer, String] The task ID
  # @param subfolder [String] Optional subfolder within task
  # @return [String] Full path like "/Tasks/123/Attachments"
  def task_path(task_id, subfolder = nil)
    resolve_path(:task, { TaskId: task_id }, subfolder)
  end

  # Build full path for any warehouse type with template substitution
  # SSoT: warehouse_folders contains the full path pattern
  #
  # @param warehouse_type [String, Symbol] The warehouse type name (job, task, contact, etc.)
  # @param substitutions [Hash] Values to substitute in path (e.g., { JobCode: "JOB-001" })
  # @param subfolder [String] Optional subfolder to append (e.g., EntityTab.folder_path)
  # @return [String] Full resolved path
  #
  # Example:
  #   resolve_path(:job, { JobCode: "JOB-001" }, "Plans")
  #   # => "/Jobs/JOB-001/Plans"
  #
  #   resolve_path(:email, { Mailbox: "inbox", Year: "2026", Month: "01" })
  #   # => "/Emails/inbox/2026/01"
  #
  def resolve_path(warehouse_type, substitutions = {}, subfolder = nil)
    base_folder = root_folder_for(warehouse_type)

    # Return nil if warehouse type is disabled or not configured
    return nil if base_folder.nil?

    # Substitute template variables in base folder
    resolved = base_folder.dup
    substitutions.each do |key, value|
      resolved.gsub!("{{#{key}}}", value.to_s)
    end

    # Remove any remaining unsubstituted tokens
    resolved.gsub!(/\/?\{\{[^\}]+\}\}/, "")

    path = File.join(root_path, resolved)
    subfolder.present? ? File.join(path, subfolder) : path
  end

  # ========================================
  # Folder Path Computation (WarehouseDocumentable SSoT)
  # ========================================

  # Compute folder path for any documentable record
  # Used by WarehouseDocumentable concern to determine folder structure
  #
  # @param source_type [String, Symbol] The warehouse source type (asset, financial, compliance, etc.)
  # @param documentable [ActiveRecord] The source record (AssetExpense, FinancialTransaction, etc.)
  # @return [String, nil] The computed folder path
  #
  # Example:
  #   compute_folder_path(source_type: :asset, documentable: asset_expense)
  #   # => "Assets/Toyota Hilux/Expenses"
  #
  def compute_folder_path(source_type:, documentable:)
    template = virtual_template_for(source_type.to_sym)
    return nil unless template

    tokens = extract_tokens_from(documentable)
    expand_template(template, tokens)
  end

  # Extract token values from any documentable record
  # Uses duck typing to support multiple model types
  #
  # @param record [ActiveRecord] The source record
  # @return [Hash] Token key-value pairs for template expansion
  #
  def extract_tokens_from(record)
    return {} unless record

    tokens = {}

    # Job context
    if record.respond_to?(:job) && record.job
      tokens[:JobCode] = record.job.job_code
      tokens[:JobName] = record.job.name
    end

    # Asset context
    if record.respond_to?(:asset) && record.asset
      tokens[:AssetName] = record.asset.display_name.presence || record.asset.name.presence || "Asset-#{record.asset.id}"
      tokens[:AssetId] = record.asset.id
    end

    # Contact context
    if record.respond_to?(:contact) && record.contact
      tokens[:ContactName] = record.contact.display_name.presence || "Contact-#{record.contact.id}"
      tokens[:ContactId] = record.contact.id
    end

    # Corporate company context
    if record.respond_to?(:corporate_company) && record.corporate_company
      tokens[:CompanyCode] = record.corporate_company.company_code
      tokens[:CompanyName] = record.corporate_company.name
      tokens[:CompanyGroup] = record.corporate_company.company_group.presence || "Default"
    end

    # Date tokens - try multiple date fields
    date = record.try(:expense_date) || record.try(:reading_date) ||
           record.try(:transaction_date) || record.try(:created_at) || Time.current
    tokens[:Year] = date.year.to_s
    tokens[:Month] = date.strftime("%m")

    # Category/folder from document_type if available
    if record.respond_to?(:document_type_record) && record.document_type_record
      tokens[:Folder] = record.document_type_record.folder.presence || record.document_type_record.name
      tokens[:DocTypeName] = record.document_type_record.name
    elsif record.respond_to?(:document_type)
      tokens[:DocTypeName] = record.document_type
    end

    # Generic category - try multiple field names
    tokens[:Category] = record.try(:category) ||
                        record.try(:expense_type)&.titleize ||
                        record.try(:reading_type)&.titleize ||
                        record.try(:document_type)&.titleize ||
                        "Documents"

    # Task ID for task documents
    tokens[:TaskId] = record.id if record.is_a?(DocumentTask) || record.class.name == "SmTaskAttachment"

    tokens
  end

  # Expand template string with token values
  # Handles cleanup of unexpanded tokens and path separators
  #
  # @param template [String] Path template with {{Token}} placeholders
  # @param tokens [Hash] Token values for substitution
  # @return [String] Expanded path
  #
  def expand_template(template, tokens)
    result = template.dup

    tokens.each do |key, value|
      result.gsub!("{{#{key}}}", value.to_s)
    end

    # Clean up unexpanded tokens
    result.gsub!(/\/?\{\{[^\}]+\}\}/, "")

    # Clean up double slashes and trailing slashes
    result.gsub!(%r{//+}, "/")
    result.gsub!(%r{/$}, "")

    result
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

  # SSoT: Bucket for S3-compatible storage (Jan 2026)
  # No fallback - fail fast if not configured
  def bucket
    connection_config["bucket"]
  end

  # Class method for easy access without instance
  # Usage: StorageConfiguration.bucket or StorageConfiguration.bucket(tenant)
  def self.bucket(tenant = nil)
    config = tenant ? for_tenant(tenant) : instance
    config&.bucket
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
          "site_id" => credential.site_id,
          "drive_id" => credential.drive_id,
          "site_url" => credential.respond_to?(:site_url) ? credential.site_url : nil,
          # SSoT: drive_name comes from credential - no hardcoded fallback
          "drive_name" => credential.respond_to?(:drive_name) ? credential.drive_name : nil
        ).compact,
        status: credential.connected? ? "connected" : "disconnected"
      )
    when S3CompatibleCredential
      # SSoT (Jan 2026): bucket is stored in StorageConfiguration only, NOT synced from credential
      # Credential stores auth only (endpoint, region for client init)
      update!(
        provider_type: "s3_compatible",
        connection_config: connection_config.merge(
          "endpoint" => credential.endpoint,
          "region" => credential.region
          # bucket intentionally NOT synced - StorageConfiguration.connection_config['bucket'] is SSoT
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
        "site_id" => credential.site_id,
        "drive_id" => credential.drive_id,
        "site_url" => credential.respond_to?(:site_url) ? credential.site_url : nil,
        # SSoT: drive_name comes from credential - no hardcoded fallback
        "drive_name" => credential.respond_to?(:drive_name) ? credential.drive_name : nil
      }.compact
    when S3CompatibleCredential
      # SSoT (Jan 2026): bucket comes from StorageConfiguration only
      # This fallback only returns auth-related config, not bucket
      {
        "endpoint" => credential.endpoint,
        "region" => credential.region
        # bucket intentionally omitted - must be set in StorageConfiguration
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
  # @param warehouse_type [Symbol] The warehouse type (:excel_documents, :word_documents, :powerpoint_documents, :notes, :pdf_documents)
  # @param tab_name [String] Optional tab name for job-attached documents (default: derived from warehouse_type)
  # @return [String] The resolved folder path
  #
  # Examples:
  #   resolve_warehouse_path(spreadsheet, warehouse_type: :excel_documents)
  #   # Job attached: "Jobs/JOB-001/Excel"
  #   # No job:       "Warehousing/Excel/Robert Harder/2026"
  #
  def resolve_warehouse_path(entity, warehouse_type:, tab_name: nil)
    job = entity.respond_to?(:job) ? entity.job : nil
    user = entity.respond_to?(:user) ? entity.user : nil
    uploaded_by = entity.respond_to?(:uploaded_by) ? entity.uploaded_by : nil
    effective_user = user || uploaded_by
    created_at = entity.respond_to?(:created_at) ? entity.created_at : Time.current

    if job.present?
      # Job-attached: Use job folder structure
      # SSoT: EntityTab defines the folder name, but we use tab_name for document type
      effective_tab_name = tab_name || default_tab_name_for(warehouse_type)
      job_path(job.job_code, effective_tab_name)
    else
      # Standalone: Use warehousing folder structure
      # SSoT: StorageConfiguration.resolve_path with warehouse_folders
      resolve_path(warehouse_type, {
        UserName: effective_user&.name || "Unknown",
        Year: created_at&.year&.to_s || Time.current.year.to_s,
        Month: created_at&.strftime("%m") || Time.current.strftime("%m")
      })
    end
  end

  # Default tab name for each document warehouse type (used when job-attached)
  def default_tab_name_for(warehouse_type)
    case warehouse_type.to_sym
    when :excel_documents then "Excel"
    when :word_documents then "Word"
    when :powerpoint_documents then "PowerPoint"
    when :pdf_documents then "PDF"
    when :notes then "Notes"
    else warehouse_type.to_s.titleize
    end
  end

  # ========================================
  # Document Routing (SSoT for document model selection)
  # ========================================

  # Default routing configuration (fallback when database doesn't have it)
  # SSoT: WarehouseDocument is now THE ONE table for all document metadata
  DEFAULT_DOCUMENT_ROUTING = {
    "sharepoint_scan" => { "model" => "WarehouseDocument", "warehouse_type" => "corporate_entity", "description" => "SharePoint scanned documents" },
    "email_attachment" => { "model" => "WarehouseDocument", "warehouse_type" => "corporate_entity", "description" => "Email attachments" }
  }.freeze

  # SSoT: Get routing configuration for a document source
  # @param source [String, Symbol] The document source (xero_primary_invoice, xero_attachment, etc.)
  # @return [Hash] { "model" => "...", "warehouse_type" => "...", "description" => "..." }
  def routing_for(source)
    effective_document_routing[source.to_s] || DEFAULT_DOCUMENT_ROUTING[source.to_s]
  end

  # SSoT: Get the document model class for a source
  # @param source [String, Symbol] The document source
  # @return [Class] The ActiveRecord model class (WarehouseDocument is THE ONE SSoT)
  def document_model_for(source)
    routing = routing_for(source)
    return WarehouseDocument unless routing # Default fallback

    model_name = routing["model"]
    model_name.constantize
  rescue NameError
    Rails.logger.warn("[StorageConfiguration] Unknown model '#{model_name}' for source '#{source}', falling back to WarehouseDocument")
    WarehouseDocument
  end

  # SSoT: Get the EntityTab warehouse type for a source
  # @param source [String, Symbol] The document source
  # @return [String] The warehouse type name (contact, corporate_entity, etc.)
  def document_warehouse_type_for(source)
    routing = routing_for(source)
    routing&.dig("warehouse_type") || routing&.dig("scope") || "corporate_entity"
  end

  # Legacy alias
  alias_method :document_scope_for, :document_warehouse_type_for

  # Get effective document routing (database + defaults)
  def effective_document_routing
    DEFAULT_DOCUMENT_ROUTING.merge(document_routing || {})
  end

  # Update routing for a specific source
  def update_routing(source, model:, warehouse_type:, description: nil)
    new_routing = (document_routing || {}).merge(
      source.to_s => {
        "model" => model,
        "warehouse_type" => warehouse_type,
        "description" => description || "Custom routing"
      }
    )
    update!(document_routing: new_routing)
  end

  # ========================================
  # Virtual File Warehouse (Phase 4)
  # ========================================

  # SSoT: Check if warehouse type renders from database (virtual) vs S3 (physical)
  # Virtual warehouses:
  # - Folder tree renders from WarehouseDocument.folder (database)
  # - Reorganization is instant (bulk DB update)
  # - Physical storage stays at Blobs/{hash}.ext (never moves)
  #
  # Configured via admin UI at /settings/company/entity-config/storage_config
  # Stored in virtual_warehouses JSONB column: { "email" => true, "email_attachments" => true }
  #
  # @param warehouse_type [String, Symbol] The warehouse type name (email, task, job, etc.)
  # @return [Boolean] true if warehouse is virtual (database-driven), false if physical (S3-driven)
  def virtual_warehouse?(warehouse_type)
    (virtual_warehouses || {})[warehouse_type.to_s] == true
  end

  # Legacy alias
  alias_method :virtual_scope?, :virtual_warehouse?

  # Get all virtual warehouses (for UI display)
  def effective_virtual_warehouses
    virtual_warehouses || {}
  end

  # Legacy alias
  alias_method :effective_virtual_scopes, :effective_virtual_warehouses

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
      # Root path and warehouse folders
      root_path: root_path,
      # SSoT: warehouse_folders is THE ONE place for warehouse roots (includes identifier patterns)
      # warehouse_folders REMOVED (Jan 2026 SSoT fix) - use warehouse_folders only
      warehouse_folders: effective_warehouse_folders,
      # File name templates for document downloads
      file_name_templates: file_name_templates || {},
      # Display name templates for document display in UI
      display_name_templates: display_name_templates || {},
      # Config links for warehouse folders (URL to external config page)
      config_links: config_links || {},
      # Document routing configuration (SSoT for model selection)
      document_routing: effective_document_routing,
      # Virtual warehouses (Phase 4: Virtual File Warehouse)
      # Warehouses marked as virtual render from database, not S3
      virtual_warehouses: effective_virtual_warehouses,
      # SM task exclusion setting
      exclude_sm_tasks: exclude_sm_tasks,
      # Link expiry days for presigned URLs (from CorporateCompanySetting - SSoT)
      link_expiry_days: CorporateCompanySetting.link_expiry_days,

      # SSoT: Legacy aliases REMOVED (Jan 2026 cleanup)
      # Use warehouse_folders, warehouse_folders, virtual_warehouses, exclude_sm_tasks
    }
  end
end

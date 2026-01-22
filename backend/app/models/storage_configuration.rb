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
# Each EntityTab defines its own warehouse_folder template.
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

  # Warehouse types (SSoT - renamed from SCOPES)
  # Valid warehouse types that can have storage enabled
  # SSoT: 'contact' is THE ONE for all individuals (Jan 2026 - 'people' merged into 'contact')
  # SSoT: 'user' is for personal user documents (My Docs feature - Jan 2026)
  # SSoT: All valid warehouse types for File Warehouse
  # Added case, asset, financial scopes (Jan 2026)
  WAREHOUSE_TYPES = %w[
    corporate_entity job document contact email warehouse
    task task_attachments task_responses
    case case_documents case_emails
    asset asset_expenses asset_service asset_readings
    financial financial_transactions
    compliance payment payment_invoices payment_proof
    bank_statement template
    esignature esignature_pending esignature_completed
    plan
    xero user
  ].freeze

  # Legacy column aliases for backward compatibility
  # These allow code referencing old column names to continue working
  alias_attribute :scope_root_folders, :warehouse_root_folders
  alias_attribute :virtual_scopes, :virtual_warehouses
  # Note: scope_options was deleted and replaced with exclude_sm_tasks boolean

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

  # Callbacks
  # Clear warehouse folder tree cache when templates change
  # This ensures File Warehouse instantly reflects template changes
  after_save :invalidate_warehouse_folder_cache, if: :warehouse_root_folders_changed?

  def invalidate_warehouse_folder_cache
    Rails.cache.delete("warehouse_folder_tree_v2")
    Rails.logger.info "[StorageConfiguration] Cleared warehouse folder tree cache after template change"
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
  # Warehouse Root Folders (SSoT: warehouse_root_folders column ONLY)
  # ========================================

  # Default warehouse root folders - used ONLY for initialization
  # After init, warehouse_root_folders column is THE ONE SSoT (no merging)
  #
  # SSoT: These MUST include the root folder prefix (Jobs/, Corporate/, Emails/, etc.)
  # Code uses these keys directly - if a key is missing, you get an error (no fallbacks!)
  #
  WAREHOUSE_ROOT_DEFAULTS = {
    # User personal documents (Teeem Docs feature - Jan 2026)
    'user' => 'Teeem Docs/{{UserName}}/{{Folder}}',
    # Job documents
    'job' => 'Jobs/{{JobCode}}/{{TabName}}',
    # Contact documents (SSoT for all individuals - Jan 2026 'people' merged into 'contact')
    'contact' => 'Contacts/{{ContactName}}/{{TabName}}',
    # Corporate documents (alias 'corporate' maps here)
    'corporate' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}',
    'corporate_entity' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}',
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
    # Asset documents (Jan 2026)
    # For: asset_expense, asset_odometer_reading, asset_service_history
    'asset' => 'Assets/{{AssetName}}',
    'asset_expenses' => 'Assets/{{AssetName}}/Expenses',
    'asset_service' => 'Assets/{{AssetName}}/Service',
    'asset_readings' => 'Assets/{{AssetName}}/Readings',
    # Financial documents (Jan 2026)
    # For: financial_transaction receipts
    'financial' => 'Financials/{{Year}}',
    'financial_transactions' => 'Financials/{{Year}}/{{Month}}',
    # Compliance documents (Jan 2026)
    # For: document_task (job compliance - permits, approvals, certifications)
    'compliance' => 'Jobs/{{JobCode}}/Compliance',
    # Payment documents (Jan 2026)
    # For: pay_now_request (subcontractor invoices, proof photos)
    'payment' => 'Payments/{{Year}}/{{Month}}',
    'payment_invoices' => 'Payments/{{Year}}/{{Month}}/Invoices',
    'payment_proof' => 'Payments/{{Year}}/{{Month}}/Proof',
    # Bank statement documents (Jan 2026)
    # For: bank_statement_report (ATO compliance PDFs)
    'bank_statement' => 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/XERO/Bank',
    # Document templates (Jan 2026)
    # For: document_template (HTML templates, PDF overlays)
    'template' => 'Templates/{{TemplateType}}',
    # E-signature documents (Jan 2026)
    # For: e_signature_request (DocuSign envelopes)
    'esignature' => 'ESignatures/{{Year}}/{{Month}}',
    'esignature_pending' => 'ESignatures/Pending',
    'esignature_completed' => 'ESignatures/Completed',
    # Construction plans (Jan 2026)
    # For: job_plan_revision, plan_folder_scan
    'plan' => 'Jobs/{{JobCode}}/Plans',
    # Email documents
    # SSoT: email_attachments uses SAME path as email (appear together in File Warehouse)
    'email' => 'Emails/{{Mailbox}}/{{Year}}/{{Month}}',
    'email_attachments' => 'Emails/{{Mailbox}}/{{Year}}/{{Month}}',
    # Warehousing sub-types (all under Warehousing/ root)
    'warehouse' => 'Warehousing',
    'chat' => 'Warehousing/Chat/{{Context}}/{{Year}}/{{Month}}',
    'bill_inbox' => 'Warehousing/BillInbox/{{Status}}/{{Year}}/{{Month}}',
    'notebook' => 'Warehousing/Notes/{{UserName}}/{{NotebookName}}/{{Year}}'
  }.freeze

  # Legacy alias for backward compatibility
  SCOPE_ROOT_DEFAULTS = WAREHOUSE_ROOT_DEFAULTS

  # SSoT: Initialize warehouse_root_folders with defaults if empty
  after_initialize :ensure_warehouse_root_folders

  def ensure_warehouse_root_folders
    return if warehouse_root_folders.present?
    self.warehouse_root_folders = WAREHOUSE_ROOT_DEFAULTS.dup
  end

  # Legacy alias
  alias_method :ensure_scope_root_folders, :ensure_warehouse_root_folders

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

  # SSoT: warehouse_root_folders column is THE ONE source for warehouse roots
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
    # SSoT: Only use warehouse_root_folders column (initialized with defaults via after_initialize)
    path = warehouse_root_folders&.dig(type_key)
    return nil if path.blank? || path == "DISABLED"
    path
  end

  # Legacy alias for backward compatibility
  alias_method :path_for, :root_folder_for

  # SSoT: template_for returns the folder template pattern with tokens (e.g., "Jobs/{{JobCode}}")
  # This is an alias for root_folder_for since warehouse_root_folders stores the full template
  alias_method :template_for, :root_folder_for

  # SSoT: virtual_template_for returns folder template for virtual warehouse paths
  # Used by Phase 4 Virtual File Warehouse for organizing documents by virtual folder
  # Falls back to root_folder_for since templates are stored in warehouse_root_folders
  alias_method :virtual_template_for, :root_folder_for

  # Get all warehouse root folders
  # SSoT: warehouse_root_folders column is THE ONE source (no merging)
  def effective_warehouse_root_folders
    warehouse_root_folders || {}
  end

  # Legacy alias
  alias_method :effective_scope_root_folders, :effective_warehouse_root_folders

  # Get all warehouse folders (includes roots + tab paths for backward compatibility)
  # Returns warehouse roots plus all EntityTab warehouse paths
  def effective_warehouse_folders
    # Start with warehouse root folders
    result = effective_warehouse_root_folders.dup

    # Add EntityTab paths for backward compatibility with existing UI
    EntityTab.warehouse_base_folders.each do |key, path|
      result[key] ||= path
    end

    result
  end

  # Legacy alias
  alias_method :effective_scope_folders, :effective_warehouse_folders

  # ========================================
  # Path Building Helpers
  # ========================================

  # Build full path for a job folder
  # SSoT: warehouse_root_folders has full pattern like "Jobs/{{JobCode}}"
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
  # SSoT: warehouse_root_folders contains the full path pattern
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
          "site_id" => credential.site_id,
          "drive_id" => credential.drive_id,
          "site_url" => credential.respond_to?(:site_url) ? credential.site_url : nil,
          # SSoT: drive_name comes from credential - no hardcoded fallback
          "drive_name" => credential.respond_to?(:drive_name) ? credential.drive_name : nil
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
        "site_id" => credential.site_id,
        "drive_id" => credential.drive_id,
        "site_url" => credential.respond_to?(:site_url) ? credential.site_url : nil,
        # SSoT: drive_name comes from credential - no hardcoded fallback
        "drive_name" => credential.respond_to?(:drive_name) ? credential.drive_name : nil
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
      # SSoT: StorageConfiguration.resolve_path with warehouse_root_folders
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
  DEFAULT_DOCUMENT_ROUTING = {
    "xero_primary_invoice" => { "model" => "ContactDocument", "warehouse_type" => "contact", "description" => "Primary Xero invoice/bill PDF" },
    "xero_attachment" => { "model" => "CorporateCompanyDocument", "warehouse_type" => "corporate_entity", "description" => "Xero invoice/bill attachments" },
    "sharepoint_scan" => { "model" => "CorporateCompanyDocument", "warehouse_type" => "corporate_entity", "description" => "SharePoint scanned documents" },
    "email_attachment" => { "model" => "CorporateCompanyDocument", "warehouse_type" => "corporate_entity", "description" => "Email attachments" }
  }.freeze

  # SSoT: Get routing configuration for a document source
  # @param source [String, Symbol] The document source (xero_primary_invoice, xero_attachment, etc.)
  # @return [Hash] { "model" => "...", "warehouse_type" => "...", "description" => "..." }
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
      # SSoT: warehouse_root_folders is THE ONE place for warehouse roots (includes identifier patterns)
      # warehouse_folders REMOVED (Jan 2026 SSoT fix) - use warehouse_root_folders only
      warehouse_root_folders: effective_warehouse_root_folders,
      # File name templates for document downloads
      file_name_templates: file_name_templates || {},
      # Config links for warehouse folders (URL to external config page)
      config_links: config_links || {},
      # Document routing configuration (SSoT for model selection)
      document_routing: effective_document_routing,
      # Virtual warehouses (Phase 4: Virtual File Warehouse)
      # Warehouses marked as virtual render from database, not S3
      virtual_warehouses: effective_virtual_warehouses,
      # SM task exclusion setting
      exclude_sm_tasks: exclude_sm_tasks,

      # SSoT: Legacy aliases REMOVED (Jan 2026 cleanup)
      # Use warehouse_root_folders, warehouse_folders, virtual_warehouses, exclude_sm_tasks
    }
  end
end

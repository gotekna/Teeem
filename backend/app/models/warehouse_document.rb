# frozen_string_literal: true

# WarehouseDocument - SSoT for File Warehouse metadata
#
# This is THE universal table for all document warehouse metadata.
#
# Architecture (Phase 6: Ultra Design):
#   WarehouseDocument (THE ONE table for 5000 clients)
#   ├── documentable (polymorphic link to source record - optional for new docs)
#   ├── storage_blob (deduplicated file content)
#   ├── folder (virtual path - instant reorganization)
#   ├── metadata (JSONB - flexible type-specific fields)
#   ├── parent_document (attachment→email, version→original)
#   ├── linkable (optional link to Job/Contact/etc for filtering)
#   └── version tracking (version_group_id, version_number, is_latest_version)
#
# Two Names:
#   - ui_name: What user SEES in File Warehouse UI ("Tax Return FY2024")
#   - download_name: What file is CALLED when downloaded/emailed ("TA Tax Return 2024.pdf")
#
# Virtual Folders:
#   - folder: Virtual path, changing is instant (DB update only, no S3 copy)
#
# SSoT: Uses TenantResolvable for fail-fast tenant derivation (Jan 2026 fix)
#
class WarehouseDocument < ApplicationRecord
  include TenantResolvable

  # SSoT: Tenant scoping - ensures all queries are scoped to current tenant
  acts_as_tenant :tenant

  # ========================================
  # Callbacks
  # ========================================

  # SSoT: Auto-set tenant_id from documentable chain if not provided
  # This ensures ALL creation points get tenant_id without manual assignment
  before_validation :set_tenant_from_documentable, on: :create

  # NOTE (Feb 2026 FRC Fix): Removed compute_folder_from_template callback
  # Folder paths are now computed at runtime via computed_folder_path method
  # This eliminates sync issues between stored folder and WarehouseFolder SSoT

  # ========================================
  # Associations
  # ========================================

  # SSoT: Tenant association for multi-tenancy
  belongs_to :tenant

  # Polymorphic association to any document model (legacy - optional for new Phase 6 docs)
  belongs_to :documentable, polymorphic: true, optional: true

  # Link to deduplicated storage blob
  belongs_to :storage_blob, optional: true

  # Phase 6: Parent/child relationship (attachment→email, version→original)
  belongs_to :parent_document, class_name: "WarehouseDocument", optional: true
  has_many :child_documents, class_name: "WarehouseDocument", foreign_key: :parent_document_id, dependent: :nullify

  # Phase 6: Optional link to domain object (Job, Contact, Company, etc.)
  belongs_to :linkable, polymorphic: true, optional: true

  # ========================================
  # Validations
  # ========================================

  validates :ui_name, presence: true
  validates :source_type, presence: true, inclusion: {
    in: %w[corporate job email email_attachment task people contact user template warehouse asset financial compliance xero notebook],
    message: "%{value} is not a valid source type"
  }
  validates :version_number, numericality: { greater_than: 0 }, allow_nil: true

  # ========================================
  # Scopes
  # ========================================

  # Basic scopes
  scope :by_source, ->(source) { where(source_type: source) }
  # NOTE (Feb 2026 FRC Fix): Removed in_folder scope - folder column removed
  # Use computed_folder_path for folder filtering (requires Ruby-side filtering)
  scope :with_blob, -> { where.not(storage_blob_id: nil) }
  scope :without_blob, -> { where(storage_blob_id: nil) }

  # Phase 6: Multi-tenant scopes
  scope :for_tenant, ->(tenant_id) { where(tenant_id: tenant_id) }

  # Phase 6: Version scopes
  scope :latest_versions, -> { where(is_latest_version: true) }
  scope :all_versions, -> { where.not(version_group_id: nil) }
  scope :in_version_group, ->(group_id) { where(version_group_id: group_id).order(:version_number) }

  # Phase 6: Parent/child scopes
  scope :root_documents, -> { where(parent_document_id: nil) }
  scope :attachments_for, ->(parent_id) { where(parent_document_id: parent_id) }

  # Phase 6: Linkable scopes
  scope :linked_to, ->(linkable) { where(linkable: linkable) }
  scope :for_job, ->(job) { where(linkable_type: "Job", linkable_id: job.is_a?(Integer) ? job : job.id) }
  scope :for_contact, ->(contact) { where(linkable_type: "Contact", linkable_id: contact.is_a?(Integer) ? contact : contact.id) }

  # Constants for filename sanitization (Full Sanitization mode)
  MAX_FILENAME_LENGTH = 200
  INVALID_FILENAME_CHARS = /[:\/*?"<>|\\]/

  # SSoT: Get the filename for downloads
  # Uses SendNameResolver for full template expansion and sanitization
  #
  # Priority (handled by SendNameResolver):
  #   1. download_name (if already resolved)
  #   2. DocumentType.download_name template (expanded with context)
  #   3. Source-specific defaults (e.g., "{Subject} - {Date}.eml" for emails)
  #   4. ui_name
  #   5. original_filename
  #   6. "document" (last resort)
  #
  def download_filename
    SendNameResolver.new.resolve(self)
  end

  # Legacy method - kept for backwards compatibility
  # Use download_filename instead
  def legacy_download_filename
    raw_name = download_name.presence || ui_name
    sanitize_filename(raw_name)
  end

  # SSoT: Get storage path from blob
  def storage_path
    storage_blob&.storage_path
  end

  # SSoT: Get presigned download URL - storage_blob is THE ONE source
  # Uses resolved_tenant (from TenantResolvable) for provider - Jan 2026 fix
  def download_url(expires_in: 3600, disposition: :attachment)
    return nil unless storage_blob&.storage_path.present?

    provider = DocumentProviders.for_tenant(resolved_tenant)
    provider.download_url(
      storage_blob.storage_path,
      expires_in: expires_in,
      filename: download_filename,
      disposition: disposition
    )
  rescue ::TenantNotFoundError => e
    Rails.logger.error "[WarehouseDocument] download_url failed - no tenant: #{e.message}"
    nil
  rescue DocumentProviders::NotConnectedError => e
    # Storage not configured - gracefully return nil (common in local dev)
    Rails.logger.debug "[WarehouseDocument] download_url skipped - storage not configured"
    nil
  end

  # NOTE (Feb 2026 FRC Fix): Removed move_to_folder method
  # Folder paths are computed from source_type + documentable, not stored
  # To "move" a document, change its linkable association instead

  # ========================================
  # Computed Folder Path (Runtime Resolution)
  # ========================================
  #
  # SSoT (Feb 2026 FRC Fix): Returns the folder path computed at RUNTIME.
  # This is THE ONE way to get a document's folder path.
  #
  # Computation sources (in priority order):
  # 1. documentable.virtual_folder_path (if documentable responds to it)
  # 2. WarehouseProvider template expansion (from source_type + metadata)
  # 3. Default path based on source_type (e.g., "Corporate", "Jobs")
  #
  # @return [String] The computed folder path
  #
  def computed_folder_path
    # Try to compute from documentable's virtual_folder_path
    if documentable.present? && documentable.respond_to?(:virtual_folder_path)
      begin
        path = documentable.virtual_folder_path
        return path if path.present?
      rescue StandardError => e
        Rails.logger.debug "[WarehouseDocument] computed_folder_path documentable failed for #{id}: #{e.message}"
      end
    end

    # Compute from WarehouseProvider template
    begin
      config = WarehouseProvider.instance rescue nil
      if config
        warehouse_type = source_type_to_warehouse_type
        if warehouse_type
          tokens = extract_folder_tokens
          path = config.resolve_virtual_path(warehouse_type.to_sym, tokens)
          return path if path.present?
        end
      end
    rescue StandardError => e
      Rails.logger.debug "[WarehouseDocument] computed_folder_path template failed for #{id}: #{e.message}"
    end

    # Fallback: derive base folder from source_type
    source_type_to_base_folder
  end

  # SSoT: Map source_type to base folder name
  # Used as final fallback when template computation fails
  def source_type_to_base_folder
    case source_type
    when "corporate", "xero", "financial", "asset" then "Corporate"
    when "job", "compliance" then "Jobs"
    when "contact", "people" then "Contacts"
    when "task" then "Tasks"
    when "email", "email_attachment" then "Emails"
    when "case" then "Cases"
    when "user" then "Teeem Docs"
    when "template", "warehouse", "esignature" then "Warehousing"
    when "notebook" then "Notes"
    else source_type&.titleize || "Documents"
    end
  end

  # SSoT (Feb 2026): Base folder name from WarehouseFolder path templates
  # Uses warehouse_type_to_base_folder which extracts first segment of path
  # e.g., "Jobs/{{JobCode}}/Compliance" → "Jobs"
  # Fallback to source_type_to_base_folder if WarehouseFolder not configured
  def folder
    warehouse_type = source_type_to_warehouse_type
    # warehouse_type_to_base_folder returns {"job" => "Jobs", "corporate" => "Corporate", ...}
    WarehouseFolder.warehouse_type_to_base_folder[warehouse_type] || source_type_to_base_folder
  end

  # NOTE (Feb 2026 FRC Fix): folder column REMOVED from table.
  # The folder method now computes folder path at RUNTIME by querying WarehouseFolder SSoT.
  # This ensures folder names always match WarehouseFolder configuration without sync issues.

  # ========================================
  # Computed UI Name (Runtime Resolution)
  # ========================================
  #
  # SSoT: Returns the UI name computed from documentable attributes.
  # Falls back through common naming patterns (title, name, subject, file_name).
  # Used when ui_name column is null or when computing from documentable.
  #
  # @return [String] The UI name for this document
  #
  def computed_ui_name
    # If ui_name is stored, use it
    return ui_name if ui_name.present?

    # Try to get from documentable using duck typing
    if documentable.present?
      return documentable.title if documentable.respond_to?(:title) && documentable.title.present?
      return documentable.name if documentable.respond_to?(:name) && documentable.name.present?
      return documentable.subject if documentable.respond_to?(:subject) && documentable.subject.present?
      return documentable.file_name if documentable.respond_to?(:file_name) && documentable.file_name.present?
      return documentable.filename if documentable.respond_to?(:filename) && documentable.filename.present?
    end

    # Fall back to original_filename from this record or blob
    return original_filename if original_filename.present?
    return storage_blob&.original_filename if storage_blob&.original_filename.present?

    # Last resort: descriptive name
    "#{documentable&.class&.name&.titleize || 'Document'} ##{documentable_id || id}"
  end

  # ========================================
  # Phase 6: Metadata Accessors (JSONB)
  # ========================================

  # Get metadata value with symbol/string key support
  def meta(key)
    (metadata || {})[key.to_s]
  end

  # Set metadata value (merges with existing)
  def set_meta(key, value)
    self.metadata = (metadata || {}).merge(key.to_s => value)
  end

  # Bulk set metadata (merges with existing)
  def set_metadata(hash)
    self.metadata = (metadata || {}).merge(hash.stringify_keys)
  end

  # Email-specific metadata accessors
  def email_subject
    meta("subject")
  end

  def email_from
    meta("from_email")
  end

  def email_received_at
    meta("received_at")&.then { |t| Time.parse(t) rescue nil }
  end

  def email_mailbox
    meta("mailbox")
  end

  # Job-specific metadata accessors
  def job_code
    meta("job_code")
  end

  def document_type_name
    meta("document_type")
  end

  # ========================================
  # Phase 6: Version Tracking
  # ========================================

  # Get all versions of this document (including self)
  def versions
    return WarehouseDocument.none unless version_group_id.present?
    WarehouseDocument.in_version_group(version_group_id)
  end

  # Get the latest version in this version chain
  def latest_version
    return self unless version_group_id.present?
    versions.latest_versions.first || self
  end

  # Get the original (first) version
  def original_version
    return self unless version_group_id.present?
    versions.order(:version_number).first || self
  end

  # Check if this is the latest version
  def latest?
    is_latest_version == true
  end

  # Create a new version of this document
  # @param blob [StorageBlob] The storage blob for the new version
  # @param attributes [Hash] Additional attributes for the new version
  # @return [WarehouseDocument] The newly created version
  def create_new_version(blob:, **attributes)
    # Ensure we have a version group
    group_id = version_group_id || SecureRandom.uuid
    update!(version_group_id: group_id, is_latest_version: false) if version_group_id.nil?

    # Mark all existing versions as not latest
    versions.update_all(is_latest_version: false)

    # Create new version
    # NOTE (Feb 2026): folder column removed - folder is computed from source_type at runtime
    new_version = WarehouseDocument.create!(
      attributes.merge(
        ui_name: ui_name,
        source_type: source_type,
        storage_blob: blob,
        parent_document: self,
        version_group_id: group_id,
        version_number: (versions.maximum(:version_number) || 0) + 1,
        is_latest_version: true,
        tenant_id: tenant_id,
        linkable: linkable,
        metadata: metadata
      )
    )

    new_version
  end

  # ========================================
  # Phase 6: Attachment Helpers
  # ========================================

  # Get attachments for this document (e.g., email attachments)
  def attachments
    child_documents.where(source_type: "email_attachment")
  end

  # Check if this document has attachments
  def has_attachments?
    child_documents.exists?
  end

  # Get the parent email (if this is an attachment)
  def parent_email
    return nil unless source_type == "email_attachment"
    parent_document
  end

  # ========================================
  # Phase 5: Flat Storage Migration
  # ========================================

  # Get legacy S3 path for files not yet migrated to blob storage
  # Used by MigrateAllDocumentsToBlobStorageJob to find source files
  #
  # @return [String, nil] The S3 key where the file is currently stored
  def legacy_storage_path
    return nil unless documentable.present?

    # Try to get storage_path directly from documentable first
    # (most models have this field already populated)
    if documentable.respond_to?(:storage_path) && documentable.storage_path.present?
      return documentable.storage_path
    end

    # Fallback: model-specific legacy paths
    case documentable_type
    when "SyncedEmail"
      email = documentable
      # Try various path fields in order of preference
      email.storage_path.presence ||
        email.storage_email_path.presence ||
        compute_email_legacy_path(email)

    # Note: EmailAttachment removed (Jan 2026) - attachments now in WarehouseDocument with source_type='email_attachment'
    # SSoT: WarehouseDocument is now THE ONE table for all document metadata

    when "UserDocument"
      doc = documentable
      doc.respond_to?(:storage_path) ? doc.storage_path : nil

    when "DocumentTemplate"
      doc = documentable
      doc.respond_to?(:storage_path) ? doc.storage_path : nil

    else
      nil
    end
  end

  # Check if document has file content available for migration
  def has_legacy_file?
    legacy_storage_path.present? && storage_blob_id.nil?
  end

  private

  # SSoT: Auto-set tenant_id from documentable chain if not provided
  # Uses TenantResolvable#resolved_tenant which handles ALL derivation paths:
  # 1. Direct tenant → 2. Credential chain → 3. Parent record → 4. Documentable → 5. ActsAsTenant
  def set_tenant_from_documentable
    return if tenant_id.present?

    self.tenant_id = resolved_tenant&.id
  rescue ::TenantNotFoundError
    # Allow creation without tenant if can't be derived (legacy data)
    Rails.logger.debug "[WarehouseDocument] Could not derive tenant for new document"
    nil
  end

  # NOTE (Feb 2026 FRC Fix): Removed compute_folder_from_template method
  # Folder paths are now computed at runtime by computed_folder_path

  # Map source_type to warehouse template key
  def source_type_to_warehouse_type
    case source_type
    when "task" then "task_attachments"
    when "email" then "email"
    when "email_attachment" then "email_attachments"
    when "corporate" then "corporate"
    when "job" then "job"
    when "contact" then "contact"
    when "xero" then "bank_statement"
    when "case" then "case"
    when "notebook" then "notebook"
    else source_type
    end
  end

  # Extract token values for template expansion
  def extract_folder_tokens
    tokens = {}

    # Task context - handle both SmTask and SmTaskAttachment
    if source_type == "task" && documentable.present?
      if documentable.is_a?(SmTask)
        tokens[:TaskId] = documentable.id
      elsif documentable.respond_to?(:sm_task) && documentable.sm_task
        # SmTaskAttachment - get the task via association
        tokens[:TaskId] = documentable.sm_task.id
      end
    end

    # Job context
    if documentable.respond_to?(:job) && documentable.job
      tokens[:JobCode] = documentable.job.job_code
    elsif documentable.respond_to?(:job_code)
      tokens[:JobCode] = documentable.job_code
    end

    # Contact context
    if documentable.respond_to?(:contact) && documentable.contact
      tokens[:ContactName] = documentable.contact.display_name.presence || "Contact-#{documentable.contact.id}"
    end

    # Corporate company context
    if documentable.respond_to?(:corporate) && documentable.corporate
      cc = documentable.corporate
      tokens[:CompanyCode] = cc.company_code
      tokens[:CompanyGroup] = cc.company_group&.name.presence || "Default"
    end

    # Case context
    if documentable.respond_to?(:case_number)
      tokens[:CaseId] = documentable.case_number
    end

    # Asset context (for asset documents: expenses, service, readings)
    # SSoT: Assets belong to Corporate (company), so we need both asset + corporate tokens
    if documentable.is_a?(Asset)
      tokens[:AssetName] = documentable.display_name.presence || documentable.name.presence || "Asset-#{documentable.id}"
      tokens[:AssetNumber] = documentable.asset_number if documentable.asset_number.present?
      # Also get corporate context from the asset's company
      if documentable.corporate
        cc = documentable.corporate
        tokens[:CompanyCode] = cc.company_code
        tokens[:CompanyGroup] = cc.company_group&.name.presence || "Default"
      end
    elsif documentable.respond_to?(:asset) && documentable.asset
      # For child records like AssetExpense, AssetServiceHistory, etc.
      asset = documentable.asset
      tokens[:AssetName] = asset.display_name.presence || asset.name.presence || "Asset-#{asset.id}"
      tokens[:AssetNumber] = asset.asset_number if asset.asset_number.present?
      # Also get corporate context from the asset's company
      if asset.corporate
        cc = asset.corporate
        tokens[:CompanyCode] ||= cc.company_code
        tokens[:CompanyGroup] ||= cc.company_group&.name.presence || "Default"
      end
    end

    # Email context
    if source_type.in?(%w[email email_attachment])
      tokens[:Mailbox] = meta("mailbox") || "Unknown"
      received_at = email_received_at || created_at || Time.current
      tokens[:Year] = received_at.year.to_s
      tokens[:Month] = received_at.strftime("%m")
    end

    # Date tokens (fallback)
    date = created_at || Time.current
    tokens[:Year] ||= date.year.to_s
    tokens[:Month] ||= date.strftime("%m")

    tokens
  end

  # Compute email legacy path if not stored
  # SSoT: Uses WarehouseProvider for base folder (Jan 2026)
  def compute_email_legacy_path(email)
    return nil unless email.id.present?

    emails_folder = WarehouseProvider.instance&.path_for(:emails) || "Emails"
    year = email.received_at&.year || Time.current.year
    month = format("%02d", email.received_at&.month || 1)
    "#{emails_folder}/Email Body/#{year}/#{month}/#{email.id}.eml"
  end

  # Compute attachment legacy path if not stored
  # SSoT: Uses WarehouseProvider for base folder (Jan 2026)
  def compute_attachment_legacy_path(att)
    return nil unless att.id.present? && att.filename.present?

    email = att.email_warehouse
    return nil unless email

    emails_folder = WarehouseProvider.instance&.path_for(:emails) || "Emails"
    year = email.received_at&.year || Time.current.year
    month = format("%02d", email.received_at&.month || 1)
    safe_filename = att.filename.gsub(/[<>:"|?*\\\/]/, "_")
    "#{emails_folder}/Attachments/#{year}/#{month}/#{att.id}_#{safe_filename}"
  end

  # Compute job document legacy path if not stored
  # SSoT: Uses WarehouseProvider for base folder (Jan 2026)
  def compute_job_document_legacy_path(doc)
    return nil unless doc.id.present?

    job = doc.job
    return nil unless job

    jobs_folder = WarehouseProvider.instance&.path_for(:jobs) || "Jobs"
    doc_type = doc.document_type&.name || "Documents"
    filename = doc.filename.presence || "#{doc.id}"
    safe_filename = filename.gsub(/[<>:"|?*\\\/]/, "_")
    "#{jobs_folder}/#{job.job_code}/#{doc_type}/#{safe_filename}"
  end

  # Full sanitization for 100% accurate filenames
  def sanitize_filename(name)
    return "document" if name.blank?

    # 1. Remove invalid chars (: / \ * ? " < > |)
    clean = name.gsub(INVALID_FILENAME_CHARS, " ")

    # 2. Collapse multiple spaces
    clean = clean.gsub(/\s+/, " ").strip

    # 3. Truncate if too long
    clean = truncate_filename(clean)

    # 4. Ensure extension
    clean = ensure_extension(clean)

    clean
  end

  def truncate_filename(name)
    return name if name.length <= MAX_FILENAME_LENGTH

    ext = File.extname(name)
    base = File.basename(name, ext)
    max_base = MAX_FILENAME_LENGTH - ext.length - 3 # -3 for "..."
    "#{base[0..max_base]}...#{ext}"
  end

  def ensure_extension(name)
    return name if File.extname(name).present?

    # Try to get extension from original_filename or content_type
    ext = if original_filename.present?
            File.extname(original_filename)
          elsif content_type.present?
            MIME::Types[content_type].first&.preferred_extension&.then { |e| ".#{e}" }
          end

    ext ||= ".pdf" # Default fallback
    "#{name}#{ext}"
  end
end

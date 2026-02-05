# frozen_string_literal: true

# StorableDocument - SSoT concern for document storage integration
#
# Include in any model that stores documents using WarehouseProvider.
# Requires the model to have: storage_path, storage_item_id, storage_provider columns.
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: WarehouseProvider determines WHERE files go             ║
# ║  This concern is THE ONE way models integrate with storage        ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   class JobDocument < ApplicationRecord
#     include StorableDocument
#     storage_scope :job
#   end
#
#   doc.upload_to_storage(file, tokens: { JobCode: "J-001", TabName: "Plans" })
#   doc.storage_url  # => Download URL
#   doc.in_wasabi?   # => true
#
module StorableDocument
  extend ActiveSupport::Concern

  included do
    # Class attribute for storage scope
    class_attribute :document_storage_scope, default: :custom

    # SSoT: Auto-assign storage_provider from WarehouseProvider on create
    before_validation :assign_storage_provider_from_config, on: :create

    # Scopes for migration tracking
    scope :needs_storage_migration, -> { where(storage_path: [nil, ""]).where.not(storage_item_id: [nil, ""]).or(where(storage_path: [nil, ""]).where.not(storage_file_id: [nil, ""])) }
    scope :storage_migrated, -> { where.not(storage_path: [nil, ""]) }
    scope :migration_pending, -> { where(migration_status: [nil, "pending"]) }
    scope :migration_in_progress, -> { where(migration_status: "in_progress") }
    scope :migration_completed, -> { where(migration_status: "completed") }
    scope :migration_failed, -> { where(migration_status: "failed") }
  end

  # SSoT: Auto-assign storage_provider from current WarehouseProvider
  # Called before_validation on create - ensures ALL new documents get correct provider
  def assign_storage_provider_from_config
    return if storage_provider.present?
    return unless respond_to?(:storage_provider=)

    # FRC (Feb 2026): Use actual configured provider, no hardcoded defaults
    config = WarehouseProvider.instance rescue nil
    self.storage_provider = config&.storage_provider_for_new_documents
  end

  class_methods do
    # Define the storage scope for this model
    # @param scope [Symbol] One of: :job, :corporate, :people, :contact, :task, etc.
    def storage_scope(scope)
      self.document_storage_scope = scope
    end
  end

  # ========================================
  # Upload Methods
  # ========================================

  # Upload a file to storage using WarehouseProvider
  # @param file [File, ActionDispatch::Http::UploadedFile, String] The file or content
  # @param tokens [Hash] Token values for path template
  # @param filename [String] Optional filename override
  # @return [Hash] { success: true/false, path: "...", error: "..." }
  def upload_to_storage(file, tokens: {}, filename: nil)
    service = DocumentStorageService.new

    # Auto-populate tokens from record if not provided
    tokens = default_storage_tokens.merge(tokens)

    result = service.upload(
      scope: document_storage_scope,
      record: self,
      file: file,
      tokens: tokens,
      filename: filename
    )

    if result[:success]
      update!(
        storage_path: result[:path],
        storage_item_id: result[:file_id],
        storage_provider: WarehouseProvider.instance.provider_type,
        migration_status: "completed",
        migration_completed_at: Time.current
      )
    end

    result
  end

  # Preview what the storage path would be
  # SSoT: Passes self so the service can use WarehouseFolder.storage_folder_path template
  def preview_storage_path(tokens: {}, filename: nil)
    service = DocumentStorageService.new
    tokens = default_storage_tokens.merge(tokens)
    filename ||= file_name || "document"
    service.preview_path(scope: document_storage_scope, tokens: tokens, filename: filename, record: self)
  end

  # ========================================
  # Status Methods
  # ========================================

  # Check if file is stored in the current provider
  def in_current_storage?
    storage_path.present? && storage_provider == WarehouseProvider.instance.provider_type
  end

  # Check if file is in Wasabi
  def in_wasabi?
    storage_provider == "wasabi" && storage_path.present?
  end

  # Check if file is in SharePoint (for migration purposes)
  # FRC (Feb 2026): Legacy documents with blank storage_provider AND SharePoint IDs
  # are assumed to be SharePoint documents (created before storage_provider tracking)
  # New documents always have explicit storage_provider set
  def in_sharepoint?
    (storage_provider == "sharepoint" || storage_provider.blank?) &&
      (storage_item_id.present? || storage_file_id.present?)
  end

  # Check if file needs migration
  def needs_migration?
    storage_path.blank? && (storage_item_id.present? || storage_file_id.present?)
  end

  # ========================================
  # URL Methods
  # ========================================

  # Get download URL for the stored file (forces browser download)
  # SSoT: Delegates to DocumentStorageService (handles S3, SharePoint, ActiveStorage)
  def storage_url
    service = DocumentStorageService.new
    result = service.download_url(self, disposition: :attachment)
    result[:success] ? result[:url] : nil
  end

  # Get inline view URL for the stored file (browser displays in viewer)
  # SSoT: Same as storage_url but with Content-Disposition: inline
  def storage_url_inline
    service = DocumentStorageService.new
    result = service.download_url(self, disposition: :inline)
    result[:success] ? result[:url] : nil
  end

  # ========================================
  # Download Methods (SSoT)
  # ========================================

  # Download file content from storage
  # SSoT: Uses StorageBlob if available, falls back to legacy storage
  # @return [String, nil] File content or nil if not found
  def download_file
    # Prefer StorageBlob (new SSoT for file storage)
    if respond_to?(:storage_blob) && storage_blob.present?
      return storage_blob.download
    end

    # Fallback to legacy DocumentStorageService
    service = DocumentStorageService.new
    result = service.download(self)
    result[:success] ? result[:content] : nil
  end

  # Check if file exists in storage
  def has_file?
    if respond_to?(:storage_blob) && storage_blob.present?
      true
    else
      has_storage_reference?
    end
  end

  # Get presigned download URL for the file (SSoT)
  # @param expires_in [Integer] Expiry time in seconds (default: 3600)
  # @return [String, nil] Presigned download URL or nil if no file
  def file_url(expires_in: 3600)
    return nil unless respond_to?(:storage_blob) && storage_blob

    filename = respond_to?(:file_name) ? file_name : nil
    storage_blob.presigned_url(expires_in: expires_in, filename: filename)
  end

  # ========================================
  # Migration Methods
  # ========================================

  # Migrate this document from SharePoint to current storage provider
  def migrate_to_current_storage!(tokens: {})
    return { success: true, message: "Already migrated" } if in_current_storage?
    return { success: false, error: "No source file" } unless in_sharepoint?

    update!(migration_status: "in_progress", migration_started_at: Time.current)

    begin
      # Download from SharePoint
      content = download_from_sharepoint

      unless content.present?
        mark_migration_failed!("Could not download from SharePoint")
        return { success: false, error: "Could not download from SharePoint" }
      end

      # Upload to current storage
      tokens = default_storage_tokens.merge(tokens)
      result = upload_to_storage(content, tokens: tokens, filename: file_name)

      if result[:success]
        update!(migration_status: "completed", migration_completed_at: Time.current)
        { success: true, path: result[:path] }
      else
        mark_migration_failed!(result[:error])
        { success: false, error: result[:error] }
      end
    rescue => e
      mark_migration_failed!(e.message)
      { success: false, error: e.message }
    end
  end

  # ========================================
  # SSoT: Storage Reference (THE ONE method)
  # ========================================

  # Returns the provider-agnostic storage reference ID
  # Handles all storage ID column variants
  # All controllers/services should use this - NEVER access columns directly
  def storage_reference
    return storage_item_id if respond_to?(:storage_item_id) && storage_item_id.present?
    legacy_storage_id
  end

  # Check if document has a storage reference
  def has_storage_reference?
    storage_reference.present?
  end

  private

  # SSoT: Unified legacy storage ID accessor
  # Different models use different column names:
  #   - storage_item_id (JobDocument, ContactDocument - renamed from sharepoint_item_id)
  #   - storage_file_id (BillInbox - renamed from sharepoint_file_id)
  #   - external_id (PeopleDocument)
  # This method handles all - ONLY use internally, external code should use storage_reference
  def legacy_storage_id
    if has_attribute?(:storage_item_id) && read_attribute(:storage_item_id).present?
      read_attribute(:storage_item_id)
    elsif has_attribute?(:storage_file_id) && read_attribute(:storage_file_id).present?
      read_attribute(:storage_file_id)
    elsif has_attribute?(:external_id) && read_attribute(:external_id).present?
      read_attribute(:external_id)
    end
  end

  # Backwards compatibility aliases for external code still using old method names
  def sharepoint_item_id
    legacy_storage_id
  end

  def sharepoint_file_id
    legacy_storage_id
  end

  # Override in model to provide default tokens
  def default_storage_tokens
    {}
  end

  # Download content from current storage provider
  # SSoT: Delegates to DocumentStorageService (handles S3, SharePoint, ActiveStorage)
  def download_from_sharepoint
    service = DocumentStorageService.new
    result = service.download(self)
    result[:success] ? result[:content] : nil
  end

  def mark_migration_failed!(error_message)
    update!(
      migration_status: "failed",
      migration_error: error_message
    )
  end
end

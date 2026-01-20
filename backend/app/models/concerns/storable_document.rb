# frozen_string_literal: true

# StorableDocument - SSoT concern for document storage integration
#
# Include in any model that stores documents using StorageConfiguration.
# Requires the model to have: storage_path, storage_item_id, storage_provider columns.
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: StorageConfiguration determines WHERE files go             ║
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

    # SSoT: Auto-assign storage_provider from StorageConfiguration on create
    before_validation :assign_storage_provider_from_config, on: :create

    # Scopes for migration tracking
    scope :needs_storage_migration, -> { where(storage_path: [nil, ""]).where.not(sharepoint_item_id: [nil, ""]) }
    scope :storage_migrated, -> { where.not(storage_path: [nil, ""]) }
    scope :migration_pending, -> { where(migration_status: [nil, "pending"]) }
    scope :migration_in_progress, -> { where(migration_status: "in_progress") }
    scope :migration_completed, -> { where(migration_status: "completed") }
    scope :migration_failed, -> { where(migration_status: "failed") }
  end

  # SSoT: Auto-assign storage_provider from current StorageConfiguration
  # Called before_validation on create - ensures ALL new documents get correct provider
  def assign_storage_provider_from_config
    return if storage_provider.present?
    return unless respond_to?(:storage_provider=)

    config = StorageConfiguration.instance rescue nil
    self.storage_provider = config&.storage_provider_for_new_documents || "s3_compatible"
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

  # Upload a file to storage using StorageConfiguration
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
        storage_provider: StorageConfiguration.instance.provider_type,
        migration_status: "completed",
        migration_completed_at: Time.current
      )
    end

    result
  end

  # Preview what the storage path would be
  # SSoT: Passes self so the service can use EntityTab.storage_folder_path template
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
    storage_path.present? && storage_provider == StorageConfiguration.instance.provider_type
  end

  # Check if file is in Wasabi
  def in_wasabi?
    storage_provider == "wasabi" && storage_path.present?
  end

  # Check if file is still in SharePoint (needs migration)
  def in_sharepoint?
    (storage_provider == "sharepoint" || storage_provider.blank?) &&
      (sharepoint_item_id.present? || sharepoint_file_id.present?)
  end

  # Check if file needs migration
  def needs_migration?
    storage_path.blank? && (sharepoint_item_id.present? || sharepoint_file_id.present?)
  end

  # ========================================
  # URL Methods
  # ========================================

  # Get download URL for the stored file
  # SSoT: Delegates to DocumentStorageService (handles S3, SharePoint, ActiveStorage)
  def storage_url
    service = DocumentStorageService.new
    result = service.download_url(self)
    result[:success] ? result[:url] : nil
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

  private

  # Handle different column names across models
  def sharepoint_item_id
    return super if respond_to?(:super)
    read_attribute(:sharepoint_item_id)
  end

  def sharepoint_file_id
    return super if respond_to?(:super)
    read_attribute(:sharepoint_file_id)
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

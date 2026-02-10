# frozen_string_literal: true

# WarehouseDocumentCreator - THE ONE standard service for creating WarehouseDocuments
#
# ⚠️ DO NOT create WarehouseDocuments directly in controllers/services.
# Use this service instead. It ensures consistent behavior across all 168+ document types.
#
# What this service does:
#   1. Looks up WarehouseFolderDocumentType from warehouse_folder_id (if provided)
#   2. Sets document_type_id in metadata (from WFDT or explicit param)
#   3. Creates WarehouseDocument with proper FKs
#   4. Lets model callbacks handle EVERYTHING ELSE:
#      - folder_path (materialize_folder_path via WarehousePathComputer)
#      - download_name (materialize_download_name via SendNameResolver)
#      - tenant_id (set_tenant_from_documentable)
#      - warehouse_folder_document_type FK (set_warehouse_folder_document_type)
#
# What this service does NOT do:
#   - Physical file upload (caller handles that — different per provider)
#   - StorageBlob creation (caller handles that — different per upload method)
#   - Activity logging (caller handles that — different per context)
#
# Usage:
#
#   # With blob (S3/Wasabi upload — file already in storage)
#   doc = WarehouseDocumentCreator.create!(
#     filename: "photo.jpg",
#     source_type: "job",
#     linkable: job,
#     storage_blob: blob,
#     warehouse_folder_id: params[:warehouse_folder_id],
#     user: current_user
#   )
#
#   # Without blob (SharePoint — file stored externally)
#   doc = WarehouseDocumentCreator.create!(
#     filename: "photo.jpg",
#     source_type: "job",
#     linkable: job,
#     warehouse_folder_id: params[:warehouse_folder_id],
#     file_size: 12345,
#     metadata: {
#       "sharepoint_item_id" => sp_item_id,
#       "web_url" => web_url,
#       "source" => "sharepoint_upload"
#     },
#     user: current_user
#   )
#
#   # With file content (creates StorageBlob automatically with dedup)
#   doc = WarehouseDocumentCreator.create_with_content!(
#     content: file_content,
#     filename: "photo.jpg",
#     content_type: "image/jpeg",
#     source_type: "job",
#     linkable: job,
#     warehouse_folder_id: params[:warehouse_folder_id],
#     user: current_user
#   )
#
#   # Find-or-update (idempotent — for syncs like SharePoint/Xero)
#   doc = WarehouseDocumentCreator.find_or_create!(
#     find_by: { source_type: "job", linkable: job, metadata_match: { "sharepoint_item_id" => sp_id } },
#     filename: "photo.jpg",
#     source_type: "job",
#     linkable: job,
#     metadata: { "sharepoint_item_id" => sp_id }
#   )
#
class WarehouseDocumentCreator
  # Create a WarehouseDocument with proper WFDT FK and let callbacks handle the rest.
  #
  # @param filename [String] Required. The original filename.
  # @param source_type [String] Required. e.g., "job", "corporate", "email", "task"
  # @param linkable [ActiveRecord::Base, nil] Job, Contact, Corporate, SmTask
  # @param storage_blob [StorageBlob, nil] Pre-created blob (for S3/Wasabi)
  # @param warehouse_folder_id [Integer, nil] WarehouseFolder ID → looks up primary WFDT
  # @param documentable [ActiveRecord::Base, nil] Legacy polymorphic link
  # @param file_size [Integer, nil] File size in bytes
  # @param content_type [String, nil] MIME type
  # @param metadata [Hash] Extra metadata to merge
  # @param user [User, nil] Who uploaded/created (for audit in metadata)
  # @param parent_document [WarehouseDocument, nil] Parent doc (for attachments)
  #
  # @return [WarehouseDocument] The created document
  # @raise [ActiveRecord::RecordInvalid] If validation fails
  #
  def self.create!(
    filename:,
    source_type:,
    linkable: nil,
    storage_blob: nil,
    warehouse_folder_id: nil,
    documentable: nil,
    file_size: nil,
    content_type: nil,
    metadata: {},
    user: nil,
    parent_document: nil,
    folder_path: nil
  )
    # 1. Look up WFDT from warehouse_folder_id (if provided)
    wfdt = resolve_wfdt(warehouse_folder_id)

    # 2. Build metadata with document type info
    doc_metadata = build_metadata(
      metadata: metadata,
      wfdt: wfdt,
      linkable: linkable,
      user: user,
      source_type: source_type
    )

    # 3. Create WarehouseDocument — callbacks handle folder_path, download_name, tenant_id
    #    If folder_path is provided, it's respected (materialize_folder_path skips recomputation)
    attrs = {
      ui_name: filename,
      original_filename: filename,
      source_type: source_type,
      linkable: linkable,
      storage_blob: storage_blob,
      documentable: documentable,
      warehouse_folder_document_type: wfdt,
      file_size: file_size || storage_blob&.file_size,
      content_type: content_type || storage_blob&.content_type,
      parent_document: parent_document,
      metadata: doc_metadata
    }
    attrs[:folder_path] = folder_path if folder_path.present?

    WarehouseDocument.create!(attrs)
  end

  # Create a WarehouseDocument with automatic StorageBlob creation from file content.
  # Handles content-hash deduplication via StorageBlob.find_or_create_for_content!
  #
  # @param content [String] Raw file content (binary string)
  # @param filename [String] Original filename
  # @param content_type [String] MIME type
  # @param source_type [String] e.g., "job", "corporate", "task"
  # @param linkable [ActiveRecord::Base, nil] Job, Contact, etc.
  # @param warehouse_folder_id [Integer, nil] For WFDT lookup
  # @param metadata [Hash] Extra metadata
  # @param user [User, nil] Who uploaded
  # @param documentable [ActiveRecord::Base, nil] Legacy polymorphic
  # @param parent_document [WarehouseDocument, nil] Parent doc
  #
  # @return [WarehouseDocument] The created document
  #
  def self.create_with_content!(
    content:,
    filename:,
    content_type: nil,
    source_type:,
    linkable: nil,
    warehouse_folder_id: nil,
    metadata: {},
    user: nil,
    documentable: nil,
    parent_document: nil,
    folder_path: nil
  )
    # Create StorageBlob with content-hash deduplication
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )
    blob.increment_reference!

    create!(
      filename: filename,
      source_type: source_type,
      linkable: linkable,
      storage_blob: blob,
      warehouse_folder_id: warehouse_folder_id,
      documentable: documentable,
      file_size: content.bytesize,
      content_type: content_type || blob.content_type,
      metadata: metadata,
      user: user,
      parent_document: parent_document,
      folder_path: folder_path
    )
  end

  # Find existing WarehouseDocument or create new one (idempotent).
  # Useful for sync operations (SharePoint, Xero) where the same file may be
  # re-synced multiple times.
  #
  # @param find_by [Hash] Conditions to find existing doc:
  #   - source_type [String] Required
  #   - linkable [ActiveRecord::Base] Required
  #   - metadata_match [Hash] JSONB metadata fields to match (e.g., { "sharepoint_item_id" => "abc" })
  # @param (remaining params same as create!)
  #
  # @return [WarehouseDocument] Found (updated) or created document
  #
  def self.find_or_create!(find_by:, **create_params)
    existing = find_existing(find_by)

    if existing
      # Update existing document with new data
      wfdt = resolve_wfdt(create_params[:warehouse_folder_id])
      doc_metadata = build_metadata(
        metadata: create_params[:metadata] || {},
        wfdt: wfdt,
        linkable: create_params[:linkable],
        user: create_params[:user],
        source_type: create_params[:source_type]
      )

      existing.assign_attributes(
        ui_name: create_params[:filename] || existing.ui_name,
        original_filename: create_params[:filename] || existing.original_filename,
        file_size: create_params[:file_size] || existing.file_size,
        warehouse_folder_document_type: wfdt || existing.warehouse_folder_document_type,
        storage_blob: create_params[:storage_blob] || existing.storage_blob,
        metadata: (existing.metadata || {}).merge(doc_metadata)
      )
      existing.save!
      existing
    else
      create!(**create_params)
    end
  end

  # ════════════════════════════════════════════════════════════════════
  # Private helpers
  # ════════════════════════════════════════════════════════════════════

  private

  # Look up the primary WarehouseFolderDocumentType from a WarehouseFolder ID.
  # This is THE ONE way to get the document type configuration for an upload.
  #
  # @param warehouse_folder_id [Integer, String, nil]
  # @return [WarehouseFolderDocumentType, nil]
  def self.resolve_wfdt(warehouse_folder_id)
    return nil unless warehouse_folder_id.present?

    wf = WarehouseFolder.find_by(id: warehouse_folder_id)
    wf&.warehouse_folder_document_types&.find_by(is_primary: true)
  end

  # Build metadata hash with document type info and audit fields.
  #
  # @param metadata [Hash] Caller-provided extra metadata
  # @param wfdt [WarehouseFolderDocumentType, nil] Resolved WFDT
  # @param linkable [ActiveRecord::Base, nil] Job, Contact, etc.
  # @param user [User, nil] Current user
  # @param source_type [String] Document source type
  # @return [Hash] Complete metadata hash
  def self.build_metadata(metadata:, wfdt:, linkable:, user:, source_type:)
    result = (metadata || {}).stringify_keys

    # Document type from WFDT (SSoT)
    if wfdt&.document_type
      result["document_type_id"] ||= wfdt.document_type_id
      result["document_type"] ||= wfdt.document_type.name
    end

    # Linkable context
    case linkable
    when Job
      result["job_code"] ||= linkable.job_code
    when Contact
      result["contact_name"] ||= linkable.display_name
    when Corporate
      result["company_code"] ||= linkable.company_code
    end

    # Audit
    if user
      result["last_modified_by"] ||= user.name
      result["uploaded_by_id"] ||= user.id
    end
    result["synced_at"] ||= Time.current.iso8601

    result.compact
  end

  # Find an existing WarehouseDocument by source_type + linkable + metadata match.
  #
  # @param find_by [Hash] { source_type:, linkable:, metadata_match: {} }
  # @return [WarehouseDocument, nil]
  def self.find_existing(find_by)
    scope = WarehouseDocument.where(source_type: find_by[:source_type])

    if find_by[:linkable]
      scope = scope.where(
        linkable_type: find_by[:linkable].class.name,
        linkable_id: find_by[:linkable].id
      )
    end

    if find_by[:metadata_match].present?
      find_by[:metadata_match].each do |key, value|
        scope = scope.where("metadata->>? = ?", key.to_s, value.to_s)
      end
    end

    scope.first
  end
end

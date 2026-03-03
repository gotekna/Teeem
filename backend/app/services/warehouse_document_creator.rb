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
    warehouse_folder_document_type_id: nil,
    documentable: nil,
    file_size: nil,
    content_type: nil,
    metadata: {},
    user: nil,
    parent_document: nil,
    folder_path: nil,
    expiry_date: nil
  )
    # 1. Look up WFDT: use explicit WFDT if provided, else primary from folder
    wfdt = if warehouse_folder_document_type_id.present?
      WarehouseFolderDocumentType.find_by(id: warehouse_folder_document_type_id)
    else
      resolve_wfdt(warehouse_folder_id)
    end

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
      version_letter: "A",
      metadata: doc_metadata
    }
    attrs[:folder_path] = folder_path if folder_path.present?
    attrs[:expiry_date] = expiry_date if expiry_date.present?

    doc = WarehouseDocument.create!(attrs)
    auto_complete_sm_tasks(doc)
    doc
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

  # Create a new WarehouseDocument, or create a new version if a document with the
  # same filename already exists in the same context (folder + linkable + source_type).
  #
  # SSoT for version detection across ALL upload paths. This is THE ONE method
  # that decides whether an upload is a new document or a new version.
  #
  # @param filename [String] Required. The original filename.
  # @param source_type [String] Required. e.g., "job", "corporate", "library"
  # @param version_letter [String, nil] Explicit version letter (for AI-detected plan revisions)
  # @param linkable [ActiveRecord::Base, nil] Job, Contact, Corporate, etc.
  # @param warehouse_folder_id [Integer, nil] WarehouseFolder ID
  # @param storage_blob [StorageBlob, nil] Pre-created blob
  # @param (remaining params same as create!)
  #
  # @return [WarehouseDocument] The created or versioned document
  #
  def self.create_or_version!(
    filename:,
    source_type:,
    version_letter: nil,
    linkable: nil,
    storage_blob: nil,
    warehouse_folder_id: nil,
    warehouse_folder_document_type_id: nil,
    file_size: nil,
    content_type: nil,
    metadata: {},
    user: nil,
    expiry_date: nil,
    folder_path: nil
  )
    existing = find_existing_for_versioning(filename, source_type, linkable, warehouse_folder_id)

    if existing
      # Create new version of existing document
      # User's explicit WFDT selection overrides the inherited WFDT from previous version
      next_letter = version_letter || WarehouseDocument.next_letter(existing.version_letter)

      version_attrs = {
        blob: storage_blob,
        version_letter: next_letter,
        file_size: file_size || storage_blob&.file_size,
        content_type: content_type || storage_blob&.content_type,
        original_filename: filename,
        warehouse_folder_id: warehouse_folder_id || existing.warehouse_folder_id,
        expiry_date: expiry_date
      }

      # Pass explicit WFDT ID so new version uses the user's doc type selection, not the old version's
      if warehouse_folder_document_type_id.present?
        version_attrs[:warehouse_folder_document_type_id] = warehouse_folder_document_type_id
      end

      new_version = existing.create_new_version(**version_attrs)
      auto_complete_sm_tasks(new_version)
      new_version
    else
      # First upload — version A (or explicit letter for plans)
      create!(
        filename: filename,
        source_type: source_type,
        linkable: linkable,
        storage_blob: storage_blob,
        warehouse_folder_id: warehouse_folder_id,
        warehouse_folder_document_type_id: warehouse_folder_document_type_id,
        file_size: file_size,
        content_type: content_type,
        metadata: metadata,
        user: user,
        folder_path: folder_path,
        expiry_date: expiry_date
      )
    end
  end

  # ════════════════════════════════════════════════════════════════════
  # Private helpers
  # ════════════════════════════════════════════════════════════════════

  private

  # Find an existing latest-version document with the same filename in the same context.
  # Match criteria: original_filename + warehouse_folder_id + linkable + source_type + is_latest_version
  #
  # @param filename [String] The original filename
  # @param source_type [String] Document source type
  # @param linkable [ActiveRecord::Base, nil] Job, Contact, etc.
  # @param warehouse_folder_id [Integer, nil] WarehouseFolder ID
  # @return [WarehouseDocument, nil]
  def self.find_existing_for_versioning(filename, source_type, linkable, warehouse_folder_id)
    scope = WarehouseDocument.where(
      original_filename: filename,
      source_type: source_type,
      is_latest_version: true
    )

    if linkable
      scope = scope.where(linkable_type: linkable.class.name, linkable_id: linkable.id)
    else
      scope = scope.where(linkable_type: nil)
    end

    if warehouse_folder_id.present?
      scope = scope.where(warehouse_folder_id: warehouse_folder_id)
    end

    scope.first
  end

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
        # FRC (Feb 2026): Use explicit single-quoted key name to match all other metadata JSONB
        # patterns in the codebase (e.g. where("metadata->>'is_primary' = ?", "true")).
        # The `?` placeholder for the key position is ambiguous in some pg adapter versions
        # when used immediately after the ->> operator (Sentry TEEEM-BACKEND-7H).
        # connection.quote() returns 'key' with single quotes — identical to hardcoded patterns.
        quoted_key = ActiveRecord::Base.connection.quote(key.to_s)
        scope = scope.where("metadata->>#{quoted_key} = ?", value.to_s)
      end
    end

    scope.first
  end

  # Auto-complete SM tasks when a matching document type is uploaded.
  # Pattern follows SmFieldController photo task auto-complete (lines 24-34).
  #
  # Match chain: WarehouseDocument → warehouse_folder_document_type → document_type_id
  #              SmTask → completion_document_type_id (same document_type_id)
  #
  # Only triggers when:
  #   1. Document has a WFDT with a document_type_id
  #   2. Document is linked to a Job
  #   3. An SM task for that job requires that doc type and isn't already completed
  def self.auto_complete_sm_tasks(warehouse_document)
    wfdt = warehouse_document.warehouse_folder_document_type
    doc_type_id = wfdt&.document_type_id
    return unless doc_type_id

    job = warehouse_document.linkable
    return unless job.is_a?(Job)

    SmTask.where(
      job_id: job.id,
      requires_document_to_complete: true,
      completion_document_type_id: doc_type_id
    ).where.not(status: SmTask::STATUS_COMPLETED).find_each do |task|
      task.update!(
        status: SmTask::STATUS_COMPLETED,
        completed_at: Time.current
      )
      Rails.logger.info("[AutoComplete] SM Task ##{task.id} '#{task.name}' auto-completed: document type #{doc_type_id} uploaded for job #{job.id}")
    end
  rescue StandardError => e
    # Don't let auto-complete failures block document creation
    Rails.logger.error("[AutoComplete] Failed to auto-complete SM tasks: #{e.message}")
  end
end

# frozen_string_literal: true

# WarehousePathComputer - SSoT for computing materialized folder paths
#
# ⚠️ DO NOT SIMPLIFY - FK-driven path resolution (Feb 2026 rewrite)
# ════════════════════════════════════════════════════════════════════
# Why: The old code mapped source_type strings → warehouse_type strings
#      to find folders. This produced wrong paths (Contact docs → "Contacts/Contacts",
#      Task docs → "Tasks/Unknown", etc.)
#
# The FIX: Follow the actual FK relationships that exist in the database:
#   WarehouseDocument
#     → warehouse_folder_document_type_id FK → WarehouseFolderDocumentType
#       → warehouse_folder_id FK → WarehouseFolder
#         → full_folder_path() = template like "Contact/{{ContactName}}/Receipts"
#
#   Then expand tokens from:
#     → linkable (Job/Contact/CorporateCompany/SmTask) = direct FK to the record
#     → documentable = source model for extra context
#
# ❌ WRONG: source_type string → warehouse_type string → folder lookup
# ✅ CORRECT: FK chain → folder → template → expand with linkable tokens
# ════════════════════════════════════════════════════════════════════
#
# Usage:
#   computer = WarehousePathComputer.new
#   result = computer.compute(warehouse_document)
#   # => { folder_path: "Job/J-001/Smith Residence/Photo",
#   #      warehouse_folder_id: 123,
#   #      path_template_version: 1 }
#
#   # Batch computation (pre-loads associations to avoid N+1)
#   results = computer.compute_batch(WarehouseDocument.where(folder_path: nil).limit(1000))
#   # => [{ id: 1, folder_path: "...", warehouse_folder_id: 123, path_template_version: 1 }, ...]
#
class WarehousePathComputer
  # ════════════════════════════════════════════════════════════════════
  # Rematerialize folder_path on WarehouseDocuments when config changes.
  #
  # Call this from ANY controller that modifies path-affecting config:
  #   - WarehouseType.folder_path_template or display_name changed
  #   - WarehouseFolder.folder_segment renamed
  #   - WarehouseFolder.parent_id changed (moved)
  #   - WarehouseFolder.warehouse_type_id changed (reassigned)
  #   - WarehouseFolder.folder_path_suffix changed
  #
  # @param folder_ids [Array<Integer>] WarehouseFolder IDs whose paths changed
  # @return [Integer] Number of documents updated
  # ════════════════════════════════════════════════════════════════════
  def self.rematerialize_for_folders(folder_ids)
    return 0 if folder_ids.blank?

    computer = new
    updated = 0

    # Process in batches to avoid memory issues
    WarehouseDocument.where(warehouse_folder_id: folder_ids).find_in_batches(batch_size: 500) do |batch|
      # Pre-load associations
      ActiveRecord::Associations::Preloader.new(
        records: batch,
        associations: [:storage_blob, :tenant, :warehouse_folder_document_type, :warehouse_folder, :linkable]
      ).call

      batch.each do |doc|
        begin
          result = computer.compute(doc)
          new_path = result[:folder_path]
          if new_path.present? && new_path != doc.folder_path
            doc.update_columns(folder_path: new_path, path_template_version: result[:path_template_version])
            updated += 1
          end
        rescue => e
          Rails.logger.warn("[WarehousePathComputer] Failed to rematerialize doc #{doc.id}: #{e.message}")
        end
      end
    end

    Rails.logger.info("[WarehousePathComputer] Rematerialized #{updated} documents for folder_ids: #{folder_ids.first(10).inspect}#{folder_ids.size > 10 ? '...' : ''}")
    updated
  end

  # The resolved WarehouseFolderDocumentType from the last compute() call.
  # Used by backfill to persist the FK on documents that were missing it.
  attr_reader :resolved_wfdt

  # Compute folder path for a single document
  #
  # @param doc [WarehouseDocument] The document to compute for
  # @return [Hash] { folder_path:, warehouse_folder_id:, path_template_version: }
  def compute(doc)
    @resolved_wfdt = nil  # Reset per-document

    # For warehouse source_type: delegate to documentable's warehouse_folder_path
    # SSoT: BillInbox/ChatMessage/TeeemSpreadsheet/TeeemPdf/TeeemDocument know their own path
    # Each model computes the correct subfolder (e.g., "Warehousing/TeeemXL/User/2026")
    if doc.source_type == "warehouse" && doc.documentable.respond_to?(:warehouse_folder_path)
      # Ensure tenant context for WarehouseProvider (needed by TeeemXL models)
      path = if doc.tenant_id.present? && ActsAsTenant.current_tenant.nil?
               ActsAsTenant.with_tenant(doc.tenant) { doc.documentable.warehouse_folder_path }
             else
               doc.documentable.warehouse_folder_path
             end
      if path.present?
        return {
          folder_path: sanitize_path(path),
          warehouse_folder_id: nil,
          path_template_version: 0
        }
      end
    end

    # 1. Find the warehouse folder (FK-driven)
    folder = find_warehouse_folder_for_doc(doc)

    if folder
      # 2. Build template from WT base + child folder segments only
      #    (NOT full_folder_path which duplicates root segment with WT template)
      template = build_path_template(folder)

      # 3. Extract tokens from linkable + documentable + folder fallback
      tokens = extract_tokens(doc)

      # 4. Expand template
      expanded = expand_template(template, tokens)

      if expanded.present?
        expanded_clean = sanitize_path(expanded)

        return {
          folder_path: expanded_clean,
          warehouse_folder_id: folder.id,
          path_template_version: folder.template_version
        }
      end
    end

    # Last resort: source_type default (only for truly unmapped docs)
    {
      folder_path: doc.source_type_to_root_folder,
      warehouse_folder_id: nil,
      path_template_version: 0
    }
  end

  # Batch compute folder paths for multiple documents
  # Pre-loads associations to avoid N+1 queries
  #
  # @param documents [ActiveRecord::Relation] Documents to compute
  # @return [Array<Hash>] Array of { id:, folder_path:, warehouse_folder_id:, path_template_version: }
  def compute_batch(documents)
    # Pre-load all needed associations
    docs = documents.includes(
      :storage_blob, :tenant,
      :warehouse_folder_document_type,
      :warehouse_folder,
      :linkable
    ).to_a

    # Pre-load warehouse folders for all linkable types and source types in this batch
    preload_warehouse_folders_for_batch(docs)

    docs.map do |doc|
      result = compute(doc)
      result.merge(id: doc.id)
    end
  end

  private

  # ════════════════════════════════════════════════════════════════════
  # FK-Driven Folder Lookup (THE ONE way to find a document's folder)
  # ════════════════════════════════════════════════════════════════════

  # Find the WarehouseFolder for this document by following FK chain.
  #
  # Priority:
  #   1. warehouse_folder_document_type FK → its warehouse_folder (most precise)
  #   2. document_type_id → WarehouseFolderDocumentType lookup (backfill recovery)
  #   3. linkable_type → warehouse_type → root folder (always correct)
  #   4. source_type → warehouse_type code (fallback for docs without linkable)
  #
  # @param doc [WarehouseDocument]
  # @return [WarehouseFolder, nil]
  def find_warehouse_folder_for_doc(doc)
    # 1. Direct FK through document type config (most precise - doc knows its folder config)
    if doc.warehouse_folder_document_type.present?
      return doc.warehouse_folder_document_type.warehouse_folder
    end

    # 2. Derive from document_type_id (backfill recovery for existing docs without FK)
    #    Same logic as WarehouseDocument#set_warehouse_folder_document_type callback
    #    but works during backfill when the FK wasn't set on creation.
    wfdt = resolve_warehouse_folder_document_type(doc)
    if wfdt
      @resolved_wfdt = wfdt  # Store for backfill to persist the FK
      return wfdt.warehouse_folder
    end

    # 3. From linkable type → warehouse_type → root folder
    if doc.linkable_type.present?
      wt_code = linkable_type_to_warehouse_type_code(doc.linkable_type)
      if wt_code
        folder = cached_folder_for(wt_code)
        return folder if folder
      end
    end

    # 4. From source_type → warehouse_type code (fallback for docs without linkable)
    wt_code = source_type_to_warehouse_type_code(doc.source_type)
    cached_folder_for(wt_code)
  end

  # Resolve the WarehouseFolderDocumentType for a document using document_type_id.
  # This is the same logic as the model callback but usable during backfill.
  #
  # Sources for document_type_id (in priority order):
  #   1. metadata["document_type_id"] (set during creation or backfilled from contact_documents)
  #   2. documentable.document_type_id (if model responds to it)
  #
  # @param doc [WarehouseDocument]
  # @return [WarehouseFolderDocumentType, nil]
  def resolve_warehouse_folder_document_type(doc)
    return nil unless doc.tenant_id.present?

    # Get document_type_id from metadata or documentable
    doc_type_id = doc.metadata&.dig("document_type_id")
    if doc_type_id.blank? && doc.documentable.present?
      doc_type_id = doc.documentable.document_type_id if doc.documentable.respond_to?(:document_type_id)
    end

    return nil if doc_type_id.blank?

    # Determine warehouse_type code
    wt_code = if doc.linkable_type.present?
                linkable_type_to_warehouse_type_code(doc.linkable_type)
              end
    wt_code ||= source_type_to_warehouse_type_code(doc.source_type)

    # Find matching WarehouseFolderDocumentType
    WarehouseFolderDocumentType
      .joins(warehouse_folder: :warehouse_type)
      .where(document_type_id: doc_type_id)
      .where(warehouse_types: { code: wt_code })
      .where(warehouse_folders: { tenant_id: doc.tenant_id })
      .first
  rescue NameError
    # Documentable class may have been deleted
    nil
  end

  # Map linkable_type (model class name) to warehouse_type code
  # @param linkable_type [String] e.g., "Job", "Contact"
  # @return [String, nil] warehouse_type code
  def linkable_type_to_warehouse_type_code(linkable_type)
    case linkable_type
    when "Job" then "job"
    when "Contact" then "contact"
    when "CorporateCompany" then "corporate"
    when "SmTask" then "task"
    else nil
    end
  end

  # Map source_type string to warehouse_type code (fallback for docs without linkable)
  # @param source_type [String] e.g., "email", "corporate"
  # @return [String] warehouse_type code
  def source_type_to_warehouse_type_code(source_type)
    case source_type
    when "task" then "task"
    when "email", "email_attachment" then "email"
    when "corporate", "xero", "financial", "asset" then "corporate"
    when "job", "compliance" then "job"
    when "contact", "people" then "contact"
    when "case" then "case"
    when "notebook" then "notebook"
    when "user" then "user"
    when "warehouse", "template" then "warehouse"
    when "esignature" then "e_signing"
    else "unassigned"
    end
  end

  # Cached lookup for warehouse folder by type code
  def cached_folder_for(wt_code)
    return nil if wt_code.blank?
    @folder_cache ||= {}
    unless @folder_cache.key?(wt_code)
      @folder_cache[wt_code] = WarehouseFolder.warehouse_folder_for(wt_code)
    end
    @folder_cache[wt_code]
  end

  # Pre-load warehouse folders for a batch of docs into cache
  def preload_warehouse_folders_for_batch(docs)
    @folder_cache ||= {}

    # Collect all warehouse type codes we'll need
    codes = Set.new
    docs.each do |doc|
      if doc.linkable_type.present?
        code = linkable_type_to_warehouse_type_code(doc.linkable_type)
        codes << code if code
      end
      codes << source_type_to_warehouse_type_code(doc.source_type)
    end

    # Load root folders for all codes in one query
    WarehouseFolder.root_folders
      .includes(:warehouse_type)
      .where(warehouse_types: { code: codes.to_a })
      .each do |folder|
        @folder_cache[folder.warehouse_type.code] = folder if folder.warehouse_type
      end
  end

  # ════════════════════════════════════════════════════════════════════
  # Path Template Construction
  # ════════════════════════════════════════════════════════════════════

  # Build path template from warehouse_type base template + folder segments.
  #
  # ⚠️ DO NOT SIMPLIFY - Root segment deduplication (Feb 2026 FRC fix)
  # ════════════════════════════════════════════════════════════════════
  # Why: The WT template already includes the root prefix (e.g., "Contacts/{{ContactName}}").
  #      Root folders whose segment matches the WT template's first segment (e.g., "Contacts")
  #      must NOT be appended, or you get "Contacts/{{ContactName}}/Contacts".
  #      But category root folders (e.g., "Financial", "Documents") MUST be appended.
  #
  # ❌ WRONG: Skip ALL root folder segments → loses "Financial", "Documents"
  # ✅ CORRECT: Skip root segment only if it matches WT template's first segment
  # ════════════════════════════════════════════════════════════════════
  #
  # @param folder [WarehouseFolder]
  # @return [String] Path template with {{Token}} placeholders
  def build_path_template(folder)
    wt = folder.warehouse_type
    return folder.folder_segment || "Unknown" unless wt

    # SSoT: folder_path_template is authoritative, falls back to display_name
    base = wt.folder_path_template.presence || wt.display_name

    # The WT template's root segment (e.g., "Contacts" from "Contacts/{{ContactName}}")
    # Root folders matching this are the WT root itself — skip to avoid duplication.
    wt_root_segment = base.split("/").first

    # For root folders (no parent): WT template + folder's own segment (if not WT root)
    if folder.parent_id.nil?
      result = base
      if folder.folder_segment.present? && folder.folder_segment != wt_root_segment
        result = "#{result}/#{folder.folder_segment}"
      end
      result = "#{result}/#{folder.folder_path_suffix}" if folder.folder_path_suffix.present?
      return result
    end

    # For child folders: WT template + ALL ancestor segments (including root, unless WT root)
    segments = []
    current = folder
    while current
      if current.parent_id.present?
        # Non-root: always include
        segments.unshift(current.folder_segment) if current.folder_segment.present?
        current = current.parent
      else
        # Root: include its segment unless it's the WT root
        if current.folder_segment.present? && current.folder_segment != wt_root_segment
          segments.unshift(current.folder_segment)
        end
        break
      end
    end

    result = segments.any? ? "#{base}/#{segments.join('/')}" : base
    result = "#{result}/#{folder.folder_path_suffix}" if folder.folder_path_suffix.present?
    result
  end

  # ════════════════════════════════════════════════════════════════════
  # Token Extraction — SSoT: warehouse_types.token_config
  # ════════════════════════════════════════════════════════════════════
  #
  # ⚠️ DO NOT hardcode token extraction — read from DB (Feb 2026 rewrite)
  # ════════════════════════════════════════════════════════════════════
  # Why: The old code hardcoded ~170 lines of case/when to extract tokens
  #      like JobCode, JobName. But the admin UI lets users put ANY token
  #      in folder_path_template (e.g., {{JobStatus}}, {{JobType}}).
  #      Hardcoded list fell out of sync → tokens silently stripped → wrong paths.
  #
  # The FIX: Read token_config from warehouse_types table.
  #   token_config is a JSONB column: { "JobCode": "job_code", "JobStatus": "job_status.name" }
  #   Each value is a dot-path resolved on the linkable record (same as warehouse_types_controller).
  #
  # ❌ WRONG: case doc.linkable_type when "Job" then tokens[:JobCode] = job.job_code
  # ✅ CORRECT: token_config.each { |name, path| tokens[name] = resolve_dot_path(linkable, path) }
  # ════════════════════════════════════════════════════════════════════

  # Extract token values for template expansion.
  # Reads token definitions from warehouse_types.token_config (SSoT).
  #
  # @param doc [WarehouseDocument]
  # @return [Hash] Token name => value
  def extract_tokens(doc)
    tokens = {}

    # 1. SSoT: Resolve tokens from warehouse_type.token_config using linkable
    warehouse_type = find_warehouse_type_for_doc(doc)
    if warehouse_type
      token_config = warehouse_type.token_config || {}
      record = doc.linkable || doc.documentable

      if record.present? && token_config.any?
        token_config.each do |token_name, dot_path|
          value = resolve_dot_path(record, dot_path)
          tokens[token_name.to_sym] = value.to_s if value.present?
        end
      end
    end

    # 2. Document type from warehouse_folder_document_type FK
    if doc.warehouse_folder_document_type&.document_type
      dt = doc.warehouse_folder_document_type.document_type
      tokens[:DocTypeName] ||= dt.name
      tokens[:Folder] ||= dt.folder.presence || dt.name if dt.respond_to?(:folder)
    end

    # 3. Date tokens (always available)
    date = doc.created_at || Time.current
    tokens[:Year] ||= date.year.to_s
    tokens[:Month] ||= date.strftime("%m")

    # 4. Email-specific tokens from metadata
    if doc.source_type.in?(%w[email email_attachment])
      tokens[:Mailbox] ||= doc.meta("mailbox") || "Unknown"
      received_at = doc.email_received_at || doc.created_at || Time.current
      tokens[:Year] = received_at.year.to_s
      tokens[:Month] = received_at.strftime("%m")
    end

    tokens
  end

  # Find the WarehouseType for this document (for token_config lookup)
  def find_warehouse_type_for_doc(doc)
    # Try from WFDT FK first (most precise)
    wt = doc.warehouse_folder_document_type&.warehouse_folder&.warehouse_type
    return wt if wt

    # Derive from linkable_type or source_type
    wt_code = if doc.linkable_type.present?
                linkable_type_to_warehouse_type_code(doc.linkable_type)
              end
    wt_code ||= source_type_to_warehouse_type_code(doc.source_type)

    @warehouse_type_cache ||= {}
    unless @warehouse_type_cache.key?(wt_code)
      @warehouse_type_cache[wt_code] = WarehouseType.find_by(code: wt_code)
    end
    @warehouse_type_cache[wt_code]
  end

  # Resolve a dot-path on a record (e.g., "job_status.name" on a Job)
  # Same logic as warehouse_types_controller#resolve_dot_path
  def resolve_dot_path(record, path)
    return nil if path.blank? || record.nil?

    path.to_s.split('.').reduce(record) do |obj, method|
      return nil if obj.nil?
      return nil unless obj.respond_to?(method)
      obj.public_send(method)
    end
  rescue StandardError
    nil
  end

  # ════════════════════════════════════════════════════════════════════
  # Template Expansion
  # ════════════════════════════════════════════════════════════════════

  # Expand a template path with token values
  # e.g., "Job/{{JobCode}}/{{JobName}}/Photo" + {JobCode: "J-001", JobName: "Smith"}
  #     => "Job/J-001/Smith/Photo"
  #
  # @param template [String] Path template with {{Token}} placeholders
  # @param tokens [Hash] Token name => value
  # @return [String] Expanded path
  def expand_template(template, tokens)
    return nil if template.blank?

    result = template.dup
    tokens.each do |key, value|
      result.gsub!("{{#{key}}}", value.to_s) if value.present?
    end

    # Remove any remaining unsubstituted tokens (with surrounding slashes)
    result.gsub!(/\/?\{\{[^\}]+\}\}/, "")
    result
  end

  # Clean up path - remove double slashes, leading/trailing slashes
  def sanitize_path(path)
    return nil if path.blank?

    path = path.gsub(%r{//+}, "/")  # Double slashes
    path = path.gsub(%r{^/|/$}, "") # Leading/trailing slashes
    path.presence
  end
end

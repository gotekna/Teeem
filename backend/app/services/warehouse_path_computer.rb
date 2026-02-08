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
  # The resolved WarehouseFolderDocumentType from the last compute() call.
  # Used by backfill to persist the FK on documents that were missing it.
  attr_reader :resolved_wfdt

  # Compute folder path for a single document
  #
  # @param doc [WarehouseDocument] The document to compute for
  # @return [Hash] { folder_path:, warehouse_folder_id:, path_template_version: }
  def compute(doc)
    @resolved_wfdt = nil  # Reset per-document
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
        expanded_segments = expanded_clean&.split("/")&.length || 0

        # If template expansion produced only a bare category name (1 segment like
        # "Email" or "Contacts" - no tokens expanded), prefer the DB folder column
        # which has richer historical data (e.g., "Emails/rachel@tekna.com.au/2025/11")
        db_folder = doc.read_attribute(:folder)
        if expanded_segments <= 1 && db_folder.present? && db_folder.split("/").length > 1
          return {
            folder_path: sanitize_path(db_folder),
            warehouse_folder_id: folder.id,
            path_template_version: folder.template_version
          }
        end

        return {
          folder_path: expanded_clean,
          warehouse_folder_id: folder.id,
          path_template_version: folder.template_version
        }
      end
    end

    # Fallback: use existing DB folder column if available (historical correct data)
    db_folder = doc.read_attribute(:folder)
    if db_folder.present?
      return {
        folder_path: sanitize_path(db_folder),
        warehouse_folder_id: folder&.id,
        path_template_version: 0
      }
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
  #   1. metadata["document_type_id"] (set during creation)
  #   2. documentable.document_type_id (if model responds to it)
  #   3. contact_documents table (legacy FK - for ContactDocument docs without linkable)
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

    # Fallback: recover document_type_id from contact_documents table (legacy FK)
    # The ContactDocument model was removed but the table persists with document_type_id column.
    # ~2,333 contact_documents rows have a document_type_id we can recover.
    if doc_type_id.blank? && doc.documentable_type == "ContactDocument" && doc.documentable_id.present?
      doc_type_id = recover_document_type_id_from_contact_documents(doc.documentable_id)
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

  # Build path template from warehouse_type base template + child folder segments.
  #
  # ⚠️ DO NOT USE folder.full_folder_path here!
  # full_folder_path includes the root folder's own segment ON TOP of the
  # warehouse_type template, causing duplication:
  #   WT template = "Contacts/{{ContactName}}", root segment = "Contacts"
  #   full_folder_path = "Contacts/{{ContactName}}/Contacts" ← WRONG
  #
  # Instead: WT template + child-only segments (excluding root)
  #   = "Contacts/{{ContactName}}" for root folders
  #   = "Contacts/{{ContactName}}/Receipts" for child folders
  #
  # @param folder [WarehouseFolder]
  # @return [String] Path template with {{Token}} placeholders
  def build_path_template(folder)
    wt = folder.warehouse_type
    return folder.folder_segment || "Unknown" unless wt

    base = wt.folder_path_template.presence
    return folder.folder_segment || wt.code.titleize unless base

    # For root folders (no parent), just use the WT template
    if folder.parent_id.nil?
      result = base
      result = "#{result}/#{folder.folder_path_suffix}" if folder.folder_path_suffix.present?
      return result
    end

    # For child folders: WT template + child segments (skip root folder's segment)
    segments = []
    current = folder
    while current && current.parent_id.present?
      segments.unshift(current.folder_segment) if current.folder_segment.present?
      current = current.parent
    end

    result = segments.any? ? "#{base}/#{segments.join('/')}" : base
    result = "#{result}/#{folder.folder_path_suffix}" if folder.folder_path_suffix.present?
    result
  end

  # ════════════════════════════════════════════════════════════════════
  # Token Extraction (Linkable-First)
  # ════════════════════════════════════════════════════════════════════

  # Extract token values for template expansion.
  # Linkable FK is the primary source (always reliable), with
  # documentable as enrichment for extra context.
  #
  # @param doc [WarehouseDocument]
  # @return [Hash] Token name => value
  def extract_tokens(doc)
    tokens = {}

    # 1. Tokens from LINKABLE (direct FK - always reliable)
    extract_tokens_from_linkable(tokens, doc)

    # 2. Enrich from documentable (if available and class exists)
    begin
      if doc.documentable.present?
        enrich_tokens_from_documentable(tokens, doc)
      end
    rescue NameError
      # Deleted model class (e.g. JobDocument) - skip enrichment
    end

    # 2b. Special case: ContactDocument table still exists with contact_id FK
    #     Used when linkable is nil and documentable chain is broken
    if tokens[:ContactName].blank? && doc.documentable_type == "ContactDocument" && doc.documentable_id.present?
      resolve_contact_from_contact_documents(tokens, doc)
    end

    # 3. Document type from warehouse_folder_document_type FK
    if doc.warehouse_folder_document_type&.document_type
      dt = doc.warehouse_folder_document_type.document_type
      tokens[:DocTypeName] ||= dt.name
      tokens[:Folder] ||= dt.folder.presence || dt.name if dt.respond_to?(:folder)
    end

    # 4. Date tokens (always available)
    date = doc.created_at || Time.current
    tokens[:Year] ||= date.year.to_s
    tokens[:Month] ||= date.strftime("%m")

    # 5. Email-specific tokens from metadata
    if doc.source_type.in?(%w[email email_attachment])
      tokens[:Mailbox] ||= doc.meta("mailbox") || "Unknown"
      # Use received_at for email date tokens (more accurate than created_at)
      received_at = doc.email_received_at || doc.created_at || Time.current
      tokens[:Year] = received_at.year.to_s
      tokens[:Month] = received_at.strftime("%m")
    end

    # 6. Fallback: derive missing tokens from existing folder column
    #    When linkable is nil and documentable chain is broken (deleted class
    #    like ContactDocument), the existing `folder` column has correct
    #    historical paths we can parse tokens from.
    derive_tokens_from_folder(tokens, doc)

    tokens
  end

  # Extract tokens from the linkable FK (Job, Contact, CorporateCompany, SmTask)
  def extract_tokens_from_linkable(tokens, doc)
    case doc.linkable_type
    when "Job"
      job = doc.linkable
      if job
        tokens[:JobCode] = job.job_code
        tokens[:JobName] = job.name.presence || job.job_code
      end
    when "Contact"
      contact = doc.linkable
      if contact
        tokens[:ContactName] = contact.display_name.presence || "Contact-#{contact.id}"
        tokens[:ContactId] = contact.id
      end
    when "CorporateCompany"
      cc = doc.linkable
      if cc
        tokens[:CompanyCode] = cc.company_code
        tokens[:CompanyGroup] = cc.company_group&.name.presence || "Default"
        tokens[:CompanyName] = cc.name
      end
    when "SmTask"
      task = doc.linkable
      if task
        tokens[:TaskId] = task.id
        tokens[:TaskName] = task.name&.parameterize || "task-#{task.id}"
        status_label = task.status&.titleize || "Unknown"
        tokens[:TaskStatus] = status_label
        tokens[:Status] = status_label
        if task.respond_to?(:job) && task.job
          tokens[:JobName] = task.job.name.presence || task.job.job_code
          tokens[:JobCode] = task.job.job_code
        else
          tokens[:JobName] = "Unassigned Job"
        end
      end
    end
  end

  # Enrich tokens from the documentable association (extra context)
  # Uses ||= so linkable tokens take priority (they're more reliable)
  def enrich_tokens_from_documentable(tokens, doc)
    documentable = doc.documentable

    # Task context - handle SmTask, SmTaskAttachment, etc.
    if doc.source_type == "task" && tokens[:TaskId].blank?
      task = if documentable.is_a?(SmTask)
               documentable
             elsif documentable.respond_to?(:sm_task) && documentable.sm_task
               documentable.sm_task
             end

      if task
        tokens[:TaskId] ||= task.id
        tokens[:TaskName] ||= task.name&.parameterize || "task-#{task.id}"
        status_label = task.status&.titleize || "Unknown"
        tokens[:TaskStatus] ||= status_label
        tokens[:Status] ||= status_label
        if task.respond_to?(:job) && task.job
          tokens[:JobName] ||= task.job.name.presence || task.job.job_code
          tokens[:JobCode] ||= task.job.job_code
        else
          tokens[:JobName] ||= "Unassigned Job"
        end
      end
    end

    # Job context (||= to not overwrite tokens set by linkable)
    if documentable.respond_to?(:job) && documentable.job
      tokens[:JobCode] ||= documentable.job.job_code
      tokens[:JobName] ||= documentable.job.name.presence
    elsif documentable.respond_to?(:job_code)
      tokens[:JobCode] ||= documentable.job_code
    end

    # Contact context
    if documentable.respond_to?(:contact) && documentable.contact
      tokens[:ContactName] ||= documentable.contact.display_name.presence || "Contact-#{documentable.contact.id}"
    end

    # Corporate company context
    if documentable.respond_to?(:corporate) && documentable.corporate
      cc = documentable.corporate
      tokens[:CompanyCode] ||= cc.company_code
      tokens[:CompanyGroup] ||= cc.company_group&.name.presence || "Default"
      tokens[:CompanyName] ||= cc.name
    end

    # Case context
    if documentable.respond_to?(:case_number)
      tokens[:CaseId] ||= documentable.case_number
    end

    # Asset context
    if documentable.is_a?(Asset)
      tokens[:AssetName] ||= documentable.display_name.presence || documentable.name.presence || "Asset-#{documentable.id}"
      tokens[:AssetNumber] ||= documentable.asset_number if documentable.asset_number.present?
      if documentable.corporate
        cc = documentable.corporate
        tokens[:CompanyCode] ||= cc.company_code
        tokens[:CompanyGroup] ||= cc.company_group&.name.presence || "Default"
      end
    elsif documentable.respond_to?(:asset) && documentable.asset
      asset = documentable.asset
      tokens[:AssetName] ||= asset.display_name.presence || asset.name.presence || "Asset-#{asset.id}"
      tokens[:AssetNumber] ||= asset.asset_number if asset.asset_number.present?
      if asset.corporate
        cc = asset.corporate
        tokens[:CompanyCode] ||= cc.company_code
        tokens[:CompanyGroup] ||= cc.company_group&.name.presence || "Default"
      end
    end
  end

  # Resolve ContactName from the contact_documents table (legacy table still in DB).
  # ContactDocument model was removed in Jan 2026 but the table persists with contact_id FK.
  # This resolves the 10K+ contact docs that have no linkable and broken documentable chain.
  def resolve_contact_from_contact_documents(tokens, doc)
    result = ActiveRecord::Base.connection.exec_query(
      "SELECT contact_id FROM contact_documents WHERE id = #{doc.documentable_id.to_i} LIMIT 1"
    )
    if (contact_id = result.first&.dig("contact_id"))
      contact = Contact.find_by(id: contact_id)
      if contact
        tokens[:ContactName] = contact.display_name.presence || "Contact-#{contact.id}"
        tokens[:ContactId] = contact.id
      end
    end
  rescue => _e
    # Table might not exist in all environments - silently skip
  end

  # Recover document_type_id from the legacy contact_documents table.
  # ~2,333 rows have a document_type_id that isn't stored anywhere else.
  # Used by resolve_warehouse_folder_document_type to enable WFDT lookup
  # for contact docs that would otherwise be stuck at depth-2 paths.
  #
  # @param documentable_id [Integer] The ContactDocument ID
  # @return [Integer, nil] The document_type_id if found
  def recover_document_type_id_from_contact_documents(documentable_id)
    result = ActiveRecord::Base.connection.exec_query(
      "SELECT document_type_id FROM contact_documents WHERE id = #{documentable_id.to_i} LIMIT 1"
    )
    result.first&.dig("document_type_id")
  rescue => _e
    # Table might not exist in all environments - silently skip
    nil
  end

  # Derive missing tokens from the existing `folder` DB column on the document.
  # This is a last-resort fallback for when:
  #   - linkable_type is nil (no direct FK to Job/Contact/etc.)
  #   - documentable class was deleted (e.g., ContactDocument → WarehouseDocument)
  #
  # The DB `folder` column has correct historical paths like:
  #   "Contacts/7 Eleven", "Email/inbox@tekna.com.au", "Corporate/Default/Acme Corp"
  #
  # ⚠️ DO NOT SIMPLIFY - Column shadowing fix (Feb 2026)
  # ════════════════════════════════════════════════════════════════════
  # Why: The model defines a `folder` METHOD that overrides the column reader.
  #      doc.folder → computed base name (e.g., "Emails")
  #      doc.read_attribute(:folder) → actual DB value (e.g., "Emails/rachel@tekna.com.au/2025/11")
  # ❌ WRONG: doc.folder (returns computed method, loses historical data)
  # ✅ CORRECT: doc.read_attribute(:folder) (reads actual DB column)
  # ════════════════════════════════════════════════════════════════════
  #
  # Uses ||= so this never overwrites tokens from linkable/documentable (higher priority).
  def derive_tokens_from_folder(tokens, doc)
    # Read the actual DB column, not the computed method
    db_folder = doc.read_attribute(:folder)
    return unless db_folder.present?

    parts = db_folder.split("/")

    case doc.source_type
    when "contact", "people"
      # "Contacts/7 Eleven" → ContactName = "7 Eleven"
      if tokens[:ContactName].blank? && parts.length >= 2
        tokens[:ContactName] = parts[1]
      end
    when "email", "email_attachment"
      # "Emails/rachel@tekna.com.au/2025/11" → Mailbox, Year, Month
      if parts.length >= 2 && parts[0].downcase.start_with?("email")
        if tokens[:Mailbox].blank? || tokens[:Mailbox] == "Unknown"
          tokens[:Mailbox] = parts[1]
        end
        tokens[:Year] = parts[2] if parts.length >= 3 && parts[2] =~ /^\d{4}$/
        tokens[:Month] = parts[3] if parts.length >= 4 && parts[3] =~ /^\d{2}$/
      end
    when "corporate", "xero", "financial"
      # "Corporate/Default/Acme Corp" → CompanyGroup, CompanyName
      if parts.length >= 3 && parts[0] == "Corporate"
        tokens[:CompanyGroup] ||= parts[1]
        tokens[:CompanyName] ||= parts[2]
      end
    end
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

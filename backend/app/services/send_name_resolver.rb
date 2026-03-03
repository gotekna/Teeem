# frozen_string_literal: true

# SendNameResolver - SSoT for resolving document download filenames
#
# Phase 3: Warehouse Documents
#
# This service resolves the "Send Name" (download filename) for any document
# using templates with full sanitization for 100% accurate filenames.
#
# Usage:
#   resolver = SendNameResolver.new
#   filename = resolver.resolve(warehouse_document)
#   # => "RE Invoice Question - 17-01-2026.eml"
#
# For direct document resolution (without warehouse_document):
#   filename = resolver.resolve_for_documentable(email_attachment)
#
# Template Priority:
#   1. WarehouseDocument.download_name (if already set)
#   2. DocumentType.download_name template (expanded with context)
#   3. Source-specific defaults (e.g., "{Subject} - {Date}.eml" for emails)
#   4. WarehouseDocument.ui_name
#   5. Original filename
#   6. "document" (last resort)
#
class SendNameResolver
  # Maximum filename length (prevents filesystem issues)
  MAX_FILENAME_LENGTH = 200

  # Invalid characters for filenames (Windows + Unix combined)
  INVALID_FILENAME_CHARS = /[:\/*?"<>|\\]/

  # Resolve Send Name for a WarehouseDocument
  # @param warehouse_document [WarehouseDocument] The warehouse document record
  # @return [String] The resolved filename (sanitized, with extension)
  def resolve(warehouse_document)
    return "document" unless warehouse_document

    # 1. If download_name is already set and not a template, use it
    if warehouse_document.download_name.present? && !warehouse_document.download_name.include?("{")
      return sanitize_and_ensure_extension(warehouse_document.download_name, warehouse_document)
    end

    # 2. Try to expand template
    template = resolve_template(warehouse_document)
    if template.present?
      context = build_context(warehouse_document)
      expanded = expand_template(template, context)
      # FRC (Jan 2026): Check if expanded result is MEANINGFUL, not just present.
      # Templates like "{Subject} - {Date}.eml" become "- .eml" when tokens are missing.
      # A meaningful filename must have at least 3 alphanumeric chars (not counting extension).
      if expanded.present? && meaningful_filename?(expanded)
        return sanitize_and_ensure_extension(expanded, warehouse_document)
      end
    end

    # 3. Fallback chain
    # ⚠️ FRC (Feb 2026): Use respond_to? for duck-typed documentable methods.
    # Not all documentables have file_name (e.g., ExternalInvoice).
    documentable = warehouse_document.documentable
    fallback_name = warehouse_document.ui_name.presence ||
                    warehouse_document.original_filename.presence ||
                    (documentable.respond_to?(:file_name) ? documentable&.file_name.presence : nil) ||
                    "document"

    sanitize_and_ensure_extension(fallback_name, warehouse_document)
  end

  # Resolve UI Name for a WarehouseDocument (what user sees in File Warehouse)
  # Uses WFDT's effective_ui_name_template with auto-numbering for duplicates.
  # Falls back to "{DocTypeName} {Date} {Number}" when WFDT exists but has no template.
  #
  # @param warehouse_document [WarehouseDocument] The warehouse document record
  # @return [String, nil] The resolved UI name, or nil if no WFDT available
  def resolve_ui_name(warehouse_document)
    return nil unless warehouse_document

    wfdt = warehouse_document.warehouse_folder_document_type
    return nil unless wfdt

    context = build_context(warehouse_document)
    template = wfdt.effective_ui_name_template

    if template.present?
      expanded = expand_template(template, context)
      if expanded.present? && meaningful_filename?(expanded)
        # SSoT: Template is the authority for naming. If template doesn't include
        # {Number}, we respect that decision. Only templates with {Number} get numbering.
        return expanded
      end
    end

    # Smart fallback: Generate "{DocTypeName} {Date} {Number}" from WFDT context
    generate_default_ui_name(wfdt, context)
  end

  # Resolve Send Name directly from a documentable (without WarehouseDocument)
  # Useful for documents that haven't been migrated to warehouse yet
  # @param source_type [String] The source type for template selection
  # @return [String] The resolved filename
  def resolve_for_documentable(documentable, source_type: nil)
    return "document" unless documentable

    # Determine source type
    source_type ||= infer_source_type(documentable)

    # Build context from documentable
    context = build_context_from_documentable(documentable)

    # Get template from DocumentType (SSoT for non-warehouse documents)
    template = documentable&.document_type&.download_name.presence

    if template.present?
      expanded = expand_template(template, context)
      if expanded.present?
        return sanitize_and_ensure_extension(expanded, documentable)
      end
    end

    # Fallback - use respond_to? for duck-typed methods
    fallback = (documentable.respond_to?(:file_name) ? documentable&.file_name.presence : nil) ||
               (documentable.respond_to?(:filename) ? documentable&.filename.presence : nil) ||
               (documentable.respond_to?(:original_filename) ? documentable&.original_filename.presence : nil) ||
               "document"

    sanitize_and_ensure_extension(fallback, documentable)
  end

  private

  # Compute auto-number for a warehouse document to prevent duplicate names.
  # Counts existing WarehouseDocuments with same linkable + WFDT, returns next number.
  # Zero-padded to 2 digits: "01", "02", etc.
  #
  # @param warehouse_document [WarehouseDocument]
  # @return [String, nil] The number string, or nil if no numbering needed
  def compute_auto_number(warehouse_document)
    # Versioned documents don't get auto-numbered (versions track revisions instead)
    return nil if warehouse_document.version_group_id.present?

    wfdt_id = warehouse_document.warehouse_folder_document_type_id
    return nil unless wfdt_id.present?

    scope = WarehouseDocument.where(warehouse_folder_document_type_id: wfdt_id)

    # Scope by linkable if present (e.g., all "Site Photos" for this job)
    if warehouse_document.linkable_type.present? && warehouse_document.linkable_id.present?
      scope = scope.where(
        linkable_type: warehouse_document.linkable_type,
        linkable_id: warehouse_document.linkable_id
      )
    end

    # Exclude self if persisted (for re-computation on existing docs)
    scope = scope.where.not(id: warehouse_document.id) if warehouse_document.persisted?

    existing_count = scope.count
    next_number = existing_count + 1

    format("%02d", next_number)
  end

  # Resolve the template to use for this warehouse document
  def resolve_template(warehouse_document)
    documentable = warehouse_document.documentable

    # 1. Try download_name if it looks like a template
    if warehouse_document.download_name.present? && warehouse_document.download_name.include?("{")
      return warehouse_document.download_name
    end

    # 2. SSoT: Use WarehouseFolderDocumentType template chain (same path as ui_name)
    # Chain: WFDT.download_name_template → DocumentType.download_name → WarehouseFolder.download_name_template
    wfdt = warehouse_document.warehouse_folder_document_type
    if wfdt
      effective = wfdt.effective_download_name_template
      return effective if effective.present?
    end

    # No template found — falls through to fallback chain in resolve()
    nil
  end

  # Build template context from warehouse document
  # SSoT (Feb 2026): Checks linkable FIRST (photos use linkable: Job, not documentable),
  # then documentable, then metadata as fallback for tokens.
  #
  # ⚠️ DYNAMIC TOKEN RESOLUTION (Feb 2026)
  # ════════════════════════════════════════════════════════════════
  # Metadata keys auto-import into context. Any {PascalCase} token in a template
  # resolves from context[:snake_case] automatically. No hardcoded token list.
  # To add a new token: just put the data in metadata when creating the document.
  # ════════════════════════════════════════════════════════════════
  def build_context(warehouse_document)
    documentable = warehouse_document.documentable
    context = build_context_from_documentable(documentable)

    # Add warehouse document specific values
    context[:ui_name] = warehouse_document.ui_name
    context[:original_filename] = warehouse_document.original_filename
    context[:folder] = warehouse_document.folder_path
    context[:version_letter] = warehouse_document.version_letter

    # SSoT (Feb 2026): Extract tokens from linkable (photos link to Job directly)
    linkable = warehouse_document.linkable
    if linkable.present?
      case linkable
      when Job
        context[:job_code] ||= linkable.job_code
        context[:job_name] ||= linkable.title
        context[:job_title] ||= linkable.title
        context[:job_address] ||= linkable.address
      when Contact
        context[:name] ||= linkable.display_name
        context[:person_name] ||= linkable.display_name
        context[:contact_name] ||= linkable.display_name
      when Corporate
        context[:company_code] ||= linkable.company_code || linkable.try(:code)
        context[:company_name] ||= linkable.name
        context[:company_group] ||= linkable.company_group&.name
      end
    end

    # Auto-import ALL metadata keys into context (Feb 2026)
    # This is what makes the resolver dynamic - any key in metadata becomes a token.
    # e.g., metadata: {"bsb": "123-456"} → context[:bsb] → resolves {BSB} in templates
    meta = warehouse_document.metadata || {}
    meta.each do |key, value|
      next if value.blank?
      context_key = key.to_s.underscore.to_sym
      context[context_key] ||= value
    end

    # Override document_date with metadata date (e.g., cessation/appointment date)
    if meta["date"].present?
      context[:document_date] = Date.parse(meta["date"]) rescue context[:document_date]
    end

    # Map version_status → signed token (for {Signed} template token)
    if context[:version_status].present? && context[:signed].blank?
      context[:signed] = context[:version_status].to_s.capitalize
    end

    # Map executed_date from metadata string to Date for token expansion
    if context[:executed_date].is_a?(String) && context[:executed_date].present?
      context[:executed_date] = Date.parse(context[:executed_date]) rescue context[:executed_date]
    end

    # Document type from WFDT association (not just documentable)
    wfdt = warehouse_document.warehouse_folder_document_type
    if wfdt&.document_type
      context[:doc_type_name] ||= wfdt.document_type.name
      context[:doc_type_code] ||= wfdt.document_type.abbreviation || wfdt.document_type.try(:code)
      context[:category] ||= wfdt.document_type.try(:category)
    end
    # Metadata fallback for doc type
    context[:doc_type_name] ||= meta["document_type"] if meta["document_type"].present?

    # Expiry date from warehouse document
    context[:expiry_date] = warehouse_document.expiry_date if warehouse_document.expiry_date.present?

    # Auto-numbering: count existing docs with same linkable + WFDT, set {Number} token
    context[:number] = compute_auto_number(warehouse_document)

    context
  end

  # Build template context from any documentable
  def build_context_from_documentable(documentable)
    context = {}
    return context unless documentable

    # Common fields
    context[:document_date] = documentable&.created_at || Time.current
    context[:file_name] = documentable.respond_to?(:file_name) ? documentable&.file_name : nil

    # Email-specific context (SyncedEmail)
    if documentable.respond_to?(:synced_email) && documentable.email_warehouse
      email = documentable.email_warehouse
      context[:subject] = email.subject
      context[:from_name] = email.from_name
      context[:from_email] = email.from_email
      context[:received_date] = email.received_at || email.created_at
    elsif documentable.is_a?(SyncedEmail) || documentable.class.name == "SyncedEmail"
      context[:subject] = documentable.subject
      context[:from_name] = documentable.from_name
      context[:from_email] = documentable.from_email
      context[:received_date] = documentable.received_at || documentable.created_at
    end

    # Job context
    if documentable.respond_to?(:job) && documentable.job
      job = documentable.job
      context[:job_code] = job.job_code
      context[:job_name] = job.title
      context[:job_title] = job.title
      context[:job_address] = job.address
    end

    # Contact context
    if documentable.respond_to?(:contact) && documentable.contact
      contact = documentable.contact
      context[:name] = contact.display_name
      context[:person_name] = contact.display_name
    end

    # Company context
    if documentable.respond_to?(:corporate) && documentable.corporate
      company = documentable.corporate
      context[:company_code] = company.company_code || company.try(:code)
      context[:company_name] = company.name
      context[:company_group] = company.company_group&.name  # SSoT: use association
    end

    # Document type context
    # Note: Use document_type_record (association) not document_type (string column)
    # FRC (Feb 2026): Not all documentables have this association (e.g., ExternalInvoice has
    # invoice_type string, not a DocumentType FK). Guard with respond_to? to prevent NoMethodError.
    doc_type_record = documentable.respond_to?(:document_type_record) ? documentable&.document_type_record : nil
    if doc_type_record
      context[:doc_type_name] = doc_type_record.name
      context[:doc_type_code] = doc_type_record.abbreviation || doc_type_record.try(:code)
      context[:category] = doc_type_record.try(:category)
    end

    # User context
    if documentable.respond_to?(:user) && documentable.user
      context[:name] = documentable.user.name
    end

    # Task context
    if documentable.respond_to?(:sm_task) && documentable.sm_task
      task = documentable.sm_task
      context[:task_id] = task.id
      context[:task_number] = task.task_number
      context[:task_name] = task.name
    end

    context
  end

  # ⚠️ DYNAMIC TOKEN RESOLUTION (Feb 2026)
  # ════════════════════════════════════════════════════════════════
  # Why: Hardcoded replace_token calls went out of sync with templates.
  #      34 of 48 tokens in production templates had no resolver code.
  # How: Two phases:
  #   1. Compute formatted values for tokens that need special logic (dates, expiry)
  #   2. Auto-resolve ALL remaining {PascalCase} tokens from context[:snake_case]
  # Result: Add a token to template + put data in metadata = works. No code change.
  # ════════════════════════════════════════════════════════════════
  def expand_template(template, context)
    return nil if template.blank?

    result = template.dup

    # Phase 1: Compute formatted values into context for tokens needing special logic.
    # These MUST run before the auto-resolver because they derive values from raw data.
    compute_formatted_values(result, context)

    # Phase 2: Auto-resolve ALL remaining {Token} / {{Token}} patterns from context.
    # PascalCase token → snake_case key: {ContactName} → context[:contact_name]
    result.gsub!(/\{\{?(\w+)\}?\}/) do |match|
      token = $1
      key = token.underscore.to_sym
      value = context[key]
      if value.present?
        sanitize_for_template(value.to_s)
      else
        match # Leave unreplaced for cleanup
      end
    end

    # Phase 3: Clean up unreplaced tokens (both {Token} and {{Token}} syntax)
    result.gsub!(/\s*\{\{?[^}]+\}?\}\s*/, " ")

    # Clean up extra spaces
    result.gsub(/\s+/, " ").strip
  end

  # Compute formatted string values for tokens that need special logic.
  # These are PRE-COMPUTED into context so the auto-resolver picks them up.
  # Only ~12 tokens need this; the other 36+ resolve directly from context.
  def compute_formatted_values(_result, context)
    # --- Date tokens (derived from document_date) ---
    doc_date = context[:document_date] || context[:received_date] || Time.current
    doc_date = doc_date.to_date if doc_date.respond_to?(:to_date)

    context[:date]            ||= doc_date.strftime("%d-%m-%Y")
    context[:date_au]         ||= doc_date.strftime("%d-%m-%Y")
    context[:ddmmyyyy]        ||= doc_date.strftime("%d-%m-%Y")
    context[:yyyymmdd]        ||= doc_date.strftime("%Y-%m-%d")
    context[:date_time]       ||= Time.current.strftime("%Y-%m-%d %H:%M")
    context[:month_year]      ||= doc_date.strftime("%b %Y")
    context[:month_year_long] ||= doc_date.strftime("%B %Y")
    context[:yy]              ||= doc_date.strftime("%y")
    context[:fy]              ||= compute_financial_year(doc_date)
    context[:print_date]      ||= Time.current.strftime("%d-%m-%Y")

    # --- Email tokens (sanitized/truncated) ---
    if context[:subject].present?
      sanitized = sanitize_for_template(context[:subject])
      context[:subject] = sanitized
      context[:subject_short] ||= sanitized[0..49].to_s.strip
    end

    if context[:received_date]
      recv = context[:received_date]
      recv_date = recv.respond_to?(:to_date) ? recv.to_date : doc_date
      context[:received_date]      = recv_date.strftime("%d-%m-%Y")
      context[:received_date_sort] ||= recv_date.strftime("%Y-%m-%d")
      context[:received_time]      ||= (recv.respond_to?(:strftime) ? recv.strftime("%H-%M") : "")
    end

    # --- Expiry tokens (prefixed formatted dates) ---
    if context[:expiry_date]
      exp = context[:expiry_date].to_date rescue nil
      if exp
        context[:ex]     ||= "EX #{exp.strftime('%d/%m/%y')}"
        context[:expiry] ||= "Expiry #{exp.strftime('%-d %B %Y')}"
      end
    end

    # --- Executed date tokens (prefixed formatted dates) ---
    if context[:executed_date]
      exc = context[:executed_date].to_date rescue nil
      if exc
        context[:exc]      ||= "EXC #{exc.strftime('%d/%m/%y')}"
        context[:executed]  ||= "Executed #{exc.strftime('%-d %B %Y')}"
      end
    end

    # --- File tokens (derived from original filename) ---
    if context[:original_filename].present?
      original = context[:original_filename]
      context[:original_file_name]          ||= File.basename(original, ".*")
      context[:original_file_name_with_ext] ||= original
      context[:file_extension]              ||= File.extname(original).delete_prefix(".")
    end

    # --- Date range tokens (format if raw Date/Time objects) ---
    [:from_date, :to_date].each do |key|
      if context[key].respond_to?(:strftime) && !context[key].is_a?(String)
        context[key] = context[key].strftime("%d-%m-%Y")
      end
    end

    # --- TaskID alias (TaskId and TaskID both map to task_id) ---
    # Already handled by underscore: "TaskId".underscore = "task_id", "TaskID".underscore = "task_id"
  end

  # Australian financial year: July 1 - June 30
  # FY2026 = July 2025 through June 2026
  def compute_financial_year(date)
    fy_year = date.month >= 7 ? date.year + 1 : date.year
    "FY#{fy_year}"
  end

  # Sanitize a value for use in templates (not the final filename)
  def sanitize_for_template(value)
    return "" if value.blank?

    value.to_s
         .gsub(INVALID_FILENAME_CHARS, " ")
         .gsub(/\s+/, " ")
         .strip
  end

  # Full sanitization + extension handling + version suffix
  def sanitize_and_ensure_extension(name, source)
    name = full_sanitize(name)
    name = truncate_filename(name)
    name = ensure_extension(name, source)
    name = append_version_suffix(name, source)
    name
  end

  # Append version letter suffix before extension: "Floor Plan.pdf" → "Floor Plan-A.pdf"
  # Only applies to WarehouseDocuments with a version_letter set.
  def append_version_suffix(name, source)
    return name unless source.is_a?(WarehouseDocument)
    return name unless source.version_letter.present?

    ext = File.extname(name)
    base = File.basename(name, ext)
    "#{base}-#{source.version_letter}#{ext}"
  end

  # Full sanitization for 100% accurate filenames
  def full_sanitize(name)
    return "document" if name.blank?

    # 1. Remove invalid chars
    clean = name.to_s.gsub(INVALID_FILENAME_CHARS, " ")

    # 2. Remove control characters
    clean = clean.gsub(/[\x00-\x1f\x7f]/, "")

    # 3. Collapse multiple spaces
    clean = clean.gsub(/\s+/, " ").strip

    # 4. Ensure we have something
    clean.presence || "document"
  end

  # Truncate filename if too long
  def truncate_filename(name)
    return name if name.length <= MAX_FILENAME_LENGTH

    ext = File.extname(name)
    base = File.basename(name, ext)
    max_base = MAX_FILENAME_LENGTH - ext.length - 3 # -3 for "..."
    max_base = [max_base, 10].max # Ensure at least 10 chars for base

    "#{base[0...max_base]}...#{ext}"
  end

  # Ensure filename has an extension
  def ensure_extension(name, source)
    return name if File.extname(name).present?

    # Try to get extension from source
    ext = infer_extension(source)
    ext ||= ".pdf" # Default fallback

    "#{name}#{ext}"
  end

  # Infer file extension from source
  def infer_extension(source)
    return nil unless source

    # From WarehouseDocument
    if source.is_a?(WarehouseDocument)
      return infer_extension_from_content_type(source.content_type) ||
             infer_extension_from_filename(source.original_filename) ||
             infer_extension(source.documentable)
    end

    # From content_type
    if source.respond_to?(:content_type) && source.content_type.present?
      ext = infer_extension_from_content_type(source.content_type)
      return ext if ext
    end

    # From file_name
    if source.respond_to?(:file_name) && source.file_name.present?
      ext = File.extname(source.file_name)
      return ext if ext.present?
    end

    # From filename
    if source.respond_to?(:filename) && source.filename.present?
      ext = File.extname(source.filename.to_s)
      return ext if ext.present?
    end

    # From original_filename
    if source.respond_to?(:original_filename) && source.original_filename.present?
      ext = File.extname(source.original_filename)
      return ext if ext.present?
    end

    nil
  end

  def infer_extension_from_content_type(content_type)
    return nil if content_type.blank?

    case content_type.downcase
    when "application/pdf" then ".pdf"
    when "message/rfc822" then ".eml"
    when "application/msword" then ".doc"
    when /wordprocessingml/ then ".docx"
    when "application/vnd.ms-excel" then ".xls"
    when /spreadsheetml/ then ".xlsx"
    when "image/jpeg" then ".jpg"
    when "image/png" then ".png"
    when "image/gif" then ".gif"
    when "text/plain" then ".txt"
    when "text/csv" then ".csv"
    when "application/zip" then ".zip"
    else nil
    end
  end

  def infer_extension_from_filename(filename)
    return nil if filename.blank?

    ext = File.extname(filename.to_s)
    ext.present? ? ext : nil
  end

  # Infer source type from documentable class
  def infer_source_type(documentable)
    case documentable.class.name
    when "SyncedEmail"
      "email"
    when "ContactDocument"
      "contact"
    when "UserDocument"
      "user"
    when "DocumentTemplate"
      "template"
    else
      "corporate" # Default fallback
    end
  end

  # FRC (Jan 2026): Check if a filename is meaningful (not just punctuation/extension)
  # Templates with missing tokens produce garbage like "- .eml", "Task -.pdf"
  #
  # Garbage patterns from failed template expansion:
  # - "- .eml" → {Subject} missing
  # - "Task -.pdf" → Task {Number} - {Description} with tokens missing
  # - " - 17-01-2026.eml" → Just date, no subject
  #
  # @param filename [String] The filename to check
  # @return [Boolean] True if filename has meaningful content
  # Generate a default UI name when WFDT exists but has no template configured.
  # Pattern: "{DocTypeName} {Date} {Number}" e.g. "Site Photo 09-02-2026 01"
  #
  # @param wfdt [WarehouseFolderDocumentType] The WFDT (must be present)
  # @param context [Hash] The expanded context with :doc_type_name, :number, etc.
  # @return [String, nil] The generated name, or nil if no doc type
  def generate_default_ui_name(wfdt, context)
    doc_type_name = context[:doc_type_name] || wfdt.document_type&.name
    return nil unless doc_type_name.present?

    doc_date = (context[:document_date] || Time.current).strftime("%d-%m-%Y")

    parts = [doc_type_name, doc_date]
    parts << context[:number] if context[:number].present?

    parts.join(" ").presence
  end

  def meaningful_filename?(filename)
    return false if filename.blank?

    # Remove extension
    base = File.basename(filename.to_s, ".*")

    # Garbage patterns from failed template expansion
    garbage_patterns = [
      /^[\s\-]+$/,           # Just spaces and dashes
      /^Task\s*[\-\s]*$/i,   # "Task" or "Task -" alone
      /^[\s\-]*\d{2}-\d{2}-\d{4}[\s\-]*$/,  # Just a date like "17-01-2026"
      /^[\s\-]*\d{4}-\d{2}-\d{2}[\s\-]*$/,  # Just a date like "2026-01-17"
    ]

    return false if garbage_patterns.any? { |p| base.match?(p) }

    # Count alphanumeric characters (excluding common template words)
    cleaned = base.gsub(/\b(Task|Email)\b/i, "")
    alnum_count = cleaned.gsub(/[^a-zA-Z0-9]/, "").length

    # Must have at least 3 alphanumeric chars beyond template words
    alnum_count >= 3
  end
end

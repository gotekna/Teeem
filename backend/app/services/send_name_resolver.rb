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
#   1. WarehouseDocument.send_name (if already set)
#   2. DocumentType.file_name template (expanded with context)
#   3. Source-specific defaults (e.g., "{Subject} - {Date}.eml" for emails)
#   4. WarehouseDocument.display_name
#   5. Original filename
#   6. "document" (last resort)
#
class SendNameResolver
  # Maximum filename length (prevents filesystem issues)
  MAX_FILENAME_LENGTH = 200

  # Invalid characters for filenames (Windows + Unix combined)
  INVALID_FILENAME_CHARS = /[:\/*?"<>|\\]/

  # Default templates by source type
  DEFAULT_TEMPLATES = {
    "email" => "{Subject} - {ReceivedDate}.eml",
    "corporate" => "{CompanyCode} {DocTypeName} {Date}",
    "job" => "{JobCode} {DocTypeName} {Date}",
    "task" => "Task {Number} - {Description}",
    "people" => "{PersonName} {DocTypeName}",
    "contact" => "{Name} {DocTypeName}",
    "user" => "{Name}",
    "template" => "{Name}"
  }.freeze

  # Resolve Send Name for a WarehouseDocument
  # @param warehouse_document [WarehouseDocument] The warehouse document record
  # @return [String] The resolved filename (sanitized, with extension)
  def resolve(warehouse_document)
    return "document" unless warehouse_document

    # 1. If send_name is already set and not a template, use it
    if warehouse_document.send_name.present? && !warehouse_document.send_name.include?("{")
      return sanitize_and_ensure_extension(warehouse_document.send_name, warehouse_document)
    end

    # 2. Try to expand template
    template = resolve_template(warehouse_document)
    if template.present?
      context = build_context(warehouse_document)
      expanded = expand_template(template, context)
      return sanitize_and_ensure_extension(expanded, warehouse_document) if expanded.present?
    end

    # 3. Fallback chain
    fallback_name = warehouse_document.display_name.presence ||
                    warehouse_document.original_filename.presence ||
                    warehouse_document.documentable&.try(:file_name).presence ||
                    "document"

    sanitize_and_ensure_extension(fallback_name, warehouse_document)
  end

  # Resolve Send Name directly from a documentable (without WarehouseDocument)
  # Useful for documents that haven't been migrated to warehouse yet
  # @param documentable [ActiveRecord::Base] The document (EmailAttachment, JobDocument, etc.)
  # @param source_type [String] The source type for template selection
  # @return [String] The resolved filename
  def resolve_for_documentable(documentable, source_type: nil)
    return "document" unless documentable

    # Determine source type
    source_type ||= infer_source_type(documentable)

    # Build context from documentable
    context = build_context_from_documentable(documentable)

    # Get template
    template = documentable.try(:document_type)&.file_name.presence ||
               DEFAULT_TEMPLATES[source_type]

    if template.present?
      expanded = expand_template(template, context)
      if expanded.present?
        return sanitize_and_ensure_extension(expanded, documentable)
      end
    end

    # Fallback
    fallback = documentable.try(:file_name).presence ||
               documentable.try(:filename).presence ||
               documentable.try(:original_filename).presence ||
               "document"

    sanitize_and_ensure_extension(fallback, documentable)
  end

  private

  # Resolve the template to use for this warehouse document
  def resolve_template(warehouse_document)
    documentable = warehouse_document.documentable

    # 1. Try send_name if it looks like a template
    if warehouse_document.send_name.present? && warehouse_document.send_name.include?("{")
      return warehouse_document.send_name
    end

    # 2. Try DocumentType.file_name template
    # Note: Use document_type_record (association) not document_type (string column)
    doc_type_record = documentable.try(:document_type_record) || documentable.try(:document_type)
    if doc_type_record.respond_to?(:file_name) && doc_type_record.file_name.present?
      return doc_type_record.file_name
    end

    # 3. Use source-specific default template
    DEFAULT_TEMPLATES[warehouse_document.source_type]
  end

  # Build template context from warehouse document
  def build_context(warehouse_document)
    documentable = warehouse_document.documentable
    context = build_context_from_documentable(documentable)

    # Add warehouse document specific values
    context[:display_name] = warehouse_document.display_name
    context[:original_filename] = warehouse_document.original_filename
    context[:folder] = warehouse_document.folder

    context
  end

  # Build template context from any documentable
  def build_context_from_documentable(documentable)
    context = {}
    return context unless documentable

    # Common fields
    context[:document_date] = documentable.try(:created_at) || Time.current
    context[:file_name] = documentable.try(:file_name)

    # Email-specific context (EmailWarehouse, EmailAttachment)
    if documentable.respond_to?(:email_warehouse) && documentable.email_warehouse
      email = documentable.email_warehouse
      context[:subject] = email.subject
      context[:from_name] = email.from_name
      context[:from_email] = email.from_email
      context[:received_date] = email.received_at || email.created_at
    elsif documentable.is_a?(EmailWarehouse) || documentable.class.name == "EmailWarehouse"
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
    if documentable.respond_to?(:corporate_company) && documentable.corporate_company
      company = documentable.corporate_company
      context[:company_code] = company.company_code || company.code
      context[:company_name] = company.name
      context[:company_group] = company.company_group  # String column, not association
    end

    # Document type context
    # Note: Use document_type_record (association) not document_type (string column)
    doc_type_record = documentable.try(:document_type_record)
    if doc_type_record
      context[:doc_type_name] = doc_type_record.name
      context[:doc_type_code] = doc_type_record.abbreviation || doc_type_record.try(:code)
      context[:category] = doc_type_record.category
    end

    # User context
    if documentable.respond_to?(:user) && documentable.user
      context[:name] = documentable.user.name
    end

    context
  end

  # Expand template with context values
  def expand_template(template, context)
    return nil if template.blank?

    result = template.dup

    # Date tokens
    doc_date = context[:document_date] || context[:received_date] || Time.current
    doc_date = doc_date.to_date if doc_date.respond_to?(:to_date)

    result.gsub!("{Date}", doc_date.strftime("%d-%m-%Y"))
    result.gsub!("{DDMMYYYY}", doc_date.strftime("%d-%m-%Y"))
    result.gsub!("{YYYYMMDD}", doc_date.strftime("%Y-%m-%d"))

    # Email tokens
    if context[:subject].present?
      sanitized_subject = sanitize_for_template(context[:subject])
      result.gsub!("{Subject}", sanitized_subject)
      result.gsub!("{SubjectShort}", sanitized_subject[0..49].to_s.strip)
    end
    result.gsub!("{FromName}", context[:from_name].to_s) if context[:from_name]
    result.gsub!("{FromEmail}", context[:from_email].to_s) if context[:from_email]
    if context[:received_date]
      recv_date = context[:received_date].to_date rescue doc_date
      result.gsub!("{ReceivedDate}", recv_date.strftime("%d-%m-%Y"))
    end

    # Job tokens
    result.gsub!("{JobCode}", context[:job_code].to_s) if context[:job_code]
    result.gsub!("{JobName}", context[:job_name].to_s) if context[:job_name]
    result.gsub!("{JobTitle}", context[:job_title].to_s) if context[:job_title]

    # Company tokens
    result.gsub!("{CompanyCode}", context[:company_code].to_s) if context[:company_code]
    result.gsub!("{CompanyName}", context[:company_name].to_s) if context[:company_name]
    result.gsub!("{CompanyGroup}", context[:company_group].to_s) if context[:company_group]

    # Person/Contact tokens
    result.gsub!("{Name}", context[:name].to_s) if context[:name]
    result.gsub!("{PersonName}", context[:person_name].to_s) if context[:person_name]

    # Document type tokens
    result.gsub!("{DocTypeName}", context[:doc_type_name].to_s) if context[:doc_type_name]
    result.gsub!("{DocTypeCode}", context[:doc_type_code].to_s) if context[:doc_type_code]
    result.gsub!("{Category}", context[:category].to_s) if context[:category]

    # Generic tokens
    result.gsub!("{Description}", context[:description].to_s) if context[:description]
    result.gsub!("{Number}", context[:number].to_s) if context[:number]
    result.gsub!("{Folder}", context[:folder].to_s) if context[:folder]

    # Clean up unreplaced tokens
    result.gsub!(/\s*\{[^}]+\}\s*/, " ")

    # Clean up extra spaces
    result.gsub(/\s+/, " ").strip
  end

  # Sanitize a value for use in templates (not the final filename)
  def sanitize_for_template(value)
    return "" if value.blank?

    value.to_s
         .gsub(INVALID_FILENAME_CHARS, " ")
         .gsub(/\s+/, " ")
         .strip
  end

  # Full sanitization + extension handling
  def sanitize_and_ensure_extension(name, source)
    name = full_sanitize(name)
    name = truncate_filename(name)
    name = ensure_extension(name, source)
    name
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
    when "EmailAttachment", "EmailWarehouse"
      "email"
    when "JobDocument"
      "job"
    when "CorporateCompanyDocument"
      "corporate"
    when "PeopleDocument"
      "people"
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
end

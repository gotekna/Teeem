# frozen_string_literal: true

# FolderTemplateReorganizationService - SSoT for reorganizing files when folder templates change
#
# When folder path templates change in Entity Config (StorageConfiguration.scope_templates),
# this service automatically moves files to match the new folder structure.
#
# Usage:
#   service = FolderTemplateReorganizationService.new(
#     scope: "corporate",
#     old_template: "{{CompanyCode}}/{{TabName}}",
#     new_template: "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}"
#   )
#   result = service.execute
#   # => { success: true, stats: { moved: 45, skipped: 5, errors: [], total: 50 } }
#
# Background Job:
#   FolderTemplateReorganizationJob.perform_later(
#     scope: "corporate",
#     old_template: "...",
#     new_template: "..."
#   )
#
class FolderTemplateReorganizationService
  include DocumentTemplatable

  # Document models by scope
  SCOPE_DOCUMENT_MODELS = {
    "job" => "JobDocument",
    "jobs" => "JobDocument",
    "corporate" => "CorporateCompanyDocument",
    "corporate_entity" => "CorporateCompanyDocument",
    "company" => "CorporateCompanyDocument",
    "people" => "PeopleDocument",
    "contact" => "PeopleDocument",
    "contacts" => "PeopleDocument",
    "email" => "EmailWarehouse",
    "emails" => "EmailWarehouse",
    "task" => "SmTaskAttachment",
    "tasks" => "SmTaskAttachment"
  }.freeze

  def initialize(scope:, old_template:, new_template:, dry_run: false)
    @scope = scope.to_s
    @old_template = old_template
    @new_template = new_template
    @dry_run = dry_run
    @stats = { moved: 0, skipped: 0, errors: [], total: 0 }
  end

  def execute
    Rails.logger.info "[FolderReorg] Starting reorganization for scope '#{@scope}'"
    Rails.logger.info "[FolderReorg] Old template: #{@old_template}"
    Rails.logger.info "[FolderReorg] New template: #{@new_template}"
    Rails.logger.info "[FolderReorg] Dry run: #{@dry_run}"

    # Validate scope
    model_name = SCOPE_DOCUMENT_MODELS[@scope]
    unless model_name
      return error_result("Unknown scope: #{@scope}")
    end

    # Get document model class
    begin
      @document_model = model_name.constantize
    rescue NameError
      return error_result("Document model not found: #{model_name}")
    end

    # Get storage provider
    @storage_config = StorageConfiguration.instance
    unless @storage_config
      return error_result("No storage configuration found")
    end

    @provider = get_storage_provider
    unless @provider
      return error_result("No storage provider available")
    end

    # Process documents
    process_documents

    Rails.logger.info "[FolderReorg] Completed: #{@stats}"
    { success: true, stats: @stats }
  rescue StandardError => e
    Rails.logger.error "[FolderReorg] Error: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    { success: false, error: e.message, stats: @stats }
  end

  private

  def error_result(message)
    Rails.logger.error "[FolderReorg] #{message}"
    { success: false, error: message, stats: @stats }
  end

  def get_storage_provider
    case @storage_config.provider_type
    when "sharepoint"
      credential = MicrosoftCredential.sharepoint_credential
      return nil unless credential
      DocumentProviders::SharePoint.new(credential)
    when "s3", "wasabi"
      credential = S3CompatibleCredential.active.first
      return nil unless credential
      DocumentProviders::S3Compatible.new(credential)
    else
      nil
    end
  rescue => e
    Rails.logger.error "[FolderReorg] Failed to get storage provider: #{e.message}"
    nil
  end

  def process_documents
    documents = get_documents_for_scope
    @stats[:total] = documents.count

    Rails.logger.info "[FolderReorg] Processing #{@stats[:total]} documents"

    documents.find_each.with_index do |doc, index|
      process_document(doc)

      # Log progress every 100 documents
      if (index + 1) % 100 == 0
        Rails.logger.info "[FolderReorg] Progress: #{index + 1}/#{@stats[:total]}"
      end
    end
  end

  def get_documents_for_scope
    case @scope
    when "job", "jobs"
      JobDocument.where.not(folder_path: [nil, ""])
    when "corporate", "corporate_entity", "company"
      CorporateCompanyDocument.where.not(folder: [nil, ""])
    when "people", "contact", "contacts"
      # PeopleDocument may not exist yet
      defined?(PeopleDocument) ? PeopleDocument.where.not(folder_path: [nil, ""]) : []
    when "email", "emails"
      EmailWarehouse.where.not(sharepoint_email_path: [nil, ""])
    else
      []
    end
  end

  def process_document(doc)
    # Build template context from document's associated entity
    context = build_context_for_document(doc)

    # Get current folder path
    old_path = get_document_folder_path(doc)
    return skip_document(doc, "No current folder path") if old_path.blank?

    # Calculate new path using new template
    new_path = expand_template(@new_template, context)
    return skip_document(doc, "Could not calculate new path") if new_path.blank?

    # Skip if paths are the same
    if normalize_path(old_path) == normalize_path(new_path)
      @stats[:skipped] += 1
      return
    end

    # Move the file
    move_document(doc, old_path, new_path, context)
  rescue => e
    @stats[:errors] << { document_id: doc.id, error: e.message }
    Rails.logger.warn "[FolderReorg] Error processing document #{doc.id}: #{e.message}"
  end

  def skip_document(doc, reason)
    @stats[:skipped] += 1
    Rails.logger.debug "[FolderReorg] Skipping document #{doc.id}: #{reason}"
  end

  def build_context_for_document(doc)
    context = {}

    case @scope
    when "job", "jobs"
      job = doc.job
      if job
        context[:job_code] = job.code
        context[:job_name] = job.name
        context[:job_title] = job.title
        context[:job_address] = job.address
        context[:lot_number] = job.lot_number
        context[:street_name] = job.street_name
        context[:suburb] = job.suburb
        context[:project_name] = job.project_name
      end
      # Tab/Category info
      context[:category] = doc.folder_path&.split("/")&.last
      context[:tab_name] = doc.folder_path&.split("/")&.first

    when "corporate", "corporate_entity", "company"
      company = doc.corporate_company || doc.company
      if company
        context[:company_code] = company.code
        context[:company_name] = company.name
        context[:company_group] = company.company_group&.name
      end
      context[:category] = doc.folder
      context[:tab_name] = doc.folder

    when "people", "contact", "contacts"
      contact = doc.contact
      if contact
        context[:person_code] = contact.code
        context[:person_name] = contact.full_name || contact.name
        context[:contact_name] = contact.full_name || contact.name
      end
      context[:category] = doc.respond_to?(:folder_path) ? doc.folder_path : nil
      context[:tab_name] = context[:category]

    when "email", "emails"
      context[:year] = doc.received_at&.year || doc.created_at.year
      context[:month] = doc.received_at&.strftime("%m") || doc.created_at.strftime("%m")
    end

    context
  end

  def get_document_folder_path(doc)
    case @scope
    when "job", "jobs"
      doc.folder_path
    when "corporate", "corporate_entity", "company"
      doc.folder
    when "people", "contact", "contacts"
      doc.respond_to?(:folder_path) ? doc.folder_path : nil
    when "email", "emails"
      doc.sharepoint_email_path
    else
      nil
    end
  end

  def expand_template(template, context)
    return template if template.blank?

    result = template.dup

    # Company tokens
    result.gsub!("{{CompanyCode}}", context[:company_code].to_s)
    result.gsub!("{{CompanyName}}", context[:company_name].to_s)
    result.gsub!("{{CompanyGroup}}", context[:company_group].to_s)

    # Job tokens
    result.gsub!("{{JobCode}}", context[:job_code].to_s)
    result.gsub!("{{JobName}}", context[:job_name].to_s)
    result.gsub!("{{JobTitle}}", context[:job_title].to_s)
    result.gsub!("{{JobAddress}}", context[:job_address].to_s)
    result.gsub!("{{LotNumber}}", context[:lot_number].to_s)
    result.gsub!("{{StreetName}}", context[:street_name].to_s)
    result.gsub!("{{Suburb}}", context[:suburb].to_s)
    result.gsub!("{{ProjectName}}", context[:project_name].to_s)

    # Person/Contact tokens
    result.gsub!("{{PersonCode}}", context[:person_code].to_s)
    result.gsub!("{{PersonName}}", context[:person_name].to_s)
    result.gsub!("{{ContactName}}", context[:contact_name].to_s)

    # Category/Tab tokens
    result.gsub!("{{Category}}", context[:category].to_s)
    result.gsub!("{{TabName}}", context[:tab_name].to_s)
    result.gsub!("{{Folder}}", context[:folder].to_s)

    # Date tokens
    result.gsub!("{{Year}}", context[:year].to_s)
    result.gsub!("{{Month}}", context[:month].to_s)

    # Clean up empty tokens and extra slashes
    result.gsub!(/\{\{[^}]+\}\}/, "")
    result.gsub!(%r{//+}, "/")
    result.gsub!(%r{^/|/$}, "")

    result
  end

  def normalize_path(path)
    return "" if path.blank?
    path.gsub(%r{//+}, "/").gsub(%r{^/|/$}, "").downcase
  end

  def move_document(doc, old_path, new_path, context)
    storage_reference = get_storage_reference(doc)

    if storage_reference.blank?
      @stats[:skipped] += 1
      Rails.logger.debug "[FolderReorg] No storage reference for document #{doc.id}"
      return
    end

    # Get full paths including base scope folder
    base_folder = @storage_config.path_for(@scope)
    full_old_path = File.join(@storage_config.root_path, base_folder, old_path)
    full_new_path = File.join(@storage_config.root_path, base_folder, new_path)

    Rails.logger.info "[FolderReorg] Moving document #{doc.id}: #{old_path} -> #{new_path}"

    if @dry_run
      Rails.logger.info "[FolderReorg] DRY RUN - Would move: #{full_old_path} -> #{full_new_path}"
      @stats[:moved] += 1
      return
    end

    # Create destination folder if needed
    begin
      ensure_folder_exists(File.dirname(full_new_path))
    rescue => e
      @stats[:errors] << { document_id: doc.id, error: "Failed to create folder: #{e.message}" }
      return
    end

    # Move the file in storage
    begin
      @provider.move_file(storage_reference, File.dirname(full_new_path))
    rescue DocumentProviders::NotFoundError
      # File doesn't exist in storage - update DB path anyway
      Rails.logger.warn "[FolderReorg] File not found in storage for document #{doc.id}"
    rescue => e
      @stats[:errors] << { document_id: doc.id, error: "Move failed: #{e.message}" }
      return
    end

    # Update database record
    update_document_path(doc, new_path)
    @stats[:moved] += 1
  end

  def get_storage_reference(doc)
    case @scope
    when "job", "jobs"
      doc.sharepoint_item_id || doc.storage_item_id
    when "corporate", "corporate_entity", "company"
      doc.sharepoint_file_id || doc.storage_item_id
    when "people", "contact", "contacts"
      doc.respond_to?(:sharepoint_file_id) ? doc.sharepoint_file_id : nil
    when "email", "emails"
      doc.sharepoint_email_file_id
    else
      nil
    end
  end

  def ensure_folder_exists(path)
    # Create folder if it doesn't exist
    @provider.create_folder(path) rescue nil
  end

  def update_document_path(doc, new_path)
    case @scope
    when "job", "jobs"
      doc.update_columns(folder_path: new_path, storage_path: new_path)
    when "corporate", "corporate_entity", "company"
      doc.update_columns(folder: new_path, storage_path: new_path)
    when "people", "contact", "contacts"
      doc.update_columns(folder_path: new_path) if doc.respond_to?(:folder_path)
    when "email", "emails"
      # Email paths are calculated, not stored directly
      nil
    end
  end

  # DocumentTemplatable requires this method
  def template_context
    {}
  end
end

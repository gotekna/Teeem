# Service to organize documents for a case
# Implements SSoT (Single Source of Truth) strategy:
# - Scans source folders for documents
# - Checks against existing company_documents (SSoT)
# - Files to correct location based on document type
# - Links to case via case_documents join table
# SSoT: Uses DocumentProviderAware for provider-agnostic storage operations
class CaseDocumentOrganizationService
  include DocumentProviderAware

  attr_reader :case_record, :results

  # Document type to folder mapping
  DOCUMENT_TYPE_FOLDERS = {
    # Financials go to Corporate folder
    "tax_return" => :corporate,
    "financial_statement" => :corporate,
    "bas" => :corporate,
    "audit_report" => :corporate,

    # Legal/Register documents
    "constitution" => :register,
    "trust_deed" => :register,
    "share_certificate" => :register,
    "minutes" => :register,

    # Everything else goes to case folder
    "correspondence" => :case_folder,
    "evidence" => :case_folder,
    "other" => :case_folder
  }.freeze

  def initialize(case_record)
    @case_record = case_record
    @results = {
      scanned: 0,
      linked_existing: 0,
      filed_new: 0,
      duplicates_found: 0,
      errors: []
    }
  end

  # Main entry point - organize all documents from source folders
  def organize_all
    return @results if case_record.source_folder_paths.blank?

    Rails.logger.info "[CaseDocumentOrganization] Starting for case #{case_record.id}"

    # Step 1: Scan all source folders and build file inventory
    file_inventory = scan_source_folders

    # Step 2: Process each file
    file_inventory.each do |file_info|
      process_file(file_info)
    end

    Rails.logger.info "[CaseDocumentOrganization] Complete: #{@results.inspect}"
    @results
  end

  private

  # Scan all source folders and return array of file info hashes
  # SSoT: Uses DocumentProviderAware for provider-agnostic folder listing
  def scan_source_folders
    files = []

    # Setup provider once for the scan operation
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      @results[:errors] << { folder: "all", error: "Storage not connected: #{e.message}" }
      return files
    end

    case_record.source_folder_paths.each do |folder_path|
      begin
        folder = resolve_folder_path(folder_path)
        next unless folder

        # Get all files recursively using provider-agnostic method
        folder_files = list_folder_recursive_in_provider(folder[:path] || folder_path)

        folder_files.each do |file|
          next if file[:is_folder]

          files << {
            id: file[:id],
            path: file[:path],
            name: file[:name],
            size: file[:size],
            created_at: file[:created_at],
            modified_at: file[:modified_at],
            web_url: file[:web_url],
            source_folder: folder_path,
            mime_type: file[:mime_type]
          }
          @results[:scanned] += 1
        end
      rescue DocumentProviders::Error => e
        @results[:errors] << { folder: folder_path, error: e.message }
        Rails.logger.error "[CaseDocumentOrganization] Error scanning folder #{folder_path}: #{e.message}"
      rescue => e
        @results[:errors] << { folder: folder_path, error: e.message }
        Rails.logger.error "[CaseDocumentOrganization] Error scanning folder #{folder_path}: #{e.message}"
      end
    end

    # Calculate hashes for all files (for duplicate detection)
    files.each do |file|
      begin
        file[:content_hash] = get_file_hash_in_provider(file[:path] || file[:id])
      rescue => e
        Rails.logger.warn "[CaseDocumentOrganization] Could not hash file #{file[:name]}: #{e.message}"
        file[:content_hash] = nil
      end
    end

    # Deduplicate by content hash (keep first occurrence of each unique file)
    deduplicate_files(files)
  end

  # Remove duplicates from file list, keeping track of all locations
  def deduplicate_files(files)
    unique_files = {}

    files.each do |file|
      hash = file[:content_hash]

      if hash.blank?
        # Can't deduplicate without hash, include as-is
        unique_files[file[:id]] = file
      elsif unique_files[hash]
        # Duplicate found - add to original_locations
        unique_files[hash][:original_locations] ||= [ unique_files[hash][:source_folder] ]
        unique_files[hash][:original_locations] << file[:source_folder]
        unique_files[hash][:duplicate_count] = (unique_files[hash][:duplicate_count] || 0) + 1
      else
        # First occurrence
        unique_files[hash] = file
        unique_files[hash][:original_locations] = [ file[:source_folder] ]
        unique_files[hash][:duplicate_count] = 0
      end
    end

    unique_files.values
  end

  # Process a single file
  def process_file(file_info)
    # Step 1: Check if file already exists in company_documents (by hash)
    if file_info[:content_hash].present?
      existing_doc = CorporateCompanyDocument.find_by_content_hash(file_info[:content_hash])

      if existing_doc
        # File already exists - just link to case
        link_existing_document(existing_doc, file_info)
        return
      end
    end

    # Step 2: Check for duplicates across system (different hash but same name+company+FY)
    # This catches renamed or re-uploaded versions
    if duplicate_exists_fuzzy?(file_info)
      # Queue for user review
      queue_for_duplicate_review(file_info)
      return
    end

    # Step 3: File is new - determine correct location and create
    file_to_correct_location(file_info)
  end

  # Link an existing company_document to the case
  def link_existing_document(company_doc, file_info)
    CaseDocument.find_or_create_by!(
      case_id: case_record.id,
      company_document_id: company_doc.id
    ) do |cd|
      cd.source_type = "source_folder"
      cd.original_location = file_info[:source_folder]
      cd.action_taken = "linked"
    end

    @results[:linked_existing] += 1
    Rails.logger.info "[CaseDocumentOrganization] Linked existing document: #{company_doc.title}"
  end

  # Check for fuzzy duplicates (same name pattern)
  def duplicate_exists_fuzzy?(file_info)
    # For now, rely on content hash - fuzzy matching can be added later
    # when AI document classification is integrated
    false
  end

  # Queue a file for duplicate review
  def queue_for_duplicate_review(file_info)
    existing = CorporateCompanyDocument.find_by_content_hash(file_info[:content_hash])
    return unless existing

    DocumentDuplicateReview.find_or_create_by!(
      case_id: case_record.id,
      existing_document_id: existing.id,
      new_file_hash: file_info[:content_hash]
    ) do |review|
      review.new_file_path = file_info[:source_folder]
      review.new_file_name = file_info[:name]
      review.new_file_size = file_info[:size]
      review.source_type = "source_folder"
      review.status = "pending"
    end

    @results[:duplicates_found] += 1
  end

  # File document to correct location based on type
  # SSoT: Uses DocumentProviderAware for provider-agnostic file operations
  def file_to_correct_location(file_info)
    # Determine document type (can use AI later)
    doc_type = classify_document(file_info)
    target_location = DOCUMENT_TYPE_FOLDERS[doc_type] || :case_folder

    # Get destination folder path
    destination_folder_path = get_destination_folder_path(target_location)
    return unless destination_folder_path

    # Get date-based subfolder (YYYY-MM)
    file_date = parse_date(file_info[:created_at]) || Date.current
    date_folder_name = file_date.strftime("%Y-%m")
    date_folder_path = "#{destination_folder_path}/#{date_folder_name}"

    # Ensure date folder exists
    get_or_create_folder_path(date_folder_path)

    # Copy or move the file using provider-agnostic methods
    action = case_record.file_action || "copy"
    source_path = file_info[:path] || file_info[:id]

    if action == "move"
      result = move_file_in_provider(source_path, date_folder_path, file_info[:name])
    else
      result = copy_file_in_provider(source_path, date_folder_path, file_info[:name])
    end

    # Create company_document entry
    company_doc = create_company_document(file_info, result, doc_type)

    # Link to case
    CaseDocument.create!(
      case_id: case_record.id,
      company_document_id: company_doc.id,
      source_type: "source_folder",
      original_location: file_info[:source_folder],
      action_taken: action
    )

    @results[:filed_new] += 1
    Rails.logger.info "[CaseDocumentOrganization] Filed new document: #{file_info[:name]} -> #{target_location}"
  end

  # Simple document classification based on filename
  # Can be enhanced with AI later
  def classify_document(file_info)
    name = file_info[:name].downcase

    return "tax_return" if name.include?("tax") && name.include?("return")
    return "tax_return" if name.match?(/\bctr\b|\bttr\b/)
    return "bas" if name.include?("bas") || name.include?("activity statement")
    return "financial_statement" if name.include?("financial") || name.include?("accounts")
    return "constitution" if name.include?("constitution")
    return "trust_deed" if name.include?("trust") && name.include?("deed")
    return "minutes" if name.include?("minutes")

    "other"
  end

  # Get destination folder path based on target location
  # SSoT: Uses StorageConfiguration for path building
  def get_destination_folder_path(target_location)
    storage_config = StorageConfiguration.instance

    case target_location
    when :corporate
      # Get company's corporate folder
      company = case_record.corporate_company || case_record.corporate_companies.first
      return nil unless company

      # Build corporate folder path
      base_path = storage_config&.path_for(:corporate) || "Corporate"
      company_folder = company.document_folder_name || company.name
      "/#{base_path}/#{company_folder}"
    when :register
      company = case_record.corporate_company || case_record.corporate_companies.first
      return nil unless company

      # Build register folder path
      base_path = storage_config&.path_for(:corporate) || "Corporate"
      company_folder = company.document_folder_name || company.name
      "/#{base_path}/#{company_folder}/Register"
    when :case_folder
      # Use first filing folder path directly
      case_record.filing_folder_paths.first
    end
  end

  # Get or create a folder for a company (provider-agnostic)
  def get_or_create_company_folder_path(company, folder_type)
    storage_config = StorageConfiguration.instance
    base_path = storage_config&.path_for(:corporate) || "Corporate"
    company_folder = company.document_folder_name || company.name
    full_path = "/#{base_path}/#{company_folder}/#{folder_type}"

    # Ensure folder exists
    get_or_create_folder_path(full_path)

    full_path
  end

  # Resolve a folder path to folder info (provider-agnostic)
  def resolve_folder_path(path)
    # Path could be a Hash, path string, or ID
    if path.is_a?(Hash)
      path
    elsif path.start_with?("/")
      # Path string - verify it exists
      if folder_exists_in_provider?(path)
        { path: path, name: File.basename(path) }
      else
        nil
      end
    else
      # For non-path strings, try to get folder info
      # This handles legacy folder IDs for SharePoint
      begin
        result = get_folder_info_in_provider(path)
        {
          id: result[:id],
          path: result[:path],
          name: result[:name],
          web_url: result[:web_url]
        }
      rescue DocumentProviders::Error
        nil
      end
    end
  rescue => e
    Rails.logger.error "[CaseDocumentOrganization] Could not resolve folder path #{path}: #{e.message}"
    nil
  end

  # Create a company_document entry for a new file
  # SSoT: Handles both SharePoint and S3/Wasabi result formats
  def create_company_document(file_info, storage_result, doc_type)
    # Determine company
    company = case_record.corporate_company || case_record.corporate_companies.first

    # Handle both SharePoint (id/webUrl) and S3/Wasabi (path/url) result formats
    storage_file_id = nil
    storage_url = nil
    storage_path = nil

    if storage_result.is_a?(Hash)
      storage_file_id = storage_result["id"] || storage_result[:id]
      storage_url = storage_result["webUrl"] || storage_result[:web_url] || storage_result[:url]
      storage_path = storage_result[:path]
    end

    CorporateCompanyDocument.create!(
      corporate_company: company,
      title: file_info[:name],
      document_type: doc_type,
      file_name: file_info[:name],
      file_size: file_info[:size],
      mime_type: file_info[:mime_type],  # Required for PDF/image preview
      content_hash: file_info[:content_hash],
      sharepoint_file_id: storage_file_id,
      sharepoint_download_url: storage_url,
      storage_path: storage_path,
      source: "case_import",
      last_modified_at: parse_date(file_info[:modified_at])
    )
  end

  # Parse date string to Date object
  def parse_date(date_string)
    return nil if date_string.blank?
    DateTime.parse(date_string).to_date
  rescue
    nil
  end
end

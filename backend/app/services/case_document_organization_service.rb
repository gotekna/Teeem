# Service to organize documents for a case
# Implements SSoT (Single Source of Truth) strategy:
# - Scans source folders for documents
# - Checks against existing company_documents (SSoT)
# - Files to correct location based on document type
# - Links to case via case_documents join table
class CaseDocumentOrganizationService
  attr_reader :case_record, :graph_client, :results

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
    @graph_client = MicrosoftGraphClient.new
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
  def scan_source_folders
    files = []

    case_record.source_folder_paths.each do |folder_path|
      begin
        folder = resolve_folder_path(folder_path)
        next unless folder

        # Get all files recursively
        folder_files = @graph_client.list_folder_recursive(folder[:id])

        folder_files.each do |file|
          next if file[:is_folder]

          files << {
            id: file[:id],
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
      rescue => e
        @results[:errors] << { folder: folder_path, error: e.message }
        Rails.logger.error "[CaseDocumentOrganization] Error scanning folder #{folder_path}: #{e.message}"
      end
    end

    # Calculate hashes for all files (for duplicate detection)
    files.each do |file|
      begin
        file[:content_hash] = @graph_client.get_file_hash(file[:id])
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
  def file_to_correct_location(file_info)
    # Determine document type (can use AI later)
    doc_type = classify_document(file_info)
    target_location = DOCUMENT_TYPE_FOLDERS[doc_type] || :case_folder

    # Get destination folder
    destination_folder_id = get_destination_folder(target_location)
    return unless destination_folder_id

    # Get date-based subfolder (YYYY-MM)
    file_date = parse_date(file_info[:created_at]) || Date.current
    date_folder_name = file_date.strftime("%Y-%m")
    date_folder = @graph_client.get_or_create_subfolder(destination_folder_id, date_folder_name)

    # Copy or move the file
    action = case_record.file_action || "copy"
    if action == "move"
      result = @graph_client.move_file(file_info[:id], date_folder[:id])
    else
      result = @graph_client.copy_file(file_info[:id], date_folder[:id])
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

  # Get destination folder ID based on target location
  def get_destination_folder(target_location)
    case target_location
    when :corporate
      # Get company's corporate folder
      company = case_record.corporate_company || case_record.corporate_companies.first
      return nil unless company

      # Find or create corporate folder for company
      get_or_create_company_folder(company, "Corporate")
    when :register
      company = case_record.corporate_company || case_record.corporate_companies.first
      return nil unless company

      get_or_create_company_folder(company, "Register")
    when :case_folder
      # Use first filing folder
      folder_path = case_record.filing_folder_paths.first
      return nil unless folder_path

      folder = resolve_folder_path(folder_path)
      folder&.dig(:id)
    end
  end

  # Get or create a folder for a company
  def get_or_create_company_folder(company, folder_type)
    # This would integrate with existing company folder structure
    # For now, return the first filing folder as fallback
    folder_path = case_record.filing_folder_paths.first
    return nil unless folder_path

    folder = resolve_folder_path(folder_path)
    return nil unless folder

    @graph_client.get_or_create_subfolder(folder[:id], folder_type)[:id]
  end

  # Resolve a folder path to folder info
  def resolve_folder_path(path)
    # Path could be a folder ID or a path string
    if path.is_a?(Hash)
      path
    elsif path.start_with?("/")
      # Path string - resolve via Graph API
      @graph_client.get_folder_by_path(path.sub(/^\//, ""))
    else
      # Assume it's a folder ID
      result = @graph_client.get_file(path)
      {
        id: result["id"],
        name: result["name"],
        web_url: result["webUrl"]
      }
    end
  rescue => e
    Rails.logger.error "[CaseDocumentOrganization] Could not resolve folder path #{path}: #{e.message}"
    nil
  end

  # Create a company_document entry for a new file
  def create_company_document(file_info, graph_result, doc_type)
    # Determine company
    company = case_record.corporate_company || case_record.corporate_companies.first

    CorporateCompanyDocument.create!(
      corporate_company: company,
      title: file_info[:name],
      document_type: doc_type,
      file_name: file_info[:name],
      file_size: file_info[:size],
      content_hash: file_info[:content_hash],
      sharepoint_file_id: graph_result.is_a?(Hash) ? graph_result["id"] : nil,
      sharepoint_download_url: graph_result.is_a?(Hash) ? graph_result["webUrl"] : nil,
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

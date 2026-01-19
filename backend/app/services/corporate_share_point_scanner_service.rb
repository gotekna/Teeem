# =============================================================================
# CorporateSharePointScannerService - DOCUMENT SCANNER
# =============================================================================
# Purpose: Scan storage for existing corporate documents and link them to companies
# SSoT: This service READS from storage (discovery/scanning)
# SSoT: Uses DocumentProviderAware for provider-agnostic storage operations
#
# Key Methods:
#   - scan_all: Scan all corporate folders for documents
#   - scan_company: Scan a specific company's folder
#   - preview: Preview what documents would be linked
#   - link_document_to_company: Link a found document to a company
#
# RENAMED: CorporateOnedriveService → CorporateSharePointScannerService
# =============================================================================
class CorporateSharePointScannerService
  include DocumentProviderAware
  attr_reader :credential, :results, :folder_path

  # SSoT: Get the preferred company folder path from StorageConfiguration
  def self.company_folder_path
    StorageConfiguration.instance.path_for(:corporate)
  end

  # Try multiple possible paths for corporate documents
  # New structure uses company_folder_path with organized subfolders
  def self.default_folder_paths
    [
      company_folder_path,                    # SSoT: From StorageConfiguration (preferred)
      "Accounts - Internal/Corporate File",   # Robert's legacy SharePoint structure
      "Corporate File",                       # Legacy direct Corporate File folder
      "Corporate"                             # Legacy simple Corporate folder
    ]
  end

  # SSoT: Use StorageConfiguration.instance.path_for(:corporate) for folder paths

  # Known group folders that contain company subfolders
  # These match the groups defined in the Company model
  GROUP_FOLDERS = [
    "No Group",
    "Shareholder Only",
    "Team Harder Family Trust Group",
    "Team Harder Super Fund Group",
    "Team Harder Super Investments Group",
    "Tekna Group",
    "The Promise Group"
  ].freeze

  # Tab folders within each company folder (matching UI tabs)
  # SSoT: Fetch from EntityTab (unified tab model)
  def self.tab_folders
    @tab_folders ||= EntityTab.for_scope('corporate_entity')
                              .for_group('documents')
                              .enabled
                              .ordered
                              .pluck(:display_name)
  end

  def initialize(credential = nil, folder_path: nil)
    @credential = credential || MicrosoftCredential.sharepoint_credential
    @folder_path = folder_path || self.class.company_folder_path  # SSoT: CorporateCompanySetting
    @results = {
      companies_scanned: 0,
      documents_found: 0,
      documents_linked: 0,
      errors: []
    }
  end

  # Scan OneDrive for corporate documents and link them to companies
  def scan_all
    client = get_onedrive_client
    return { success: false, error: "SharePoint not connected" } unless client

    # Try to find corporate folder - try multiple paths if auto-detect enabled
    corporate_folder = nil
    found_path = nil

    if @folder_path == "auto"
      # Auto-detect: try each possible path
      self.class.default_folder_paths.each do |path|
        corporate_folder = find_folder_by_path(client, path)
        if corporate_folder
          found_path = path
          break
        end
      end
    else
      corporate_folder = find_folder_by_path(client, @folder_path)
      found_path = @folder_path
    end

    unless corporate_folder
      return {
        success: false,
        error: "Corporate folder not found. Tried: #{@folder_path == 'auto' ? self.class.default_folder_paths.join(', ') : @folder_path}"
      }
    end

    Rails.logger.info "Found corporate folder: #{corporate_folder['name']} (#{corporate_folder['id']}) at '#{found_path}'"

    # Get all items in corporate folder
    top_level_folders = list_folder_children(client, corporate_folder["id"])
    Rails.logger.info "Found #{top_level_folders.count} top-level folders"

    # Process folders - check if they are group folders or company folders
    top_level_folders.each do |folder|
      next unless folder["folder"] # Skip files

      if is_group_folder?(folder["name"])
        # This is a group folder - scan its children for company folders
        Rails.logger.info "Processing group folder: #{folder['name']}"
        group_children = list_folder_children(client, folder["id"])

        group_children.each do |company_folder|
          next unless company_folder["folder"]
          process_company_folder(client, company_folder, nil, folder["name"])
        end
      else
        # This is a company folder directly
        process_company_folder(client, folder)
      end
    end

    {
      success: true,
      folder_path: found_path,
      companies_scanned: @results[:companies_scanned],
      documents_found: @results[:documents_found],
      documents_linked: @results[:documents_linked],
      errors: @results[:errors]
    }
  rescue => e
    Rails.logger.error "Corporate OneDrive scan error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    {
      success: false,
      error: e.message
    }
  end

  # Check if folder name is a group folder
  def is_group_folder?(name)
    GROUP_FOLDERS.any? { |g| name.downcase.include?(g.downcase.gsub(" group", "")) } ||
      name.downcase.include?("group")
  end

  # Scan a specific company's OneDrive folder
  def scan_company(company)
    client = get_onedrive_client
    return { success: false, error: "SharePoint not connected" } unless client

    # Find the corporate root folder
    corporate_folder = find_folder_by_path(client, @folder_path)
    unless corporate_folder
      return {
        success: false,
        error: "Corporate folder not found at '#{@folder_path}'"
      }
    end

    # Find this company's folder - search both top-level and within group folders
    company_folder = nil
    group_name = nil

    top_level_folders = list_folder_children(client, corporate_folder["id"])

    # First, check if company folder is directly under corporate root
    company_folder = top_level_folders.find do |f|
      f["folder"] && folder_matches_company?(f["name"], company)
    end

    # If not found, search within group folders
    unless company_folder
      top_level_folders.each do |folder|
        next unless folder["folder"] && is_group_folder?(folder["name"])

        group_children = list_folder_children(client, folder["id"])
        matched_folder = group_children.find do |f|
          f["folder"] && folder_matches_company?(f["name"], company)
        end

        if matched_folder
          company_folder = matched_folder
          group_name = folder["name"]
          break
        end
      end
    end

    unless company_folder
      return {
        success: false,
        error: "No OneDrive folder found for #{company.name}"
      }
    end

    process_company_folder(client, company_folder, company, group_name)

    {
      success: true,
      documents_found: @results[:documents_found],
      documents_linked: @results[:documents_linked],
      errors: @results[:errors]
    }
  rescue => e
    Rails.logger.error "Company OneDrive scan error: #{e.message}"
    {
      success: false,
      error: e.message
    }
  end

  # Preview what would be scanned (without linking)
  def preview
    client = get_onedrive_client
    return { success: false, error: "SharePoint not connected" } unless client

    # Try to find corporate folder - try multiple paths if auto-detect enabled
    corporate_folder = nil
    found_path = nil

    if @folder_path == "auto"
      # Auto-detect: try each possible path
      self.class.default_folder_paths.each do |path|
        corporate_folder = find_folder_by_path(client, path)
        if corporate_folder
          found_path = path
          break
        end
      end
    else
      corporate_folder = find_folder_by_path(client, @folder_path)
      found_path = @folder_path
    end

    unless corporate_folder
      return {
        success: false,
        error: "Corporate folder not found. Tried: #{@folder_path == 'auto' ? self.class.default_folder_paths.join(', ') : @folder_path}"
      }
    end

    preview_results = []
    company_folders = list_folder_children(client, corporate_folder["id"])

    company_folders.each do |folder|
      next unless folder["folder"]

      company = find_matching_company(folder["name"])
      documents = scan_folder_for_documents(client, folder["id"], recursive: true)

      preview_results << {
        folder_name: folder["name"],
        folder_id: folder["id"],
        company_id: company&.id,
        company_name: company&.name,
        matched: company.present?,
        document_count: documents.count,
        documents: documents.map { |d| { name: d["name"], type: File.extname(d["name"]) } }
      }
    end

    {
      success: true,
      corporate_folder: found_path,
      companies: preview_results,
      total_folders: preview_results.count,
      matched_folders: preview_results.count { |r| r[:matched] },
      total_documents: preview_results.sum { |r| r[:document_count] }
    }
  rescue => e
    {
      success: false,
      error: e.message
    }
  end

  private

  # Extract clean folder path from SharePoint document metadata
  def extract_folder_path(doc, group_name = nil)
    # Try to get path from parentReference
    parent_path = doc.dig("parentReference", "path")

    if parent_path.present?
      # Path formats:
      # New: "/drive/root:/00 TEEEM PRIVATE/Tekna Group/TEK - Tekna Pty Ltd/ASIC"
      # Legacy: "/drive/root:/Corporate File/Team Harder Group/Tekna Drafting/Minutes"
      clean_path = parent_path
        .sub(%r{^/drive/root:/?}, "")  # Remove drive prefix
        .sub(%r{^00 TEEEM PRIVATE/}, "")  # Remove new structure prefix
        .sub(%r{^Corporate File/}, "")  # Remove legacy Corporate File prefix
        .sub(%r{^Accounts - Internal/Corporate File/}, "")  # Remove longer legacy prefix

      # If path is now empty or just "/", use group_name/company fallback
      return group_name if clean_path.blank? || clean_path == "/"

      return clean_path
    end

    # Fallback to parent folder name
    parent_name = doc.dig("parentReference", "name")
    return group_name if parent_name.blank?

    # Combine group and folder name if we have both
    group_name.present? ? "#{group_name}/#{parent_name}" : parent_name
  end

  def get_onedrive_client
    # SSoT: Use DocumentProviderAware to setup provider
    begin
      setup_default_provider!
      # Return self as the "client" since we use provider methods directly
      # For SharePoint-specific operations, fall back to MicrosoftGraphClient
      if current_provider_type == :sharepoint && @credential
        MicrosoftGraphClient.new(@credential)
      else
        self  # Use DocumentProviderAware methods
      end
    rescue DocumentProviders::NotConnectedError
      return nil unless @credential
      # Fall back to direct client if provider not configured
      MicrosoftGraphClient.new(@credential)
    end
  end

  def find_folder_by_path(client, path)
    path_parts = path.split("/")
    current_folder = nil
    # Use SharePoint drive if available, otherwise fall back to personal OneDrive
    drive_path = @credential&.drive_id ? "/drives/#{@credential.drive_id}" : "/me/drive"
    current_parent_path = "#{drive_path}/root"

    path_parts.each do |folder_name|
      response = client.get("#{current_parent_path}/children")
      folders = response["value"] || []
      current_folder = folders.find { |f| f["name"] == folder_name && f["folder"] }

      return nil unless current_folder
      current_parent_path = "#{drive_path}/items/#{current_folder['id']}"
    end

    current_folder
  rescue => e
    Rails.logger.error "Error finding folder '#{path}': #{e.message}"
    nil
  end

  def list_folder_children(client, folder_id)
    all_items = []
    # Use SharePoint drive if available, otherwise fall back to personal OneDrive
    drive_path = @credential&.drive_id ? "/drives/#{@credential.drive_id}" : "/me/drive"
    next_link = "#{drive_path}/items/#{folder_id}/children"

    while next_link
      response = client.get(next_link)
      items = response["value"] || []
      all_items.concat(items)

      next_link = response["@odata.nextLink"]
      if next_link&.start_with?("https://")
        next_link = URI.parse(next_link).request_uri.sub(%r{^/v1\.0}, "")
      end
    end

    all_items
  end

  def process_company_folder(client, folder, company = nil, group_name = nil)
    @results[:companies_scanned] += 1

    # Try to match folder to a company if not provided
    company ||= find_matching_company(folder["name"])

    unless company
      folder_display = group_name ? "#{group_name}/#{folder['name']}" : folder["name"]
      @results[:errors] << "No matching company found for folder '#{folder_display}'"
      return
    end

    folder_display = group_name ? "#{group_name}/#{folder['name']}" : folder["name"]
    Rails.logger.info "Processing folder '#{folder_display}' for company '#{company.name}'"

    # Store SharePoint folder URL for direct access
    if folder["webUrl"].present? && company.sharepoint_folder_url != folder["webUrl"]
      company.update_column(:sharepoint_folder_url, folder["webUrl"])
    end

    # Scan all documents in this folder (recursively)
    documents = scan_folder_for_documents(client, folder["id"], recursive: true)
    @results[:documents_found] += documents.count

    # Link documents to company
    documents.each do |doc|
      link_document_to_company(client, company, doc, group_name)
    end
  end

  def scan_folder_for_documents(client, folder_id, recursive: false)
    documents = []
    items = list_folder_children(client, folder_id)

    items.each do |item|
      if item["file"]
        # It's a file - check if it's a document type we care about
        if is_corporate_document?(item["name"])
          documents << item
        end
      elsif item["folder"] && recursive
        # Recurse into subfolders
        documents.concat(scan_folder_for_documents(client, item["id"], recursive: true))
      end
    end

    documents
  end

  def is_corporate_document?(filename)
    extensions = %w[.pdf .doc .docx .xls .xlsx .jpg .jpeg .png .gif]
    extensions.any? { |ext| filename.downcase.end_with?(ext) }
  end

  def find_matching_company(folder_name)
    # PRIORITY 1: New format "CODE - Company Name" (e.g., "TEK - Tekna Pty Ltd")
    # Extract company code from folder name
    if folder_name.match?(/^[A-Z]{2,10}\s*-\s*/)
      code = folder_name.split(/\s*-\s*/).first.strip.upcase
      company = CorporateCompany.find_by("UPPER(code) = ?", code)
      return company if company
    end

    # PRIORITY 2: Check for explicit SharePoint folder name mapping (TEEEM is source of truth)
    company = CorporateCompany.find_by("LOWER(sharepoint_folder_name) = ?", folder_name.downcase)
    return company if company

    # PRIORITY 3: Try exact name match
    company = CorporateCompany.find_by("LOWER(name) = ?", folder_name.downcase)
    return company if company

    # PRIORITY 4: Try matching by ACN if folder contains ACN
    acn_match = folder_name.match(/(\d{9})/)
    if acn_match
      company = CorporateCompany.find_by(acn: acn_match[1])
      return company if company
    end

    # PRIORITY 5: Try fuzzy matching on company name (fallback only)
    normalized_folder = normalize_name(folder_name)
    CorporateCompany.all.find do |c|
      normalized_name = normalize_name(c.name)
      normalized_name == normalized_folder ||
        normalized_folder.include?(normalized_name) ||
        normalized_name.include?(normalized_folder)
    end
  end

  def folder_matches_company?(folder_name, company)
    # PRIORITY 1: New format "CODE - Company Name" (e.g., "TEK - Tekna Pty Ltd")
    if folder_name.match?(/^[A-Z]{2,10}\s*-\s*/) && company.code.present?
      code = folder_name.split(/\s*-\s*/).first.strip.upcase
      return true if code == company.code.upcase
    end

    # PRIORITY 2: Check explicit SharePoint folder name mapping (TEEEM is source of truth)
    if company.sharepoint_folder_name.present?
      return folder_name.downcase == company.sharepoint_folder_name.downcase
    end

    # PRIORITY 3: Fuzzy matching (fallback)
    normalized_folder = normalize_name(folder_name)
    normalized_company = normalize_name(company.name)

    normalized_folder == normalized_company ||
      normalized_folder.include?(normalized_company) ||
      normalized_company.include?(normalized_folder) ||
      (company.acn.present? && folder_name.include?(company.acn))
  end

  def normalize_name(name)
    name.to_s
      .downcase
      .gsub(/\s*\([^)]*\)\s*/, "")  # Remove parenthetical notes like "(formerly...)"
      .gsub(/pty\s*ltd/i, "")
      .gsub(/\s+atf\s+.*/i, "")  # Remove trust suffix
      .gsub(/[^a-z0-9\s]/, " ")
      .gsub(/\s+/, " ")
      .strip
  end

  def link_document_to_company(client, company, doc, group_name = nil)
    # Find appropriate DocumentType based on filename
    document_type = find_document_type(doc["name"], company)

    # Get or create a download URL
    download_url = doc["@microsoft.graph.downloadUrl"]
    if download_url.blank?
      download_url = "https://graph.microsoft.com/v1.0/me/drive/items/#{doc['id']}/content"
    end

    # Extract full SharePoint folder path from parentReference
    sharepoint_folder_path = extract_folder_path(doc, group_name)

    # Extract the immediate parent folder name (tab name like LOANS, ASIC, etc.)
    parent_folder_name = doc.dig("parentReference", "name") || "GENERAL"
    document_type_string = parent_folder_name.upcase

    # Create or update company document record
    # ⚠️ SAFETY: Don't blindly reuse existing records by sharepoint_file_id
    # SharePoint can reuse IDs after file deletion, which would hijack old records
    company_doc = CorporateCompanyDocument.find_by(sharepoint_file_id: doc["id"])

    if company_doc
      # Verify this is actually the same file - check filename AND company match
      filename_matches = company_doc.file_name == doc["name"]
      company_matches = company_doc.company_id == company.id

      unless filename_matches && company_matches
        # ID was reused for a different file - orphan the old record and create new
        Rails.logger.warn "[SharePointScanner] ID REUSE DETECTED: #{doc['id']}"
        Rails.logger.warn "  Old: #{company_doc.file_name} (company_id=#{company_doc.company_id})"
        Rails.logger.warn "  New: #{doc['name']} (company_id=#{company.id})"

        # Orphan the old record so we don't lose its history
        company_doc.update!(
          sharepoint_file_id: nil,
          orphaned_at: Time.current,
          orphan_reason: "sharepoint_id_reused_by_#{doc['name'].truncate(50)}"
        )
        @results[:errors] << "ID reuse detected: orphaned old doc #{company_doc.id} (#{company_doc.file_name})"

        # Create new record for the new file
        company_doc = CorporateCompanyDocument.new(sharepoint_file_id: doc["id"])
      end
    else
      company_doc = CorporateCompanyDocument.new(sharepoint_file_id: doc["id"])
    end

    # SSoT: Model uses belongs_to :corporate_company, foreign_key: "company_id"
    company_doc.corporate_company = company

    # Map folder name to valid document_type enum value
    # The document_type field validates against a specific list of lowercase values
    document_type_enum = map_folder_to_document_type_enum(document_type_string)

    company_doc.assign_attributes(
      file_name: doc["name"],
      document_type: document_type_enum,
      document_type_id: document_type&.id,
      file_url: doc["webUrl"],
      sharepoint_download_url: download_url,
      file_size: doc.dig("size"),
      last_modified_at: doc.dig("lastModifiedDateTime")&.to_datetime,
      storage_type: "electronic",
      source: "sharepoint",
      register_folder: group_name,
      folder: parent_folder_name,  # Use simple folder name (e.g., "ATO") for tab filtering
      description: sharepoint_folder_path  # Keep full path in description for reference
    )

    if company_doc.save
      @results[:documents_linked] += 1

      # SSoT: Use BulkDocumentCategorizationService for document_type_id assignment
      # This ensures the same logic is used for corporate docs as for job docs
      # The service will match folder_path to EntityTab and find the best document type
      if company_doc.document_type_id.nil?
        categorization_result = BulkDocumentCategorizationService
          .for_company(company)
          .categorize_single(company_doc)

        if categorization_result[:stats][:categorized] > 0
          company_doc.reload  # Refresh to get the new document_type_id
          Rails.logger.info "Linked and categorized '#{doc['name']}' to #{company.name} [#{company_doc.document_type_record&.name || 'Unknown'}]"
        else
          Rails.logger.info "Linked document '#{doc['name']}' to #{company.name} [uncategorized - no matching EntityTab]"
        end
      else
        Rails.logger.info "Linked document '#{doc['name']}' to #{company.name} [#{document_type&.name || 'Unknown'}]"
      end
    else
      @results[:errors] << "Failed to save document '#{doc['name']}': #{company_doc.errors.full_messages.join(', ')}"
    end
  rescue => e
    @results[:errors] << "Error linking document '#{doc['name']}': #{e.message}"
  end

  # Map SharePoint folder names to valid document_type enum values
  # Allowed values: constitution minutes loan_agreement security_deed setup share_certificate
  #                 tax_return financial_statement insurance_policy asic share_registry trust_deed
  #                 financial tax insurance contract certificate other
  def map_folder_to_document_type_enum(folder_name)
    return "other" if folder_name.blank?

    case folder_name.upcase
    when "ASIC"
      "asic"
    when "ATO"
      "tax"
    when "BANK"
      "financial"
    when "COMPANY"
      "certificate"
    when "DIVIDENDS"
      "financial"
    when "FINANCIALS"
      "financial_statement"
    when "INSURANCE"
      "insurance"
    when "LOANS"
      "loan_agreement"
    when "MINUTES"
      "minutes"
    when "REGISTRY"
      "share_registry"
    when "TRUST"
      "trust_deed"
    when "ADVICE"
      "other"
    when "ASSETS"
      "contract"
    when "GENERAL"
      "other"
    else
      "other"
    end
  end

  # Find the best matching DocumentType for a filename
  def find_document_type(filename, company)
    filename_lower = filename.downcase

    # BAS - Business Activity Statement
    if filename_lower.include?("bas")
      return DocumentType.find_by("name ILIKE '%BAS%'")
    end

    # Form 484 - Director Changes or Registered Office
    if filename_lower.include?("484")
      if filename_lower.include?("director")
        return DocumentType.find_by(name: "ASIC Form 484 - Director Changes")
      elsif filename_lower.include?("office") || filename_lower.include?("address")
        return DocumentType.find_by(name: "ASIC Form 484 - Registered Office")
      end
      # Default 484 to Director Changes
      return DocumentType.find_by(name: "ASIC Form 484 - Director Changes")
    end

    # Form 485 - Solvency Declaration
    if filename_lower.include?("485") || filename_lower.include?("solvency")
      return DocumentType.find_by(name: "ASIC Form 485 - Solvency Declaration")
    end

    # ASIC Documents (generic)
    if filename_lower.include?("asic")
      return DocumentType.find_by(name: "ASIC Documents")
    end

    # ASIC Annual Review
    if filename_lower.include?("annual")
      return DocumentType.find_by(name: "ASIC Annual Review")
    end

    # Constitution
    if filename_lower.include?("constitution") || filename_lower.include?("rules")
      return DocumentType.find_by(name: "Constitution")
    end

    # Trust Deed
    if filename_lower.include?("trust") && filename_lower.include?("deed")
      return DocumentType.find_by(name: "Trust Deed")
    end

    # Minutes (detect draft vs signed)
    if filename_lower.include?("minute") || filename_lower.include?("agm")
      if filename_lower.include?("draft")
        return DocumentType.find_by(name: "Minutes - Draft")
      else
        return DocumentType.find_by(name: "Directors' Minutes")
      end
    end

    # Directors' Resolution - Distribution
    if filename_lower.include?("resolution") && filename_lower.include?("distribution")
      return DocumentType.find_by(name: "Directors' Resolution - Distribution")
    end

    # Share Registry/Certificate/Transfer
    if filename_lower.include?("share")
      if filename_lower.include?("certificate")
        return DocumentType.find_by(name: "Share Certificate")
      elsif filename_lower.include?("transfer")
        return DocumentType.find_by(name: "Share Transfer")
      elsif filename_lower.include?("registry") || filename_lower.include?("register")
        return DocumentType.find_by(name: "Share Registry")
      end
    end

    # Financial Statements
    if filename_lower.include?("financial") || filename_lower.include?("statement")
      if filename_lower.include?("draft")
        return DocumentType.find_by(name: "Draft Financials")
      else
        return DocumentType.find_by(name: "Final Financials")
      end
    end

    # Tax Returns - detect company vs trust
    if filename_lower.include?("tax return") || filename_lower.match?(/\d{4}.*tax/)
      # Check if company is a trust
      if company.name.downcase.include?("trust") || company.name.downcase.include?("atf")
        return DocumentType.find_by(name: "TTR - Trust Tax Return")
      else
        return DocumentType.find_by(name: "CTR - Company Tax Return")
      end
    end

    # Bank Statement
    if filename_lower.include?("bank") && filename_lower.include?("statement")
      return DocumentType.find_by(name: "Bank Statement")
    end

    # Distribution/Dividend
    if filename_lower.include?("distribution") || filename_lower.include?("dividend")
      if filename_lower.include?("draft")
        return DocumentType.find_by(name: "Distribution - Draft")
      else
        return DocumentType.find_by(name: "Distribution")
      end
    end

    # Gift Deed Return
    if filename_lower.include?("gift") && filename_lower.include?("deed")
      return DocumentType.find_by(name: "Gift Deed Return")
    end

    # Loan Agreement
    if filename_lower.include?("loan") && filename_lower.include?("agreement")
      if filename_lower.include?("draft")
        return DocumentType.find_by(name: "Loan Agreement - Draft")
      else
        return DocumentType.find_by(name: "Loan Agreement")
      end
    end

    # Security Deed
    if filename_lower.include?("security") && filename_lower.include?("deed")
      if filename_lower.include?("draft")
        return DocumentType.find_by(name: "Security Deed - Draft")
      else
        return DocumentType.find_by(name: "Security Deed")
      end
    end

    # PPSR Registration
    if filename_lower.include?("ppsr")
      return DocumentType.find_by(name: "PPSR Registration")
    end

    # Asset Insurance
    if filename_lower.include?("insurance") || filename_lower.include?("policy")
      if filename_lower.include?("draft")
        return DocumentType.find_by(name: "Asset Insurance - Draft")
      else
        return DocumentType.find_by(name: "Asset Insurance - Signed")
      end
    end

    # Purchase Contract (for assets)
    if filename_lower.include?("purchase") && filename_lower.include?("contract")
      if filename_lower.include?("draft")
        return DocumentType.find_by(name: "Purchase Contract - Draft")
      else
        return DocumentType.find_by(name: "Purchase Contract - Signed")
      end
    end

    # Service Agreement (for assets)
    if filename_lower.include?("service") && filename_lower.include?("agreement")
      if filename_lower.include?("draft")
        return DocumentType.find_by(name: "Service Agreement - Draft")
      else
        return DocumentType.find_by(name: "Service Agreement - Signed")
      end
    end

    # Register of Members
    if filename_lower.include?("register") && filename_lower.include?("member")
      return DocumentType.find_by(name: "Register of Members")
    end

    # Company Setup
    if filename_lower.include?("setup") || filename_lower.include?("corporate key")
      return DocumentType.find_by(name: "Company Setup")
    end

    # Structure
    if filename_lower.include?("structure") || filename_lower.include?("org chart")
      return DocumentType.find_by(name: "Structure")
    end

    # Default to General if no specific match
    DocumentType.find_by(name: "General")
  end
end

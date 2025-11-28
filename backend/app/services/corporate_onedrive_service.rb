class CorporateOnedriveService
  attr_reader :credential, :results, :folder_path

  DEFAULT_FOLDER_PATH = "00 - TEEEM/Corporate"

  def initialize(credential = nil, folder_path: nil)
    @credential = credential || OrganizationOneDriveCredential.active_credential
    @folder_path = folder_path || DEFAULT_FOLDER_PATH
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
    return { success: false, error: "OneDrive not connected" } unless client

    # Find the corporate root folder
    corporate_folder = find_folder_by_path(client, @folder_path)
    unless corporate_folder
      return {
        success: false,
        error: "Corporate folder not found at '#{@folder_path}'. Please create this folder in OneDrive."
      }
    end

    Rails.logger.info "Found corporate folder: #{corporate_folder['name']} (#{corporate_folder['id']})"

    # Get all company folders
    company_folders = list_folder_children(client, corporate_folder['id'])
    Rails.logger.info "Found #{company_folders.count} company folders"

    # Process each company folder
    company_folders.each do |folder|
      next unless folder['folder'] # Skip files, only process folders

      process_company_folder(client, folder)
    end

    {
      success: true,
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

  # Scan a specific company's OneDrive folder
  def scan_company(company)
    client = get_onedrive_client
    return { success: false, error: "OneDrive not connected" } unless client

    # Find the corporate root folder
    corporate_folder = find_folder_by_path(client, @folder_path)
    unless corporate_folder
      return {
        success: false,
        error: "Corporate folder not found at '#{@folder_path}'"
      }
    end

    # Find this company's folder
    company_folders = list_folder_children(client, corporate_folder['id'])
    company_folder = company_folders.find do |f|
      f['folder'] && folder_matches_company?(f['name'], company)
    end

    unless company_folder
      return {
        success: false,
        error: "No OneDrive folder found for #{company.name}"
      }
    end

    process_company_folder(client, company_folder, company)

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
    return { success: false, error: "OneDrive not connected" } unless client

    corporate_folder = find_folder_by_path(client, @folder_path)
    unless corporate_folder
      return {
        success: false,
        error: "Corporate folder not found at '#{@folder_path}'"
      }
    end

    preview_results = []
    company_folders = list_folder_children(client, corporate_folder['id'])

    company_folders.each do |folder|
      next unless folder['folder']

      company = find_matching_company(folder['name'])
      documents = scan_folder_for_documents(client, folder['id'])

      preview_results << {
        folder_name: folder['name'],
        folder_id: folder['id'],
        company_id: company&.id,
        company_name: company&.name,
        matched: company.present?,
        document_count: documents.count,
        documents: documents.map { |d| { name: d['name'], type: categorize_document(d['name']) } }
      }
    end

    {
      success: true,
      corporate_folder: @folder_path,
      companies: preview_results,
      total_folders: preview_results.count,
      matched_folders: preview_results.count(&:matched),
      total_documents: preview_results.sum { |r| r[:document_count] }
    }
  rescue => e
    {
      success: false,
      error: e.message
    }
  end

  private

  def get_onedrive_client
    return nil unless @credential
    MicrosoftGraphClient.new(@credential)
  end

  def find_folder_by_path(client, path)
    path_parts = path.split('/')
    current_folder = nil
    current_parent_path = "/me/drive/root"

    path_parts.each do |folder_name|
      response = client.get("#{current_parent_path}/children")
      folders = response['value'] || []
      current_folder = folders.find { |f| f['name'] == folder_name && f['folder'] }

      return nil unless current_folder
      current_parent_path = "/me/drive/items/#{current_folder['id']}"
    end

    current_folder
  rescue => e
    Rails.logger.error "Error finding folder '#{path}': #{e.message}"
    nil
  end

  def list_folder_children(client, folder_id)
    all_items = []
    next_link = "/me/drive/items/#{folder_id}/children"

    while next_link
      response = client.get(next_link)
      items = response['value'] || []
      all_items.concat(items)

      next_link = response['@odata.nextLink']
      if next_link&.start_with?('https://')
        next_link = URI.parse(next_link).request_uri.sub(%r{^/v1\.0}, '')
      end
    end

    all_items
  end

  def process_company_folder(client, folder, company = nil)
    @results[:companies_scanned] += 1

    # Try to match folder to a company if not provided
    company ||= find_matching_company(folder['name'])

    unless company
      @results[:errors] << "No matching company found for folder '#{folder['name']}'"
      return
    end

    Rails.logger.info "Processing folder '#{folder['name']}' for company '#{company.name}'"

    # Scan all documents in this folder (recursively)
    documents = scan_folder_for_documents(client, folder['id'], recursive: true)
    @results[:documents_found] += documents.count

    # Link documents to company
    documents.each do |doc|
      link_document_to_company(client, company, doc)
    end
  end

  def scan_folder_for_documents(client, folder_id, recursive: false)
    documents = []
    items = list_folder_children(client, folder_id)

    items.each do |item|
      if item['file']
        # It's a file - check if it's a document type we care about
        if is_corporate_document?(item['name'])
          documents << item
        end
      elsif item['folder'] && recursive
        # Recurse into subfolders
        documents.concat(scan_folder_for_documents(client, item['id'], recursive: true))
      end
    end

    documents
  end

  def is_corporate_document?(filename)
    extensions = %w[.pdf .doc .docx .xls .xlsx .jpg .jpeg .png .gif]
    extensions.any? { |ext| filename.downcase.end_with?(ext) }
  end

  def find_matching_company(folder_name)
    # Try exact match first
    company = Company.find_by("LOWER(name) = ?", folder_name.downcase)
    return company if company

    # Try matching by ACN if folder contains ACN
    acn_match = folder_name.match(/(\d{9})/)
    if acn_match
      company = Company.find_by(acn: acn_match[1])
      return company if company
    end

    # Try fuzzy matching on company name
    normalized_folder = normalize_name(folder_name)
    Company.all.find do |c|
      normalized_name = normalize_name(c.name)
      normalized_name == normalized_folder ||
        normalized_folder.include?(normalized_name) ||
        normalized_name.include?(normalized_folder)
    end
  end

  def folder_matches_company?(folder_name, company)
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
      .gsub(/pty\s*ltd/i, '')
      .gsub(/\s+atf\s+.*/i, '')  # Remove trust suffix
      .gsub(/[^a-z0-9\s]/, ' ')
      .gsub(/\s+/, ' ')
      .strip
  end

  def link_document_to_company(client, company, doc)
    # Determine document type
    doc_type = categorize_document(doc['name'])

    # Get or create a download URL
    download_url = doc['@microsoft.graph.downloadUrl']
    if download_url.blank?
      download_url = "https://graph.microsoft.com/v1.0/me/drive/items/#{doc['id']}/content"
    end

    # Create or update company document record
    company_doc = CompanyDocument.find_or_initialize_by(
      company: company,
      onedrive_file_id: doc['id']
    )

    company_doc.assign_attributes(
      title: doc['name'],
      document_type: doc_type,
      file_url: doc['webUrl'],
      file_name: doc['name'],
      onedrive_download_url: download_url,
      file_size: doc.dig('size'),
      last_modified_at: doc.dig('lastModifiedDateTime')&.to_datetime,
      storage_type: 'electronic'
    )

    if company_doc.save
      @results[:documents_linked] += 1
      Rails.logger.info "Linked document '#{doc['name']}' to #{company.name}"
    else
      @results[:errors] << "Failed to save document '#{doc['name']}': #{company_doc.errors.full_messages.join(', ')}"
    end
  rescue => e
    @results[:errors] << "Error linking document '#{doc['name']}': #{e.message}"
  end

  def categorize_document(filename)
    filename_lower = filename.downcase

    # ASIC documents
    if filename_lower.include?('asic') || filename_lower.include?('annual') || filename_lower.include?('484')
      return 'asic'
    end

    # Constitution/Rules
    if filename_lower.include?('constitution') || filename_lower.include?('rules')
      return 'constitution'
    end

    # Minutes
    if filename_lower.include?('minute') || filename_lower.include?('agm') || filename_lower.include?('resolution')
      return 'minutes'
    end

    # Share registry
    if filename_lower.include?('share') || filename_lower.include?('register')
      return 'share_registry'
    end

    # Trust deed
    if filename_lower.include?('deed') || filename_lower.include?('trust')
      return 'trust_deed'
    end

    # Financial statements
    if filename_lower.include?('financial') || filename_lower.include?('statement') ||
       filename_lower.include?('balance') || filename_lower.include?('p&l') || filename_lower.include?('profit')
      return 'financial'
    end

    # Tax returns
    if filename_lower.include?('tax') || filename_lower.include?('return') || filename_lower.include?('bas')
      return 'tax'
    end

    # Insurance
    if filename_lower.include?('insurance') || filename_lower.include?('policy')
      return 'insurance'
    end

    # Contracts
    if filename_lower.include?('contract') || filename_lower.include?('agreement')
      return 'contract'
    end

    # Certificates
    if filename_lower.include?('certificate') || filename_lower.include?('cert')
      return 'certificate'
    end

    # Default
    'other'
  end
end

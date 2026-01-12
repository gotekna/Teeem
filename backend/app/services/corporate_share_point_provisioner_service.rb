# =============================================================================
# CorporateSharePointProvisionerService - FOLDER PROVISIONER
# =============================================================================
# Purpose: Create and manage folder structures for companies in SharePoint
# SSoT: This service WRITES to SharePoint (folder creation/provisioning)
#
# Key Methods:
#   - create_company_folders: Create standard folder structure for a company
#   - create_group_folders: Create folders for a corporate group
#   - create_or_find_folder: Create folder if not exists
#   - organise_company_documents: Move/rename documents to proper locations
#
# RENAMED: CorporateOneDriveService → CorporateSharePointProvisionerService
# =============================================================================
class CorporateSharePointProvisionerService
  # Standard folder structure for corporate documents
  FOLDER_STRUCTURE = {
    "Loans and Security" => [ "Loan Agreement", "Security Deed", "PPSR", "Return of Gift Deed" ],
    "Company Setup" => [],
    "Constitution" => [],
    "Register of Members" => [],
    "Structure" => [],
    "Assets" => [],
    "Minutes" => [],
    "BAS" => [],
    "Trust Deed" => [],
    "General" => [
      "Solvency ASIC",
      "ATO Tax Return",
      "Dividends",
      "EOY ATO",
      "ASIC Docs",
      "ATO Docs",
      "ASIC Key",
      "Corporate Key",
      "Officers",
      "Bank Statements",
      "Distribution",
      "EOY ASIC",
      "Registered Office",
      "Tax Consolidation"
    ]
  }.freeze

  attr_reader :client, :stats

  def initialize
    @client = MicrosoftGraphClient.new
    @stats = {
      folders_created: 0,
      folders_skipped: 0,
      documents_renamed: 0,
      documents_moved: 0,
      errors: []
    }
  end

  # Create standard folder structure for a company
  def create_company_folders(company)
    folder_name = company_folder_name(company)
    Rails.logger.info "Creating folder structure for: #{folder_name}"

    begin
      # Create root company folder
      root_folder = create_or_find_folder(folder_name)
      company_folder_id = root_folder["id"]

      # Create subfolders
      FOLDER_STRUCTURE.each do |parent_folder, subfolders|
        parent = create_or_find_folder(parent_folder, parent_id: company_folder_id)

        subfolders.each do |subfolder|
          create_or_find_folder(subfolder, parent_id: parent["id"])
        end
      end

      # Update company with storage folder info
      company.update(
        storage_folder_id: company_folder_id,
        storage_folder_path: folder_name
      ) if company.respond_to?(:storage_folder_id)

      {
        success: true,
        folder_id: company_folder_id,
        folder_name: folder_name,
        stats: @stats
      }
    rescue MicrosoftGraphClient::APIError => e
      @stats[:errors] << "Failed to create folders for #{company.name}: #{e.message}"
      { success: false, error: e.message, stats: @stats }
    end
  end

  # Create folder structure for all companies in a group
  def create_group_folders(company_group)
    results = []
    company_group.corporate_companies.each do |company|
      result = create_company_folders(company)
      results << { company: company.name, result: result }
    end
    results
  end

  # Primary folders matching the 14 UI tabs
  # These are the main document type folders for each company
  PRIMARY_FOLDERS = %w[
    ADVICE
    ASIC
    ASSETS
    ATO
    BANK
    COMPANY
    DIVIDENDS
    FINANCIALS
    GENERAL
    INSURANCE
    LOANS
    MINUTES
    REGISTRY
    TRUST
  ].freeze

  # ASSETS subfolders (4 sub-tabs under ASSETS)
  ASSETS_SUBFOLDERS = %w[
    Disposal
    Expenses
    Purchases
    Valuation
  ].freeze

  # Combined list for backwards compatibility
  DOCUMENT_TYPE_FOLDERS = (PRIMARY_FOLDERS + ASSETS_SUBFOLDERS).freeze

  # Preview the folder structure that would be created in configurable base path
  # Returns a hash describing the structure without creating anything
  def preview_private_folder_structure(dry_run: true)
    # SSoT: Use StorageConfiguration for corporate path
    base_path = StorageConfiguration.instance.path_for(:corporate)
    structure = {
      root: base_path,
      groups: []
    }

    CorporateGroup.includes(:companies).order(:name).each do |group|
      group_info = {
        name: group.name,
        folder_path: "#{base_path}/#{group.name}",
        entities: []
      }

      group.corporate_companies.order(:name).each do |company|
        company_folder_name = "#{company.code.presence || company.name[0..2].upcase} - #{company.name}"
        entity_info = {
          id: company.id,
          name: company.name,
          code: company.code,
          entity_type: company.entity_type,
          folder_name: company_folder_name,
          folder_path: "#{base_path}/#{group.name}/#{company_folder_name}",
          subfolders: DOCUMENT_TYPE_FOLDERS.map do |folder|
            {
              name: folder,
              path: "#{base_path}/#{group.name}/#{company_folder_name}/#{folder}"
            }
          end
        }
        group_info[:entities] << entity_info
      end

      structure[:groups] << group_info if group_info[:entities].any?
    end

    structure[:summary] = {
      total_groups: structure[:groups].count,
      total_entities: structure[:groups].sum { |g| g[:entities].count },
      total_folders: structure[:groups].sum { |g| g[:entities].count * (DOCUMENT_TYPE_FOLDERS.count + 1) } + structure[:groups].count + 1
    }

    structure
  end

  # Create the entire folder structure in configurable base path
  # Structure: [base_path] / [Group Name] / [Company Name] / [Document Type Folders]
  def create_private_folder_structure!
    # SSoT: Use StorageConfiguration for corporate path
    base_path = StorageConfiguration.instance.path_for(:corporate)
    Rails.logger.info "Creating private folder structure at: #{base_path}..."

    # Get or create base folder
    private_folder = create_or_find_folder(base_path)
    private_folder_id = private_folder["id"]

    results = {
      private_folder_id: private_folder_id,
      groups: [],
      stats: @stats
    }

    CorporateGroup.includes(:companies).order(:name).each do |group|
      Rails.logger.info "Creating folder for group: #{group.name}"

      # Create group folder
      group_folder = create_or_find_folder(group.name, parent_id: private_folder_id)
      group_folder_id = group_folder["id"]

      group_result = {
        name: group.name,
        folder_id: group_folder_id,
        entities: []
      }

      group.corporate_companies.order(:name).each do |company|
        company_folder_name = "#{company.code.presence || company.name[0..2].upcase} - #{company.name}"
        Rails.logger.info "  Creating folder for company: #{company_folder_name}"

        # Create company folder
        company_folder = create_or_find_folder(company_folder_name, parent_id: group_folder_id)
        company_folder_id = company_folder["id"]

        # Create document type subfolders
        subfolders_created = []
        DOCUMENT_TYPE_FOLDERS.each do |folder_name|
          subfolder = create_or_find_folder(folder_name, parent_id: company_folder_id)
          subfolders_created << { name: folder_name, id: subfolder["id"] }
        end

        # Update company with storage folder info
        company.update_columns(
          storage_folder_id: company_folder_id,
          storage_folder_path: "#{base_path}/#{group.name}/#{company_folder_name}"
        )

        group_result[:entities] << {
          id: company.id,
          name: company.name,
          folder_id: company_folder_id,
          folder_name: company_folder_name,
          subfolders: subfolders_created
        }
      end

      results[:groups] << group_result
    end

    results[:stats] = @stats
    results
  rescue MicrosoftGraphClient::APIError => e
    @stats[:errors] << "Failed to create private folder structure: #{e.message}"
    { success: false, error: e.message, stats: @stats }
  end

  # Scan company folder and categorise documents
  def scan_company_documents(company)
    return { success: false, error: "Company has no storage folder" } unless company.storage_folder_id.present?

    documents = []
    scan_folder_recursive(company.storage_folder_id, documents)

    # Categorise documents by type
    categorised = categorise_documents(documents)

    {
      success: true,
      total_documents: documents.count,
      categorised: categorised,
      documents: documents
    }
  rescue MicrosoftGraphClient::APIError => e
    { success: false, error: e.message }
  end

  # Rename document to standard naming convention
  # Format: {YYYY-MM-DD} - {Document Type} - {Description}.{ext}
  def rename_document(file_id, document_date:, document_type:, description:)
    file = @client.get_file(file_id)
    extension = File.extname(file["name"])

    new_name = format_document_name(
      date: document_date,
      type: document_type,
      description: description,
      extension: extension
    )

    @client.patch("/drives/#{@client.instance_variable_get(:@credential).drive_id}/items/#{file_id}", {
      name: new_name
    })

    @stats[:documents_renamed] += 1
    { success: true, old_name: file["name"], new_name: new_name }
  rescue MicrosoftGraphClient::APIError => e
    @stats[:errors] << "Failed to rename #{file_id}: #{e.message}"
    { success: false, error: e.message }
  end

  # Move document to correct folder based on document type
  def move_document(file_id, target_folder_id)
    @client.patch("/drives/#{@client.instance_variable_get(:@credential).drive_id}/items/#{file_id}", {
      parentReference: { id: target_folder_id }
    })

    @stats[:documents_moved] += 1
    { success: true }
  rescue MicrosoftGraphClient::APIError => e
    @stats[:errors] << "Failed to move #{file_id}: #{e.message}"
    { success: false, error: e.message }
  end

  # Auto-organise documents in a company folder
  def organise_company_documents(company, dry_run: true)
    return { success: false, error: "Company has no storage folder" } unless company.storage_folder_id.present?

    scan_result = scan_company_documents(company)
    return scan_result unless scan_result[:success]

    actions = []

    scan_result[:documents].each do |doc|
      # Skip folders
      next if doc[:is_folder]

      # Try to detect document type from filename
      detected_type = detect_document_type(doc[:name])
      next unless detected_type

      # Find target folder
      target_folder = find_folder_for_type(company.storage_folder_id, detected_type)
      next unless target_folder

      # Check if already in correct folder
      if doc[:parent_id] == target_folder["id"]
        actions << { file: doc[:name], action: "skip", reason: "already in correct folder" }
        next
      end

      action = {
        file: doc[:name],
        file_id: doc[:id],
        detected_type: detected_type,
        target_folder: target_folder["name"],
        target_folder_id: target_folder["id"],
        action: "move"
      }

      unless dry_run
        move_result = move_document(doc[:id], target_folder["id"])
        action[:result] = move_result[:success] ? "success" : "failed"
        action[:error] = move_result[:error] if move_result[:error]
      end

      actions << action
    end

    {
      success: true,
      dry_run: dry_run,
      total_documents: scan_result[:total_documents],
      actions: actions,
      stats: @stats
    }
  end

  # Create or link document in database
  def sync_document_to_database(company, file_id)
    file = @client.get_file(file_id)

    # Parse document name
    parsed = parse_document_name(file["name"])
    document_type = DocumentType.find_by(name: parsed[:type])

    company_document = company.corporate_company_documents.find_or_initialize_by(
      sharepoint_file_id: file_id
    )

    company_document.assign_attributes(
      document_name: parsed[:description] || file["name"],
      document_type: document_type&.category,
      document_type_record: document_type,
      file_name: file["name"],
      file_size: file["size"],
      year: parsed[:date]&.year,
      folder: file.dig("parentReference", "path")&.split("/").last,
      storage_type: "electronic",
      sharepoint_file_id: file_id,
      sharepoint_download_url: file["webUrl"],
      company_code: extract_company_code(file["name"], company)
    )

    company_document.save!
    company_document
  end

  private

  def company_folder_name(company)
    code = company.code.presence || company.name.split.map(&:first).join.upcase
    "#{code} - #{company.name}"
  end

  # Extract company code from filename (e.g., "ATO Tax Return FY19 TD.pdf" -> "TD")
  def extract_company_code(filename, company)
    # Try to extract code from filename pattern: "filename CODE.extension"
    name_without_ext = File.basename(filename, ".*")
    parts = name_without_ext.split(" ")

    # Check if last part matches company code
    if parts.last && company.code.present? && parts.last.upcase == company.code.upcase
      return parts.last.upcase
    end

    # Try to find any known company code in the filename
    CorporateCompany.where.not(code: [ nil, "" ]).find_each do |c|
      if name_without_ext.match?(/\b#{Regexp.escape(c.code)}\b/i)
        return c.code.upcase
      end
    end

    # Fallback to company's code
    company.code.presence&.upcase
  end

  def create_or_find_folder(name, parent_id: nil)
    # Try to find existing folder first
    existing = find_folder(name, parent_id)
    if existing
      @stats[:folders_skipped] += 1
      return existing
    end

    # Create new folder
    folder = @client.create_folder(name, parent_id: parent_id)
    @stats[:folders_created] += 1
    folder
  end

  def find_folder(name, parent_id = nil)
    items = if parent_id
      @client.list_folder_items(parent_id)
    else
      @client.list_folder_items
    end

    items["value"]&.find { |item| item["name"] == name && item["folder"] }
  rescue MicrosoftGraphClient::APIError
    nil
  end

  def scan_folder_recursive(folder_id, documents, depth = 0)
    return if depth > 5 # Prevent infinite recursion

    items = @client.list_folder_items(folder_id)

    items["value"]&.each do |item|
      doc = {
        id: item["id"],
        name: item["name"],
        path: item.dig("parentReference", "path"),
        parent_id: item.dig("parentReference", "id"),
        size: item["size"],
        modified: item["lastModifiedDateTime"],
        web_url: item["webUrl"],
        is_folder: item["folder"].present?
      }
      documents << doc

      # Recurse into subfolders
      if item["folder"]
        scan_folder_recursive(item["id"], documents, depth + 1)
      end
    end
  end

  def categorise_documents(documents)
    categorised = Hash.new { |h, k| h[k] = [] }

    documents.each do |doc|
      next if doc[:is_folder]

      type = detect_document_type(doc[:name]) || "Uncategorised"
      categorised[type] << doc
    end

    categorised
  end

  def detect_document_type(filename)
    filename_lower = filename.downcase

    # Map keywords to document types
    type_keywords = {
      "Constitution" => %w[constitution],
      "Loan Agreement" => %w[loan agreement],
      "Security Deed" => %w[security deed],
      "PPSR" => %w[ppsr personal property],
      "ATO Tax Return" => %w[tax return ato],
      "BAS" => %w[bas activity statement],
      "Solvency ASIC" => %w[solvency asic 484],
      "Minutes" => %w[minutes meeting resolution],
      "Distribution" => %w[distribution],
      "Dividends" => %w[dividend],
      "Bank Statements" => %w[bank statement],
      "Trust Deed" => %w[trust deed],
      "Officers" => %w[officer director secretary appointment resignation],
      "Assets" => %w[asset register depreciation]
    }

    type_keywords.each do |type, keywords|
      return type if keywords.any? { |kw| filename_lower.include?(kw) }
    end

    nil
  end

  def find_folder_for_type(company_folder_id, document_type)
    doc_type = DocumentType.find_by(name: document_type)
    return nil unless doc_type&.folder

    # Navigate to the correct folder
    folder = find_folder(doc_type.folder, company_folder_id)
    return folder unless folder.nil?

    # Check in General subfolder
    general_folder = find_folder("General", company_folder_id)
    return nil unless general_folder

    find_folder(doc_type.folder, general_folder["id"]) || find_folder(document_type, general_folder["id"])
  end

  def format_document_name(date:, type:, description:, extension:, company: nil)
    date_str = date.strftime("%Y-%m-%d")
    # Standard format: {Company Code} - {YYYY-MM-DD} - {Document Type} - {Description}.{ext}
    if company
      company_identifier = company.code.presence || company.name.split.map(&:first).join.upcase
      "#{company_identifier} - #{date_str} - #{type} - #{description}#{extension}"
    else
      "#{date_str} - #{type} - #{description}#{extension}"
    end
  end

  def parse_document_name(filename)
    # Try to parse: {YYYY-MM-DD} - {Document Type} - {Description}.{ext}
    match = filename.match(/^(\d{4}-\d{2}-\d{2})\s*-\s*([^-]+)\s*-\s*(.+)\.(\w+)$/)

    if match
      {
        date: Date.parse(match[1]),
        type: match[2].strip,
        description: match[3].strip,
        extension: match[4]
      }
    else
      {
        date: nil,
        type: detect_document_type(filename),
        description: File.basename(filename, ".*"),
        extension: File.extname(filename)
      }
    end
  rescue ArgumentError
    { date: nil, type: nil, description: filename, extension: "" }
  end
end

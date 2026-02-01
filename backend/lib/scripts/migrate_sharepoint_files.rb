# SharePoint File Migration Script
# This script migrates files from "Corporate File/" to the new "00 TEEEM PRIVATE" folder structure
# with proper naming conventions based on detected document types

puts "=== SharePoint File Migration ==="
puts ""

# Check for active credential (SSoT: MicrosoftCredential)
credential = MicrosoftCredential.active.delegated_credentials.connected.first
if credential.nil?
  puts "ERROR: No active Microsoft credential found"
  exit 1
end

client = MicrosoftGraphClient.new

# Constants
# SSoT: Fetch folder names from EntityTab (replaces DocumentFolder)
PRIMARY_FOLDERS = EntityTab.where(warehouse_type: 'corporate_entity', tab_group: 'documents')
                           .where(parent_id: nil)
                           .enabled
                           .order(:order_position)
                           .pluck(:display_name).freeze
ASSETS_SUBFOLDERS = %w[Disposal Expenses Purchases Valuation].freeze
NEEDS_REVIEW_FOLDER = "_NEEDS_REVIEW"

# Statistics
stats = {
  folders_created: 0,
  files_moved: 0,
  files_renamed: 0,
  files_needs_review: 0,
  errors: []
}

# Helper: Create folder if it doesn't exist
def create_folder_if_not_exists(client, drive_id, parent_id, folder_name, stats)
  # Check if folder exists
  begin
    result = client.get("/drives/#{drive_id}/items/#{parent_id}/children?$filter=name eq '#{folder_name}'")
    if result["value"].any?
      return result["value"].first
    end
  rescue => e
    puts "  Warning checking for folder: #{e.message}"
  end

  # Create folder
  begin
    folder = client.post("/drives/#{drive_id}/items/#{parent_id}/children", {
      name: folder_name,
      folder: {},
      '@microsoft.graph.conflictBehavior': "rename"
    })
    stats[:folders_created] += 1
    puts "  Created folder: #{folder_name}"
    folder
  rescue => e
    stats[:errors] << "Failed to create folder #{folder_name}: #{e.message}"
    puts "  ERROR creating folder #{folder_name}: #{e.message}"
    nil
  end
end

# Helper: Detect document type from filename and folder path
def detect_document_type(filename, folder_path)
  filename_lower = filename.downcase
  folder_lower = folder_path.to_s.downcase

  # BAS
  return "BAS - Business Activity Statement" if filename_lower.include?("bas")

  # CTR/Tax Return (Company)
  return "CTR - Company Tax Return" if filename_lower.match?(/tax.*return|ctr.*fy/i) && !filename_lower.include?("trust")

  # TTR (Trust)
  return "TTR - Trust Tax Return" if filename_lower.include?("ttr") || (filename_lower.include?("trust") && filename_lower.include?("tax"))

  # ASIC Form 484
  return "ASIC Form 484 - Director Changes" if filename_lower.include?("484")

  # ASIC Form 485 / Solvency
  return "ASIC Documents" if filename_lower.include?("485") || filename_lower.include?("solvency")

  # Constitution
  return "Constitution" if filename_lower.include?("constitution")

  # Minutes
  return "Minutes - Signed" if filename_lower.include?("minute") || filename_lower.include?("agm")

  # Share Registry/Certificate/Transfer
  return "Share Registry" if filename_lower.include?("share") && (filename_lower.include?("certificate") || filename_lower.include?("transfer") || filename_lower.include?("registry"))

  # Financial Statements
  return "Final Financials" if filename_lower.include?("financial") || filename_lower.include?("statement")

  # Trust Deed
  return "Trust" if filename_lower.include?("trust") && filename_lower.include?("deed")

  # Loan Agreement
  return "Loan Agreement - Signed" if filename_lower.include?("loan") && filename_lower.include?("agreement")

  # Security Deed
  return "Security Deed - Signed" if filename_lower.include?("security") && filename_lower.include?("deed")

  # PPSR
  return "PPSR Registration" if filename_lower.include?("ppsr")

  # Gift Deed
  return "Gift Deed" if filename_lower.include?("gift") && filename_lower.include?("deed")

  # Distribution
  return "Distribution Declaration" if filename_lower.include?("distribution")

  # Insurance
  return "Asset Insurance - Signed" if filename_lower.include?("insurance")

  # Corporate Key
  return "Corporate Key" if filename_lower.include?("corporate key")

  # Company Setup
  return "Company Setup" if folder_lower.include?("company setup") || filename_lower.include?("consent") || filename_lower.include?("application") || filename_lower.include?("incorporation")

  # General ASIC
  return "ASIC Documents" if filename_lower.include?("asic") || folder_lower.include?("asic")

  # General ATO
  return "ATO Documents" if filename_lower.include?("ato")

  # Bank Statement
  return "Bank Statement" if filename_lower.include?("bank") || folder_lower.include?("bank")

  # EOY Bank statements
  return "Bank Statement" if filename_lower.match?(/eoy.*nab|eoy.*wbc|eoy.*anz|eoy.*cba/i)

  # WBC statements
  return "Bank Statement" if filename_lower.match?(/wbc.*fy\d{2}/i)

  # P&L / Balance Sheet
  return "Final Financials" if filename_lower.include?("p&l") || filename_lower.include?("balance sheet") || filename_lower.include?("beneficiary loan")

  # Trust Deed changes
  return "Trust" if folder_lower.include?("trust deed") || filename_lower.match?(/trustee.*change|change.*trustee|bloodline/i)

  # Registered Office / Address changes
  return "ASIC Documents" if filename_lower.include?("registered office") || filename_lower.match?(/change.*address|change.*office/i)

  # Director appointments/resignations
  return "ASIC Documents" if filename_lower.match?(/appoint.*director|resignation.*director|resign.*director/i)

  # Change of details
  return "ASIC Documents" if filename_lower.match?(/change.*detail|change.*name|change.*register/i)

  # Tax File Number
  return "ATO Documents" if filename_lower.include?("tax file number")

  # Engagement Letters
  return "ATO Documents" if filename_lower.include?("engagement")

  # Loans and Security folder
  return "Loan Agreement - Signed" if folder_lower.include?("loans and security")

  # Register Of Members folder
  return "Register of Members" if folder_lower.include?("register of members")

  # Assets folder
  return "Asset" if folder_lower.include?("assets")

  # PAYG documents
  return "ATO Documents" if filename_lower.include?("payg")

  # Audit reports
  return "Final Financials" if filename_lower.include?("audit")

  # Dividend Resolution
  return "Distribution Declaration" if filename_lower.include?("dividend") || filename_lower.include?("resolution")

  # Summary files
  return "General" if filename_lower == "summary.pdf"

  nil # Unmatched
end

# Helper: Get target folder for document type
def get_target_folder(doc_type_name)
  doc_type = DocumentType.find_by(name: doc_type_name)
  return "GENERAL" unless doc_type

  folder = doc_type.folder.presence || doc_type.primary_tab.presence
  return "GENERAL" unless folder

  # Map primary_tab values to folder names
  folder_map = {
    "ADVICE" => "ADVICE",
    "ASIC" => "ASIC",
    "ASSETS" => "ASSETS",
    "ATO" => "ATO",
    "BANK" => "BANK",
    "COMPANY" => "COMPANY",
    "DIVIDENDS" => "DIVIDENDS",
    "FINANCIALS" => "FINANCIALS",
    "GENERAL" => "GENERAL",
    "INSURANCE" => "INSURANCE",
    "LOANS" => "LOANS",
    "MINUTES" => "MINUTES",
    "REGISTRY" => "REGISTRY",
    "TRUST" => "TRUST",
    "Disposal" => "ASSETS/Disposal",
    "Expenses" => "ASSETS/Expenses",
    "Purchases" => "ASSETS/Purchases",
    "Valuation" => "ASSETS/Valuation"
  }

  folder_map[folder] || "GENERAL"
end

# Step 1: Scan "Corporate File/" folder recursively
puts "=== Step 1: Scanning Corporate File/ folder ==="

def scan_folder_recursive(client, drive_id, folder_id, all_files, current_path = "", depth = 0)
  return if depth > 6

  begin
    result = client.get("/drives/#{drive_id}/items/#{folder_id}/children")

    result["value"].each do |item|
      item_path = "#{current_path}/#{item['name']}"

      if item["file"]
        all_files << {
          id: item["id"],
          name: item["name"],
          path: current_path,
          full_path: item_path,
          size: item["size"],
          parent_id: folder_id
        }
      elsif item["folder"]
        # Recurse into subfolder
        scan_folder_recursive(client, drive_id, item["id"], all_files, item_path, depth + 1)
      end
    end
  rescue => e
    puts "  Warning scanning folder: #{e.message}"
  end
end

# Find Corporate File folder
corporate_file_folder = nil
begin
  root_result = client.get("/drives/#{credential.drive_id}/root/children")
  corporate_file_folder = root_result["value"].find { |item| item["name"] == "Corporate File" }
rescue => e
  puts "ERROR finding Corporate File folder: #{e.message}"
  exit 1
end

unless corporate_file_folder
  puts "ERROR: Corporate File folder not found"
  exit 1
end

puts "Found Corporate File folder: #{corporate_file_folder['id']}"

all_files = []
scan_folder_recursive(client, credential.drive_id, corporate_file_folder["id"], all_files, "Corporate File")

puts "Total files found: #{all_files.count}"
puts ""

# Step 2: Create company mapping from folder structure
puts "=== Step 2: Mapping files to companies ==="

# Build company lookups
all_companies = Corporate.pluck(:id, :code, :name)
company_codes = all_companies.to_h { |id, code, name| [ code&.downcase, { id: id, code: code, name: name } ] }
company_names = all_companies.to_h { |id, code, name| [ name&.downcase, { id: id, code: code, name: name } ] }

# Build folder name to company mapping
# The actual structure is: Corporate File / [Group] / [Company] / [DocType] / files
# So company folder is at Level 2 (path_parts[2])
# Company folders use plain names like "Tekna", "Gen2612" not "CODE - Name" format

# Name variations mapping for known discrepancies
NAME_VARIATIONS = {
  "tekna" => "Tekna Pty Ltd",
  "tekna admin" => "Tekna Admin Pty Ltd",
  "tekna drafting" => "Tekna Drafting Pty Ltd",
  "tekna homes" => "Tekna Homes Pty Ltd",
  "tekna northshore" => "Tekna Northshore Pty Ltd",
  "tekna ryde" => "Tekna Ryde Pty Ltd",
  "tekna trust" => "Tekna Investments Trust",
  "team harder super" => "Team Harder Super Fund",
  "team harder family trust" => "Team Harder Family Trust",
  "prov1322 global" => "Prov1322 Global Pty Ltd",
  "prov1322 invest" => "Prov1322 Invest Pty Ltd",
  "gen2612" => "Gen2612 Pty Ltd",
  "gen2612 holdings" => "Gen2612 Holdings Pty Ltd",
  "gen2612 invest" => "Gen2612 Invest Pty Ltd",
  "gen2612 trust" => "Gen2612 Trust",
  "thsf" => "Team Harder Super Fund",
  "thft" => "Team Harder Family Trust",
  "thag" => "Team Harder Accounting Group Pty Ltd"
}.freeze

# Build a normalized name lookup (lowercase, simplified)
def normalize_name(name)
  return nil unless name
  # Remove common suffixes and normalize
  name.downcase
      .gsub(/\s+(pty|ltd|trust|fund|holdings|invest|investments)\s*$/i, "")
      .gsub(/\s+(pty|ltd)\s*/i, " ")
      .gsub(/\s+/, " ")
      .strip
end

normalized_company_lookup = {}
all_companies.each do |id, code, name|
  normalized = normalize_name(name)
  normalized_company_lookup[normalized] = { id: id, code: code, name: name } if normalized
  # Also add without "pty ltd" variations
  simple_name = name&.downcase&.gsub(/\s+(pty|ltd|holdings|invest|investments|trust|fund)\s*/i, "")&.strip
  normalized_company_lookup[simple_name] = { id: id, code: code, name: name } if simple_name
end

# Map files to companies based on folder path
files_by_company = Hash.new { |h, k| h[k] = [] }

all_files.each do |file|
  # Path structure: Corporate File / [Group] / [Company] / [DocType] / files
  # Examples:
  #   Corporate File/Tekna Group/Tekna/ASIC Forms/document.pdf
  #   Corporate File/Team Harder Group/Gen2612/Tax Returns/file.pdf
  path_parts = file[:path].split("/")

  # Company folder is at Level 2 (index 2)
  company_folder = path_parts[2] if path_parts.length > 2

  company = nil
  if company_folder
    folder_lower = company_folder.downcase.strip

    # 1. Try exact name match first
    company = company_names[folder_lower]

    # 2. Try name variations mapping
    unless company
      if NAME_VARIATIONS[folder_lower]
        company = company_names[NAME_VARIATIONS[folder_lower].downcase]
      end
    end

    # 3. Try normalized name match
    unless company
      normalized = normalize_name(company_folder)
      company = normalized_company_lookup[normalized] if normalized
    end

    # 4. Try code match (if folder name looks like a code)
    unless company
      if folder_lower.match?(/^[a-z]{2,6}\d*$/i) # Short alphanumeric like "thsf", "gen2612"
        company = company_codes[folder_lower]
      end
    end

    # 5. Try partial name match (folder name contained in company name or vice versa)
    unless company
      all_companies.each do |id, code, name|
        next unless name
        name_lower = name.downcase
        if name_lower.include?(folder_lower) || folder_lower.include?(name_lower.split(" ").first)
          company = { id: id, code: code, name: name }
          break
        end
      end
    end
  end

  if company
    files_by_company[company[:id]] << file
  else
    files_by_company[:unknown] << file
  end
end

puts "Files mapped to companies:"
files_by_company.each do |company_id, files|
  if company_id == :unknown
    puts "  Unknown: #{files.count} files"
  else
    company = Corporate.find_by(id: company_id)
    puts "  #{company&.code || 'N/A'} - #{company&.name}: #{files.count} files"
  end
end
puts ""

# Step 3: Create folder structure in 00 TEEEM PRIVATE
puts "=== Step 3: Creating folder structure in 00 TEEEM PRIVATE ==="

# Find or create 00 TEEEM PRIVATE folder
private_folder = nil
PRIVATE_FOLDER_NAME = "00 TEEEM PRIVATE"
begin
  root_result = client.get("/drives/#{credential.drive_id}/root/children")
  private_folder = root_result["value"].find { |item| item["name"] == PRIVATE_FOLDER_NAME }

  unless private_folder
    private_folder = client.post("/drives/#{credential.drive_id}/root/children", {
      name: PRIVATE_FOLDER_NAME,
      folder: {},
      '@microsoft.graph.conflictBehavior': "fail"
    })
    stats[:folders_created] += 1
    puts "Created #{PRIVATE_FOLDER_NAME} folder"
  end
rescue => e
  puts "ERROR with #{PRIVATE_FOLDER_NAME} folder: #{e.message}"
  exit 1
end

puts "#{PRIVATE_FOLDER_NAME} folder ID: #{private_folder['id']}"

# Create group and company folders
company_folder_ids = {}

CorporateGroup.includes(:companies).order(:name).each do |group|
  puts "Creating folders for group: #{group.name}"

  # Create group folder
  group_folder = create_folder_if_not_exists(client, credential.drive_id, private_folder["id"], group.name, stats)
  next unless group_folder

  group.companies.order(:name).each do |company|
    company_folder_name = "#{company.code.presence || company.name[0..2].upcase} - #{company.name}"
    puts "  Creating folders for company: #{company_folder_name}"

    # Create company folder
    company_folder = create_folder_if_not_exists(client, credential.drive_id, group_folder["id"], company_folder_name, stats)
    next unless company_folder

    company_folder_ids[company.id] = { folder_id: company_folder["id"], subfolder_ids: {} }

    # Create primary folders
    PRIMARY_FOLDERS.each do |folder_name|
      subfolder = create_folder_if_not_exists(client, credential.drive_id, company_folder["id"], folder_name, stats)
      company_folder_ids[company.id][:subfolder_ids][folder_name] = subfolder["id"] if subfolder

      # Create ASSETS subfolders
      if folder_name == "ASSETS" && subfolder
        ASSETS_SUBFOLDERS.each do |asset_subfolder|
          asset_folder = create_folder_if_not_exists(client, credential.drive_id, subfolder["id"], asset_subfolder, stats)
          company_folder_ids[company.id][:subfolder_ids]["ASSETS/#{asset_subfolder}"] = asset_folder["id"] if asset_folder
        end
      end
    end

    # Create GENERAL/_NEEDS_REVIEW folder
    general_folder_id = company_folder_ids[company.id][:subfolder_ids]["GENERAL"]
    if general_folder_id
      needs_review_folder = create_folder_if_not_exists(client, credential.drive_id, general_folder_id, NEEDS_REVIEW_FOLDER, stats)
      company_folder_ids[company.id][:subfolder_ids]["GENERAL/_NEEDS_REVIEW"] = needs_review_folder["id"] if needs_review_folder
    end
  end
end

puts ""
puts "Folder creation complete. Stats:"
puts "  Folders created: #{stats[:folders_created]}"
puts "  Errors: #{stats[:errors].count}"
puts ""

# Step 4: Process and move files
puts "=== Step 4: Processing and moving files ==="

DRY_RUN = ENV["DRY_RUN"] != "false"
puts "DRY_RUN mode: #{DRY_RUN}"
puts ""

files_by_company.each do |company_id, files|
  next if company_id == :unknown
  next unless company_folder_ids[company_id]

  company = Corporate.find_by(id: company_id)
  next unless company

  puts "Processing #{files.count} files for #{company.code} - #{company.name}"

  files.each do |file|
    # Detect document type
    doc_type_name = detect_document_type(file[:name], file[:path])

    if doc_type_name
      # Matched - move to appropriate folder
      target_folder_path = get_target_folder(doc_type_name)
      target_folder_id = company_folder_ids[company_id][:subfolder_ids][target_folder_path]

      unless target_folder_id
        puts "  WARNING: No target folder for #{target_folder_path}"
        next
      end

      # Generate new filename (keep original name for now, just add company code if missing)
      new_name = file[:name]
      unless new_name.start_with?(company.code)
        # Add company code prefix
        extension = File.extname(file[:name])
        base_name = File.basename(file[:name], extension)
        new_name = "#{company.code} #{base_name}#{extension}"
      end

      puts "  MOVE: #{file[:name]} -> #{target_folder_path}/#{new_name}"

      unless DRY_RUN
        begin
          # Move and rename file
          client.patch("/drives/#{credential.drive_id}/items/#{file[:id]}", {
            parentReference: { id: target_folder_id },
            name: new_name
          })
          stats[:files_moved] += 1
          stats[:files_renamed] += 1 if new_name != file[:name]
        rescue => e
          stats[:errors] << "Failed to move #{file[:name]}: #{e.message}"
          puts "    ERROR: #{e.message}"
        end
      end
    else
      # Unmatched - move to _NEEDS_REVIEW with special naming
      needs_review_folder_id = company_folder_ids[company_id][:subfolder_ids]["GENERAL/_NEEDS_REVIEW"]

      unless needs_review_folder_id
        puts "  WARNING: No _NEEDS_REVIEW folder for company"
        next
      end

      # Format: {CompanyCode} {OriginalFileName} NEEDS_REVIEW.{ext}
      extension = File.extname(file[:name])
      base_name = File.basename(file[:name], extension)
      new_name = "#{company.code} #{base_name} NEEDS_REVIEW#{extension}"

      puts "  NEEDS_REVIEW: #{file[:name]} -> GENERAL/_NEEDS_REVIEW/#{new_name}"
      stats[:files_needs_review] += 1

      unless DRY_RUN
        begin
          client.patch("/drives/#{credential.drive_id}/items/#{file[:id]}", {
            parentReference: { id: needs_review_folder_id },
            name: new_name
          })
          stats[:files_moved] += 1
        rescue => e
          stats[:errors] << "Failed to move #{file[:name]} to NEEDS_REVIEW: #{e.message}"
          puts "    ERROR: #{e.message}"
        end
      end
    end
  end
end

# Handle unknown company files
if files_by_company[:unknown].any?
  puts ""
  puts "WARNING: #{files_by_company[:unknown].count} files could not be mapped to a company:"
  files_by_company[:unknown].first(20).each do |file|
    puts "  - #{file[:full_path]}"
  end
  if files_by_company[:unknown].count > 20
    puts "  ... and #{files_by_company[:unknown].count - 20} more"
  end
end

puts ""
puts "=== Migration Complete ==="
puts "Stats:"
puts "  Folders created: #{stats[:folders_created]}"
puts "  Files moved: #{stats[:files_moved]}"
puts "  Files renamed: #{stats[:files_renamed]}"
puts "  Files needing review: #{stats[:files_needs_review]}"
puts "  Errors: #{stats[:errors].count}"

if stats[:errors].any?
  puts ""
  puts "Errors:"
  stats[:errors].first(20).each do |error|
    puts "  - #{error}"
  end
end

puts ""
if DRY_RUN
  puts "This was a DRY RUN. No files were actually moved."
  puts "To execute the migration, run with: DRY_RUN=false rails runner tmp/migrate_sharepoint_files.rb"
end

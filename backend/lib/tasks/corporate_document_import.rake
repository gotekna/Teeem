# frozen_string_literal: true

# =============================================================================
# CORPORATE DOCUMENT IMPORT TASKS
# =============================================================================
# These tasks scan SharePoint folders and import documents for corporate companies.
#
# USAGE (on production):
#   heroku run rails corporate:scan_company[11] --app teeemlive
#   heroku run rails corporate:scan_all --app teeemlive
#
# HISTORY:
#   2024-12-21: Team Harder Super Investments (ID 10) - imported successfully
#   2024-12-21: W2G Assets (ID 11) - IN PROGRESS
#
# NEXT COMPANIES TO IMPORT:
#   - W2G Assets (ID 11, code: W2G, path: Corporate File/Team Harder Group/W2G Assets)
#   - Other W2G companies (IDs 465-471, 501-502)
#
# =============================================================================

namespace :corporate do
  desc "Scan SharePoint and import documents for a specific company"
  task :scan_company, [:company_id] => :environment do |_t, args|
    company_id = args[:company_id].to_i

    unless company_id > 0
      puts "ERROR: Please provide a valid company ID"
      puts "Usage: rails corporate:scan_company[11]"
      exit 1
    end

    company = CorporateCompany.find_by(id: company_id)
    unless company
      puts "ERROR: Company with ID #{company_id} not found"
      exit 1
    end

    puts "=" * 60
    puts "SCANNING: #{company.name} (ID: #{company.id})"
    puts "=" * 60
    puts "Code: #{company.code}"
    puts "SharePoint Folder Path: #{company.sharepoint_folder_path || 'NOT SET'}"
    puts "SharePoint Folder ID: #{company.sharepoint_folder_id || 'NOT SET'}"
    puts "Existing documents: #{CorporateCompanyDocument.where(company_id: company.id).count}"
    puts ""

    credential = OrganizationSharePointCredential.active_credential
    unless credential
      puts "ERROR: No active SharePoint credential configured"
      puts "Please connect SharePoint in Admin > System > Connections"
      exit 1
    end

    puts "Using credential: #{credential.name}"
    puts ""
    puts "Starting scan..."
    puts "-" * 60

    scanner = CorporateSharePointScannerService.new(credential)
    result = scanner.scan_company(company)

    puts ""
    puts "=" * 60
    puts "RESULTS"
    puts "=" * 60
    puts JSON.pretty_generate(result)
  end

  desc "List all companies that need document import"
  task pending_imports: :environment do
    puts "=" * 60
    puts "COMPANIES PENDING DOCUMENT IMPORT"
    puts "=" * 60
    puts ""

    # Companies with SharePoint folder path but few/no documents
    companies = CorporateCompany.where.not(sharepoint_folder_path: [nil, ""])

    companies.each do |company|
      doc_count = CorporateCompanyDocument.where(company_id: company.id).count
      status = doc_count == 0 ? "NO DOCS" : "#{doc_count} docs"

      puts "ID: #{company.id.to_s.ljust(4)} | #{company.code.to_s.ljust(15)} | #{status.ljust(10)} | #{company.name}"
    end

    puts ""
    puts "To scan a company: rails corporate:scan_company[ID]"
  end

  desc "Scan all companies with SharePoint folders configured"
  task scan_all: :environment do
    credential = OrganizationSharePointCredential.active_credential
    unless credential
      puts "ERROR: No active SharePoint credential configured"
      exit 1
    end

    companies = CorporateCompany.where.not(sharepoint_folder_path: [nil, ""])
    total = companies.count

    puts "Scanning #{total} companies..."
    puts ""

    scanner = CorporateSharePointScannerService.new(credential)

    companies.each_with_index do |company, index|
      puts "[#{index + 1}/#{total}] Scanning #{company.name}..."
      begin
        result = scanner.scan_company(company)
        puts "  -> #{result[:documents_linked] || 0} documents linked"
      rescue => e
        puts "  -> ERROR: #{e.message}"
      end
    end

    puts ""
    puts "Scan complete!"
  end

  # =============================================================================
  # W2G ASSETS SPECIFIC IMPORT (ID: 11)
  # =============================================================================
  # This was the next company to import after Team Harder Super Investments.
  #
  # Company Details:
  #   - ID: 11
  #   - Name: W2G Assets
  #   - Code: W2G
  #   - SharePoint Path: Corporate File/Team Harder Group/W2G Assets
  #   - Existing docs: 61 (as of 2024-12-21)
  #
  # To run on production:
  #   heroku run rails corporate:scan_w2g --app teeemlive
  #
  desc "Scan W2G Assets (ID 11) for new documents"
  task scan_w2g: :environment do
    Rake::Task["corporate:scan_company"].invoke(11)
  end
end

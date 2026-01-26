# frozen_string_literal: true

# Re-upload missing Task #2236 files directly from SharePoint
# Uses Microsoft Graph API to download files and upload to S3
#
# Usage:
#   rails task2236:fetch_from_sharepoint

namespace :task2236 do
  # SharePoint folder path containing the files
  SHAREPOINT_FOLDER = "/personal/robert_tekna_com_au/Documents/XX Online Only Old/X Online only/Robert Bankruptcy/SV Partners January 2026 Questions"

  # Document ID to expected filename mapping
  MISSING_DOCS = {
    19934 => "Standard Balance Sheet 2019 HFT.pdf",
    19974 => "Deed of Gift - Rachel - 15.03.21.pdf",
    19975 => "Deed of Gift - Sophie - 15.03.21.pdf",
    19976 => "Deed of Gift - Jared - 15.03.21.pdf",
    19977 => "Walan Settlement.pdf",
    19978 => "Deed of Gift - Grace - 15.03.21.pdf",
    19980 => "24fy Rachel Paying Loan and Interest.pdf",
    19981 => "FY 25 Rachel Paying Interest and Loan.pdf",
    19982 => "Rachel Receiving Gen2612.pdf"
  }.freeze

  desc "Fetch missing files from SharePoint and re-upload to S3"
  task fetch_from_sharepoint: :environment do
    puts "=" * 70
    puts "Fetching missing Task #2236 files from SharePoint"
    puts "=" * 70
    puts ""

    # Get Microsoft credential for Tekna
    credential = MicrosoftCredential.find_by(organization_name: "Tekna")
    unless credential&.connected?
      puts "ERROR: Tekna Microsoft credential not found or not connected"
      exit 1
    end

    client = MicrosoftAppGraphClient.new(credential)

    # List files in the SharePoint folder
    puts "Listing files in SharePoint folder..."
    puts "Folder: #{SHAREPOINT_FOLDER}"
    puts ""

    begin
      # For personal OneDrive, we need to use the /me/drive endpoint
      # The folder path needs to be URL-encoded
      folder_path = SHAREPOINT_FOLDER.gsub(" ", "%20")

      # Get the drive for the user
      response = client.get("/me/drive/root:#{folder_path}:/children")

      unless response && response["value"]
        puts "ERROR: Could not list SharePoint folder"
        puts "Response: #{response.inspect}"
        exit 1
      end

      files = response["value"]
      puts "Found #{files.count} files in SharePoint folder:"
      files.each { |f| puts "  - #{f['name']}" }
      puts ""
    rescue => e
      puts "ERROR listing SharePoint folder: #{e.message}"
      puts ""
      puts "Note: This task requires access to Robert's personal OneDrive."
      puts "Alternative: Download files manually and use rails task2236:reupload[/path/to/folder]"
      exit 1
    end

    success = 0
    failed = 0
    not_found = 0

    MISSING_DOCS.each do |doc_id, filename|
      puts "-" * 60
      puts "Processing: #{filename} (Doc ID: #{doc_id})"

      doc = CorporateCompanyDocument.find_by(id: doc_id)
      unless doc
        puts "  ERROR: Document not found in database"
        failed += 1
        next
      end

      # Find the file in SharePoint
      sp_file = files.find { |f| f["name"] == filename }
      unless sp_file
        puts "  NOT FOUND in SharePoint folder"
        not_found += 1
        next
      end

      begin
        # Download file content from SharePoint
        puts "  Downloading from SharePoint..."
        download_url = sp_file["@microsoft.graph.downloadUrl"]

        unless download_url
          # Need to get the download URL
          item_response = client.get("/me/drive/items/#{sp_file['id']}")
          download_url = item_response["@microsoft.graph.downloadUrl"]
        end

        unless download_url
          puts "  ERROR: Could not get download URL"
          failed += 1
          next
        end

        # Download the file
        content = URI.open(download_url).read
        content_type = sp_file["file"]&.dig("mimeType") || "application/pdf"

        puts "  Downloaded: #{(content.bytesize / 1024.0).round(2)} KB"

        # Create new StorageBlob with content-addressed storage
        blob = StorageBlob.find_or_create_for_content!(
          content,
          filename: doc.file_name,
          content_type: content_type
        )

        # Update document to use new blob
        doc.storage_blob&.decrement_reference! if doc.storage_blob_id.present?
        doc.storage_blob = blob
        doc.content_hash = blob.content_hash
        doc.file_size = content.bytesize
        doc.storage_path = blob.storage_path
        doc.save!
        blob.increment_reference!

        # Update warehouse_document if exists
        if doc.warehouse_document
          doc.warehouse_document.update!(storage_blob: blob)
        end

        puts "  ✓ Uploaded to S3: #{blob.storage_path}"
        success += 1
      rescue => e
        puts "  ✗ Error: #{e.message}"
        failed += 1
      end
    end

    puts ""
    puts "=" * 70
    puts "Complete!"
    puts "  Success:       #{success}"
    puts "  Failed:        #{failed}"
    puts "  Not in folder: #{not_found}"
    puts "=" * 70
  end
end

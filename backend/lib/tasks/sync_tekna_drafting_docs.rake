namespace :corporate do
  desc "Sync Tekna Drafting documents from SharePoint to TEEEM database"
  task sync_tekna_drafting: :environment do
    puts "Syncing Tekna Drafting Documents from SharePoint"
    puts "=" * 80

    begin
      # Find Tekna Drafting company
      company = Company.find_by("name ILIKE ?", "%Tekna Drafting%")
      unless company
        puts "❌ Tekna Drafting company not found in database"
        exit 1
      end

      puts "✅ Found company: #{company.name} (ID: #{company.id})"
      puts ""

      # Initialize GraphClient
      client = MicrosoftGraphClient.new
      drive_id = client.instance_variable_get(:@credential).drive_id

      # Find Corporate File folder
      root_items = client.get("/drives/#{drive_id}/root/children")
      corporate_folder = root_items["value"].find { |item| item["name"] == "Corporate File" && item["folder"] }

      unless corporate_folder
        puts "❌ Corporate File folder not found"
        exit 1
      end

      # Find Tekna Group folder
      corporate_items = client.get("/drives/#{drive_id}/items/#{corporate_folder['id']}/children")
      tekna_group = corporate_items["value"].find { |item| item["name"] == "Tekna Group" && item["folder"] }

      unless tekna_group
        puts "❌ Tekna Group folder not found"
        exit 1
      end

      # Find Tekna Drafting folder
      tekna_group_items = client.get("/drives/#{drive_id}/items/#{tekna_group['id']}/children")
      tekna_drafting_folder = tekna_group_items["value"].find { |item| item["name"] == "Tekna Drafting" && item["folder"] }

      unless tekna_drafting_folder
        puts "❌ Tekna Drafting folder not found"
        exit 1
      end

      puts "✅ Found SharePoint folder: Corporate File/Tekna Group/Tekna Drafting"
      puts "   Folder ID: #{tekna_drafting_folder['id']}"
      puts "   URL: #{tekna_drafting_folder['webUrl']}"
      puts ""

      # Link company to this OneDrive folder
      company.update!(
        onedrive_folder_id: tekna_drafting_folder["id"],
        onedrive_folder_path: "Corporate File/Tekna Group/Tekna Drafting"
      )
      puts "✅ Linked company to OneDrive folder"
      puts ""

      # Scan all documents recursively
      puts "Scanning documents recursively..."
      puts "-" * 80

      all_documents = []
      scan_folder_recursive(client, drive_id, tekna_drafting_folder["id"], all_documents, "Tekna Drafting")

      puts "Found #{all_documents.count} documents across all subfolders"
      puts ""

      # Sync each document to database
      synced = 0
      skipped = 0
      errors = []

      all_documents.each do |file|
        begin
          # Check if already synced
          existing = company.company_documents.find_by(sharepoint_file_id: file["id"])

          if existing
            puts "  ⏭️  Skipped (already synced): #{file['name']}"
            skipped += 1
            next
          end

          # Extract company code from filename (should be TD)
          filename = file["name"]
          name_parts = filename.split(" ")
          code = name_parts.last && company.code.present? && name_parts.last.upcase.include?(company.code.upcase) ? company.code.upcase : company.code

          # Create document record
          doc = company.company_documents.create!(
            title: File.basename(filename, ".*"),
            description: "Synced from SharePoint: #{file[:folder_path]}",
            document_type: "other",
            file_name: filename,
            file_size: file["size"],
            sharepoint_file_id: file["id"],
            sharepoint_download_url: file["webUrl"],
            company_code: code,
            storage_type: "electronic",
            folder: file[:folder_path] || "Tekna Drafting"
          )

          puts "  ✅ Synced: #{filename}"
          synced += 1

        rescue => e
          errors << "#{file['name']}: #{e.message}"
          puts "  ❌ Error: #{file['name']} - #{e.message}"
        end
      end

      puts ""
      puts "=" * 80
      puts "SYNC COMPLETE"
      puts "=" * 80
      puts "Documents synced: #{synced}"
      puts "Documents skipped (already synced): #{skipped}"
      puts "Errors: #{errors.count}"

      if errors.any?
        puts ""
        puts "Errors:"
        errors.each { |e| puts "  - #{e}" }
      end

      puts ""
      puts "✅ Done! Documents are now viewable in TEEEM."

    rescue => e
      puts "❌ Error: #{e.class}"
      puts "   Message: #{e.message}"
      puts ""
      puts "Stack trace:"
      puts e.backtrace.first(10).map { |line| "   #{line}" }.join("\n")
    end
  end

  # Helper method to recursively scan folders
  def scan_folder_recursive(client, drive_id, folder_id, documents, folder_path, depth = 0)
    return if depth > 5 # Prevent infinite recursion

    items = client.get("/drives/#{drive_id}/items/#{folder_id}/children")

    items["value"].each do |item|
      if item["folder"]
        # Recurse into subfolder
        subfolder_path = "#{folder_path}/#{item['name']}"
        scan_folder_recursive(client, drive_id, item["id"], documents, subfolder_path, depth + 1)
      else
        # Add file with folder path metadata
        item[:folder_path] = folder_path
        documents << item
      end
    end
  end
end

# frozen_string_literal: true

namespace :corporate do
  desc "Import People documents from SharePoint"
  task import_people: :environment do
    credential = OrganizationSharePointCredential.active_credential
    client = MicrosoftGraphClient.new(credential)
    drive_path = "/drives/#{credential.drive_id}"

    # Helper to list folder contents
    def list_folder(client, drive_path, folder_id)
      url = "#{drive_path}/items/#{folder_id}/children"
      client.send(:get, url)["value"] || []
    end

    def get_details(client, drive_path, item_id)
      url = "#{drive_path}/items/#{item_id}"
      client.send(:get, url)
    end

    # Navigate to Corporate/People
    root_items = list_folder(client, drive_path, "root")
    corp = root_items.find { |i| i["folder"] && i["name"] == "Corporate" }
    corp_items = list_folder(client, drive_path, corp["id"])
    people_folder = corp_items.find { |i| i["folder"] && i["name"] == "People" }

    puts "People folder contents:"
    people_items = list_folder(client, drive_path, people_folder["id"])
    people_items.each { |i| puts "  #{i['name']} (#{i['folder'] ? "#{i['folder']['childCount']} files" : 'file'})" }
    puts

    imported = 0
    errors = []

    people_items.each do |person_folder|
      next unless person_folder["folder"]
      folder_name = person_folder["name"]

      # Match contact by name
      contact = nil
      if folder_name.include?("Andrew")
        contact = Contact.where("first_name ILIKE ?", "%Andrew%").first
      elsif folder_name.include?("Rob") || folder_name.include?("Robert")
        contact = Contact.where("first_name ILIKE ? AND last_name ILIKE ?", "%Robert%", "%Harder%").first
      elsif folder_name.include?("Rach")
        contact = Contact.where("first_name ILIKE ?", "%Rachel%").first
      end

      puts "Processing: #{folder_name}"
      puts "  Contact: #{contact ? contact.display_name : '(no match)'}"

      files = list_folder(client, drive_path, person_folder["id"])

      files.each do |file|
        next if file["folder"]

        # Skip if no contact match - People documents must link to a person
        unless contact
          puts "    Skip (no contact): #{file['name']}"
          next
        end

        existing = CorporateCompanyDocument.find_by(sharepoint_file_id: file["id"])
        if existing
          puts "    Skip (exists): #{file['name']}"
          next
        end

        begin
          details = get_details(client, drive_path, file["id"])
          download_url = details["@microsoft.graph.downloadUrl"]

          ext = File.extname(file["name"])
          title = file["name"].sub(/#{Regexp.escape(ext)}$/, "")

          CorporateCompanyDocument.create!(
            contact_id: contact&.id,
            display_name: title,
            file_name: file["name"],
            document_type: "other",
            folder: "People",
            register_folder: "People",
            storage_type: "electronic",
            source: "sharepoint",
            sharepoint_file_id: file["id"],
            sharepoint_download_url: download_url,
            file_size: file["size"],
            mime_type: file.dig("file", "mimeType") || "application/octet-stream",
            uploaded_at: Time.current,
            last_modified_at: file["lastModifiedDateTime"]
          )

          puts "    Imported: #{file['name']}"
          imported += 1
        rescue => e
          errors << "#{file['name']}: #{e.message}"
          puts "    ERROR: #{file['name']} - #{e.message}"
        end
      end
    end

    puts
    puts "=" * 50
    puts "Imported: #{imported} documents"
    puts "Errors: #{errors.length}"
    errors.first(5).each { |e| puts "  #{e}" } if errors.any?
  end
end

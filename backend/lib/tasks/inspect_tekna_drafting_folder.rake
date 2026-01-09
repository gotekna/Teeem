namespace :corporate do
  desc "Inspect what's in Tekna Drafting folder"
  task inspect_tekna_drafting: :environment do
    puts "Inspecting Tekna Drafting Folder"
    puts "=" * 80

    begin
      client = MicrosoftGraphClient.new
      drive_id = client.instance_variable_get(:@credential).drive_id

      # Navigate to folder
      root_items = client.get("/drives/#{drive_id}/root/children")
      corporate_folder = root_items["value"].find { |item| item["name"] == "Corporate File" && item["folder"] }

      corporate_items = client.get("/drives/#{drive_id}/items/#{corporate_folder['id']}/children")
      tekna_group = corporate_items["value"].find { |item| item["name"] == "Tekna Group" && item["folder"] }

      tekna_group_items = client.get("/drives/#{drive_id}/items/#{tekna_group['id']}/children")
      tekna_drafting_folder = tekna_group_items["value"].find { |item| item["name"] == "Tekna Drafting" && item["folder"] }

      puts "Folder: #{tekna_drafting_folder['webUrl']}"
      puts ""

      # List everything in it
      items = client.get("/drives/#{drive_id}/items/#{tekna_drafting_folder['id']}/children")

      puts "Contents:"
      puts "-" * 80

      items["value"].each do |item|
        if item["folder"]
          puts "📁 #{item['name']}"
          # List subfolder contents
          subfolder_items = client.get("/drives/#{drive_id}/items/#{item['id']}/children")
          subfolder_items["value"].each do |subitem|
            prefix = subitem["folder"] ? "  📁" : "  📄"
            puts "#{prefix} #{subitem['name']}"
          end
        else
          puts "📄 #{item['name']}"
        end
      end

      puts ""
      puts "Total items: #{items['value'].count}"

    rescue => e
      puts "Error: #{e.message}"
      puts e.backtrace.first(5)
    end
  end
end

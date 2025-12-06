namespace :corporate do
  desc "Scan Corporate File folder in SharePoint"
  task scan_folder: :environment do
    puts "Scanning Corporate File folder in SharePoint"
    puts "=" * 80

    begin
      client = MicrosoftGraphClient.new

      # Try to get the Corporate File folder by listing root and finding it
      puts "\nLooking for 'Corporate File' folder..."
      root_items = client.get("/drives/#{client.instance_variable_get(:@credential).drive_id}/root/children")
      corporate_folder = root_items["value"].find { |item| item["name"] == "Corporate File" && item["folder"] }

      if corporate_folder
        puts "✅ Found: Corporate File"
        puts "   ID: #{corporate_folder['id']}"
        puts "   URL: #{corporate_folder['webUrl']}"
        puts ""

        # List items in Corporate File
        puts "Contents of Corporate File:"
        puts "-" * 80
        items = client.get("/drives/#{client.instance_variable_get(:@credential).drive_id}/items/#{corporate_folder['id']}/children")

        items["value"].each do |item|
          if item["folder"]
            puts "📁 #{item['name']}"

            # List contents of each company group folder
            subfolder_items = client.get("/drives/#{client.instance_variable_get(:@credential).drive_id}/items/#{item['id']}/children")
            subfolder_items["value"].each do |subitem|
              prefix = subitem["folder"] ? "  📁" : "  📄"
              puts "#{prefix} #{subitem['name']}"
            end
            puts ""
          else
            puts "📄 #{item['name']}"
          end
        end

        puts ""
        puts "=" * 80
        puts "Total items: #{items['value'].count}"

      else
        puts "❌ Corporate File folder not found at root of drive"
        puts ""
        puts "Listing root folders to help locate it:"
        root_items = client.get("/drives/#{client.instance_variable_get(:@credential).drive_id}/root/children")
        root_items["value"].select { |i| i["folder"] }.each do |folder|
          puts "  📁 #{folder['name']}"
        end
      end

    rescue => e
      puts "❌ Error: #{e.class}"
      puts "   Message: #{e.message}"
      puts ""
      puts "Stack trace:"
      puts e.backtrace.first(10).map { |line| "   #{line}" }.join("\n")
    end
  end
end

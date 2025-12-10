require 'csv'

puts "\n" + "=" * 80
puts "SHAREPOINT CORPORATE FOLDER INVENTORY"
puts "=" * 80
puts ""

# Initialize service
service = CorporateOnedriveService.new

# Get Microsoft Graph client
client = service.send(:get_onedrive_client)

unless client
  puts "❌ Could not initialize OneDrive client"
  exit 1
end

# Find root folder
puts "📁 Finding Corporate folder root..."
root_folder = service.find_folder_by_path("00 TEEEM PRIVATE")

unless root_folder
  puts "❌ Could not find Corporate folder root"
  exit 1
end

puts "✅ Found root: #{root_folder['name']}"
puts "   Folder ID: #{root_folder['id']}"
puts ""

# Recursively collect all items
puts "📂 Scanning folders recursively..."
all_items = []

def traverse_folder(service, client, folder_id, current_path, all_items, depth = 0)
  return if depth > 10

  indent = "  " * depth
  puts "#{indent}📂 #{current_path.empty? ? '(root)' : current_path}"

  items = service.list_folder_children(client, folder_id)

  items.each do |item|
    item_path = current_path.empty? ? item["name"] : "#{current_path}/#{item["name"]}"
    path_parts = item_path.split('/')

    group_name = path_parts[0]
    company_folder = path_parts[1]
    current_folder_name = path_parts.length > 2 ? path_parts[-2] : nil

    company_code = nil
    if company_folder&.include?(' - ')
      company_code = company_folder.split(' - ').first
    end

    is_folder = item["folder"].present?

    if is_folder
      all_items << {
        id: item["id"],
        name: item["name"],
        full_path: item_path,
        is_folder: true,
        size: 0,
        last_modified: item["lastModifiedDateTime"],
        current_folder: current_folder_name,
        group_name: group_name,
        company_folder: company_folder,
        company_code: company_code,
        web_url: item["webUrl"]
      }

      traverse_folder(service, client, item["id"], item_path, all_items, depth + 1)
    else
      file_extension = File.extname(item["name"]).downcase
      file_size_mb = item["size"] ? (item["size"].to_f / (1024 * 1024)).round(2) : 0.0

      all_items << {
        id: item["id"],
        name: item["name"],
        full_path: item_path,
        is_folder: false,
        size: item["size"],
        size_mb: file_size_mb,
        last_modified: item["lastModifiedDateTime"],
        current_folder: current_folder_name,
        group_name: group_name,
        company_folder: company_folder,
        company_code: company_code,
        extension: file_extension,
        web_url: item["webUrl"],
        download_url: item["@microsoft.graph.downloadUrl"]
      }
    end
  end

  puts "#{indent}   Found: #{items.count} items"
rescue StandardError => e
  puts "#{indent}   ❌ Error: #{e.message}"
end

traverse_folder(service, client, root_folder["id"], "", all_items)

# Separate files and folders
files = all_items.select { |item| item[:is_folder] == false }
folders = all_items.select { |item| item[:is_folder] == true }

puts ""
puts "=" * 80
puts "SCAN COMPLETE"
puts "=" * 80
puts "Total folders: #{folders.count}"
puts "Total files: #{files.count}"
puts ""

# Export to CSV
output_file = "/tmp/sharepoint_corporate_inventory.csv"
puts "💾 Exporting to #{output_file}..."

CSV.open(output_file, "w") do |csv|
  csv << [
    "file_id",
    "file_name",
    "full_path",
    "file_extension",
    "file_size_bytes",
    "file_size_mb",
    "last_modified",
    "current_folder",
    "group_name",
    "company_folder",
    "company_code",
    "web_url",
    "download_url"
  ]

  files.each do |file|
    csv << [
      file[:id],
      file[:name],
      file[:full_path],
      file[:extension],
      file[:size],
      file[:size_mb],
      file[:last_modified],
      file[:current_folder],
      file[:group_name],
      file[:company_folder],
      file[:company_code],
      file[:web_url],
      file[:download_url]
    ]
  end
end

puts "✅ Exported #{files.count} files"
puts ""

# Print summary
puts "=" * 80
puts "SUMMARY BY GROUP"
puts "=" * 80
puts ""

files_by_group = files.group_by { |f| f[:group_name] }
files_by_group.sort_by { |group, _| group || "" }.each do |group, group_files|
  puts "#{group || '(root)'}:"
  puts "  #{group_files.count} files"

  by_company = group_files.group_by { |f| f[:company_folder] }
  by_company.sort_by { |company, _| company || "" }.each do |company, company_files|
    puts "    #{company || '(no company)'}: #{company_files.count} files"
  end
  puts ""
end

puts "=" * 80
puts "✅ Inventory complete! File saved: #{output_file}"
puts "=" * 80
puts ""

# Print first 20 files as sample
puts "SAMPLE FILES (first 20):"
puts "-" * 80
files.first(20).each do |f|
  puts "#{f[:full_path]}"
end

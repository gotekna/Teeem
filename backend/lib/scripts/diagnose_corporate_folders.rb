# Diagnostic script to understand the folder structure in "Corporate File/"
# This will help us fix the company mapping logic

puts "=== Corporate File Folder Structure Diagnosis ==="
puts ""

credential = OrganizationOneDriveCredential.active_credential
if credential.nil?
  puts "ERROR: No active OneDrive credential found"
  exit 1
end

client = MicrosoftGraphClient.new

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

puts "Corporate File folder ID: #{corporate_file_folder['id']}"
puts ""

# List immediate children (Level 1 - should be company folders)
puts "=== Level 1: Direct Children of Corporate File/ ==="
level1_folders = []
begin
  result = client.get("/drives/#{credential.drive_id}/items/#{corporate_file_folder['id']}/children")
  result["value"].each do |item|
    type = item["folder"] ? "FOLDER" : "FILE"
    level1_folders << item if item["folder"]
    puts "  #{type}: #{item['name']}"
  end
rescue => e
  puts "ERROR: #{e.message}"
end

puts ""
puts "Total Level 1 folders: #{level1_folders.count}"
puts ""

# For each Level 1 folder, list Level 2 children
puts "=== Level 2: Children of each Level 1 folder ==="
level1_folders.first(10).each do |folder|
  puts ""
  puts "#{folder['name']}/"
  begin
    result = client.get("/drives/#{credential.drive_id}/items/#{folder['id']}/children")
    result["value"].first(20).each do |item|
      type = item["folder"] ? "FOLDER" : "FILE"
      puts "  #{type}: #{item['name']}"
    end
    if result["value"].count > 20
      puts "  ... and #{result['value'].count - 20} more items"
    end
  rescue => e
    puts "  ERROR: #{e.message}"
  end
end

if level1_folders.count > 10
  puts ""
  puts "... and #{level1_folders.count - 10} more Level 1 folders"
end

puts ""
puts "=== Company Code Analysis ==="
puts ""

# Get all company codes from database
companies = CorporateCompany.all.pluck(:id, :code, :name)
puts "Companies in database: #{companies.count}"
companies.each do |id, code, name|
  puts "  ID: #{id}, Code: #{code || 'N/A'}, Name: #{name}"
end

puts ""
puts "=== Matching Analysis ==="
puts ""

# Try to match Level 1 folder names to company codes/names
matched = []
unmatched = []

level1_folders.each do |folder|
  folder_name = folder["name"]

  # Try exact code match at start (e.g., "T - Tekna" -> "T")
  code_match = folder_name.match(/^([A-Z0-9]+)\s*[-–]\s*/i)
  if code_match
    code = code_match[1].upcase
    company = companies.find { |id, c, n| c&.upcase == code }
    if company
      matched << { folder: folder_name, company_id: company[0], company_code: company[1], company_name: company[2], match_type: "code" }
      next
    end
  end

  # Try name match
  company = companies.find { |id, c, n| folder_name.downcase.include?(n.downcase) || n.downcase.include?(folder_name.downcase) }
  if company
    matched << { folder: folder_name, company_id: company[0], company_code: company[1], company_name: company[2], match_type: "name" }
    next
  end

  # Try partial code match anywhere in folder name
  company = companies.find { |id, c, n| c && folder_name.upcase.include?(c.upcase) }
  if company
    matched << { folder: folder_name, company_id: company[0], company_code: company[1], company_name: company[2], match_type: "partial_code" }
    next
  end

  unmatched << folder_name
end

puts "MATCHED FOLDERS (#{matched.count}):"
matched.each do |m|
  puts "  '#{m[:folder]}' -> #{m[:company_code]} - #{m[:company_name]} (#{m[:match_type]})"
end

puts ""
puts "UNMATCHED FOLDERS (#{unmatched.count}):"
unmatched.each do |f|
  puts "  '#{f}'"
end

puts ""
puts "=== Sample File Paths ==="
puts ""

# Get a sample of file paths to understand the structure
sample_files = []
def get_sample_files(client, drive_id, folder_id, current_path, sample_files, depth = 0)
  return if depth > 3 || sample_files.count >= 30

  begin
    result = client.get("/drives/#{drive_id}/items/#{folder_id}/children")
    result["value"].each do |item|
      break if sample_files.count >= 30

      item_path = "#{current_path}/#{item['name']}"
      if item["file"]
        sample_files << item_path
      elsif item["folder"] && depth < 3
        get_sample_files(client, drive_id, item["id"], item_path, sample_files, depth + 1)
      end
    end
  rescue => e
    # Ignore errors
  end
end

get_sample_files(client, credential.drive_id, corporate_file_folder["id"], "Corporate File", sample_files)

puts "Sample file paths (first 30):"
sample_files.each_with_index do |path, i|
  puts "  #{i+1}. #{path}"
end

puts ""
puts "=== Recommendations ==="
puts ""
puts "Based on this analysis, the mapping logic needs to be updated to handle:"
puts "- The actual folder naming convention used in Corporate File/"
puts "- Any folders that don't match the expected 'CODE - Name' format"

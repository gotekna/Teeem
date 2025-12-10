require 'csv'

puts "\n" + "=" * 80
puts "SHAREPOINT CORPORATE FOLDER INVENTORY"
puts "=" * 80
puts ""

# Initialize service with auto folder detection
service = CorporateOnedriveService.new(folder_path: "auto")

# Use the preview method (public API)
puts "📁 Scanning SharePoint Corporate folder..."
result = service.preview

unless result[:success]
  puts "❌ Error: #{result[:error]}"
  exit 1
end

puts "✅ Scan complete!"
puts ""
puts "=" * 80
puts "SUMMARY"
puts "=" * 80
puts "Corporate folder: #{result[:corporate_folder]}"
puts "Total folders: #{result[:total_folders]}"
puts "Matched companies: #{result[:matched_folders]}"
puts "Unmatched folders: #{result[:total_folders] - result[:matched_folders]}"
puts "Total documents: #{result[:total_documents]}"
puts ""

# Prepare CSV export
csv_path = '/tmp/sharepoint_corporate_inventory.csv'
all_files = []

# Collect all files from the result
result[:companies].each do |company_info|
  group_name = company_info[:folder_name].split(' / ').first if company_info[:folder_name].include?(' / ')
  company_folder = company_info[:folder_name].split(' / ').last || company_info[:folder_name]

  # Extract company code from "CODE - Company Name" pattern
  company_code = company_folder.match(/^([A-Z]+)\s*-/)&.captures&.first

  company_info[:documents].each do |doc|
    all_files << {
      file_id: '',  # Not available from preview
      file_name: doc[:name],
      full_path: "#{result[:corporate_folder]}/#{company_info[:folder_name]}/#{doc[:name]}",
      file_extension: File.extname(doc[:name]),
      file_size_bytes: 0,  # Not available from preview
      file_size_mb: 0,
      last_modified: '',  # Not available from preview
      current_folder: company_info[:folder_name],
      parent_folder: company_info[:folder_name].split(' / ').first,
      group_name: group_name || company_info[:folder_name],
      company_folder: company_folder,
      company_code: company_code || '',
      web_url: '',  # Not available from preview
      download_url: '',  # Not available from preview
      matched_company_id: company_info[:company_id] || '',
      matched_company_name: company_info[:company_name] || '',
      document_type: doc[:type] || ''
    }
  end
end

# Export to CSV
puts "💾 Exporting to #{csv_path}..."
CSV.open(csv_path, 'w') do |csv|
  # Headers
  csv << [
    'file_id',
    'file_name',
    'full_path',
    'file_extension',
    'file_size_bytes',
    'file_size_mb',
    'last_modified',
    'current_folder',
    'parent_folder',
    'group_name',
    'company_folder',
    'company_code',
    'web_url',
    'download_url',
    'matched_company_id',
    'matched_company_name',
    'document_type'
  ]

  # Data rows
  all_files.each do |file|
    csv << [
      file[:file_id],
      file[:file_name],
      file[:full_path],
      file[:file_extension],
      file[:file_size_bytes],
      file[:file_size_mb],
      file[:last_modified],
      file[:current_folder],
      file[:parent_folder],
      file[:group_name],
      file[:company_folder],
      file[:company_code],
      file[:web_url],
      file[:download_url],
      file[:matched_company_id],
      file[:matched_company_name],
      file[:document_type]
    ]
  end
end

puts "✅ Exported #{all_files.count} files"
puts ""

# Summary by group
puts "=" * 80
puts "SUMMARY BY FOLDER"
puts "=" * 80
puts ""

result[:companies].each do |company_info|
  puts "#{company_info[:folder_name]}"
  puts "  Company: #{company_info[:matched] ? company_info[:company_name] : 'UNMATCHED'}"
  puts "  Documents: #{company_info[:document_count]}"
  puts ""
end

puts "=" * 80
puts "✅ Inventory complete! File saved: #{csv_path}"
puts "=" * 80
puts ""
puts "To download the file from Heroku:"
puts "  heroku run --app teeemlive 'cat #{csv_path}' > sharepoint_inventory.csv"
puts ""

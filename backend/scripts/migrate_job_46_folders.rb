# frozen_string_literal: true

# One-time migration to rename Job 46 SharePoint folders to match WarehouseFolder names
# Usage: rails runner scripts/migrate_job_46_folders.rb

job = Job.find(46)
puts "Job 46: #{job.name}"
puts "SharePoint Status: #{job.sharepoint_folder_status}"
puts

# Folder mappings: old name => new name
ROOT_MAPPINGS = {
  '01 Sales' => 'Sales',
  '02 PreCon' => 'PreCon',
  '04 Plans' => 'Plans',
  '05 Active' => 'Site',
  '06 Photo' => 'Photo',
  '07 Final Approval' => 'Final Certificate',
}.freeze

# Photo subfolder mappings
PHOTO_MAPPINGS = {
  '01 SITE' => 'Site Photo',
  '02 SLAB' => 'Slab Photo',
  '03 FRAME' => 'Frame Photo',
  '04 ENCLOSED' => 'Enclosed Photo',
  '05 FIXING' => 'Fixing Photo',
  '06 Practical Completion' => 'PC Photo',
  '07 Supervisor Photos' => 'Supervisor Photo',
}.freeze

# Get SharePoint client
cred = OrganizationSharePointCredential.active_credential
unless cred
  puts "ERROR: No SharePoint credential found"
  exit 1
end

client = MicrosoftGraphClient.new(cred)

# Find job folder
job_folder = client.find_job_folder(job)
unless job_folder
  puts "ERROR: Could not find job folder in SharePoint"
  exit 1
end

puts "Job folder ID: #{job_folder['id']}"
puts

# Get current folder structure
contents = client.list_folder_contents(job_folder['id'])
folders = contents.select { |item| item[:is_folder] }

renamed_count = 0
errors = []

puts "Renaming root folders..."
folders.each do |folder|
  old_name = folder[:name]
  new_name = ROOT_MAPPINGS[old_name]

  next unless new_name
  next if old_name == new_name

  begin
    client.rename_file(folder[:id], new_name)
    puts "  #{old_name} => #{new_name}"
    renamed_count += 1
  rescue => e
    errors << { folder: old_name, error: e.message }
    puts "  ERROR: #{old_name} - #{e.message}"
  end
end

# Find Photo folder (might be renamed already)
puts
puts "Renaming Photo subfolders..."
photo_folder = folders.find { |f| f[:name] == '06 Photo' || f[:name] == 'Photo' }

if photo_folder
  photo_contents = client.list_folder_contents(photo_folder[:id])
  photo_subfolders = photo_contents.select { |item| item[:is_folder] }

  photo_subfolders.each do |subfolder|
    old_name = subfolder[:name]
    new_name = PHOTO_MAPPINGS[old_name]

    next unless new_name
    next if old_name == new_name

    begin
      client.rename_file(subfolder[:id], new_name)
      puts "  #{old_name} => #{new_name}"
      renamed_count += 1
    rescue => e
      errors << { folder: "Photo/#{old_name}", error: e.message }
      puts "  ERROR: #{old_name} - #{e.message}"
    end
  end
else
  puts "  Photo folder not found"
end

puts
puts "=" * 50
puts "Done! Renamed #{renamed_count} folders"
puts "Errors: #{errors.count}"
errors.each { |e| puts "  - #{e[:folder]}: #{e[:error]}" }

# Script to find all job folders in OneDrive and sync their documents
#
# Usage: rails runner lib/scripts/sync_all_job_documents.rb

puts "=== Sync All Job Documents ==="

credential = OrganizationOneDriveCredential.active_credential
unless credential
  puts "ERROR: No active OneDrive credential found"
  exit 1
end

client = MicrosoftGraphClient.new(credential)
puts "Using root folder ID: #{credential.root_folder_id}"

# List all folders in OneDrive root
result = client.list_folder_items(credential.root_folder_id)
folders = (result["value"] || []).select { |f| f["folder"] }
puts "\nFound #{folders.count} folders in OneDrive root"

# Match folders to jobs and mark them as completed
jobs_found = []
folder_map = {} # Map job_id to folder

folders.each do |folder|
  puts "\nFolder: #{folder['name']}"
  # Extract job code from folder name (e.g., "069 - XC 12-83 West Ridge Street")
  # Pattern: First 3 digits at the start
  if folder["name"] =~ /^(\d{3})\s*-/
    job_code = $1.to_i
    job = Job.find_by(id: job_code)
    if job
      puts "  -> Matches Job #{job_code}: #{job.title}"
      if job.onedrive_folder_creation_status != "completed"
        job.update_column(:onedrive_folder_creation_status, "completed")
        puts "  -> Marked as completed"
      else
        puts "  -> Already completed"
      end
      jobs_found << job
      folder_map[job.id] = folder
    else
      puts "  -> No job found with ID #{job_code}"
    end
  else
    puts "  -> Could not extract job code from folder name"
  end
end

puts "\n=== Summary ==="
puts "Jobs with OneDrive folders: #{jobs_found.count}"
puts "Total jobs in system: #{Job.count}"
puts "Jobs needing folders: #{Job.count - jobs_found.count}"

# Now sync documents for all completed jobs
puts "\n=== Syncing Documents ==="
puts "Syncing #{jobs_found.count} jobs..."

jobs_found.each do |job|
  puts "\nSyncing Job #{job.id}: #{job.title}"
  begin
    # Use the folder we found, not find_job_folder which has different naming expectations
    folder = folder_map[job.id]
    next unless folder

    # Recursive function to list all files
    files_synced = 0
    files_skipped = 0

    process_folder = lambda do |folder_id, folder_path|
      result = client.send(:get, "#{client.send(:drive_path)}/items/#{folder_id}/children")
      items = result["value"] || []

      items.each do |item|
        if item["folder"]
          # Recurse into subfolders
          subfolder_path = folder_path.present? ? "#{folder_path}/#{item['name']}" : item["name"]
          process_folder.call(item["id"], subfolder_path)
        else
          # It's a file - sync it
          extension = File.extname(item["name"]).delete(".").downcase
          file_type = case extension
          when "pdf", "doc", "docx" then "document"
          when "xls", "xlsx", "csv" then "spreadsheet"
          when "jpg", "jpeg", "png", "gif", "heic" then "image"
          else "other"
          end

          # Find or create job document
          doc = JobDocument.find_or_initialize_by(
            job_id: job.id,
            onedrive_item_id: item["id"]
          )

          doc.assign_attributes(
            onedrive_drive_id: client.instance_variable_get(:@drive_id) || credential.id.to_s,
            file_name: item["name"],
            file_extension: extension,
            file_type: file_type,
            file_size: item["size"],
            folder_path: folder_path,
            web_url: item["webUrl"],
            last_modified_at: item["lastModifiedDateTime"],
            sync_status: "synced",
            last_synced_at: Time.current
          )

          if doc.new_record?
            doc.save!
            files_synced += 1
          else
            doc.save! if doc.changed?
            files_skipped += 1
          end
        end
      end
    end

    process_folder.call(folder["id"], "")
    puts "  -> Synced: #{files_synced} new, #{files_skipped} existing"
  rescue => e
    puts "  -> ERROR: #{e.message}"
  end
end

puts "\n=== Final Summary ==="
total_docs = JobDocument.count
puts "Total documents synced: #{total_docs}"
Job.where(onedrive_folder_creation_status: "completed").each do |job|
  count = job.job_documents.count
  puts "  Job #{job.id}: #{count} documents"
end

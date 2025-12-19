# Create OneDrive folders for Job 69
job = Job.find(69)
puts "=== CREATING ONEDRIVE FOLDERS FOR JOB 69 ==="
puts "Job: #{job.title}"
puts ""

credential = OrganizationOneDriveCredential.active_credential
unless credential&.valid_credential?
  puts "ERROR: SharePoint not connected"
  exit 1
end
puts "OneDrive connected ✓"

template = FolderTemplate.find_by(is_system_default: true, is_active: true)
puts "Template: #{template.name}"
puts ""

client = MicrosoftGraphClient.new(credential)

# Check if folder already exists
existing = client.find_job_folder(job)
if existing
  puts "Folder already exists: #{existing['name']}"
  puts "URL: #{existing['webUrl']}"
else
  puts "Creating folder structure..."
  begin
    job_folder = client.create_job_folder_structure(job, template)
    puts "✓ Created: #{job_folder['name']}"
    puts "URL: #{job_folder['webUrl']}"

    # Update job status
    job.update!(
      onedrive_folder_creation_status: "completed",
      onedrive_folders_created_at: Time.current
    )
    puts "✓ Job updated with folder info"
  rescue => e
    puts "ERROR: #{e.message}"
    puts e.backtrace.first(5).join("\n")
  end
end

puts ""
puts "=== DONE ==="

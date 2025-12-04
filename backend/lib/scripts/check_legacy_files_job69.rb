# Check legacy files for Job 69
job = Job.find(69)
puts "=== CHECKING LEGACY FILES FOR JOB 69 ==="
puts "Job: #{job.title}"
puts ""

begin
  service = JobDocumentMigrationService.new
  files = service.list_legacy_files_for_job(job)

  if files.empty?
    puts "No legacy files found for this job"
  else
    puts "Found #{files.length} legacy files:"
    files.each do |file|
      size_mb = (file[:size].to_f / 1024 / 1024).round(2)
      puts "  - #{file[:name]} (#{file[:file_type]}, #{size_mb} MB)"
    end
  end
rescue => e
  puts "Error: #{e.message}"
  puts "Note: Legacy files are located in 'Old House Data/00 Active' folder"
end

puts ""
puts "=== DONE ==="

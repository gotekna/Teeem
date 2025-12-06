namespace :jobs do
  desc "Preview address geocoding for all jobs (no changes made)"
  task geocode_preview: :environment do
    puts "Previewing address geocoding for all jobs..."
    puts ""

    service = JobAddressService.new

    Job.find_each do |job|
      result = service.process_job(job, preview: true)

      case result[:status]
      when :success
        puts "=" * 60
        puts "Job ID: #{job.id}"
        puts "Original: #{result[:original_title]}"
        puts "New Title: #{result[:new_title]}"
        puts "Location: #{result[:location]}"
        puts "Coords: #{result[:latitude]}, #{result[:longitude]}"
        puts ""
      when :already_geocoded
        puts "[SKIP] Job #{job.id}: Already geocoded"
      when :skipped
        puts "[SKIP] Job #{job.id}: #{result[:reason]} - '#{job.title}'"
      when :geocode_failed
        puts "[FAIL] Job #{job.id}: Geocoding failed for '#{result[:parsed][:address]}'"
        puts "       Parsed: #{result[:parsed].inspect}"
      when :error
        puts "[ERROR] Job #{job.id}: #{result[:error]}"
      end
    end

    puts ""
    puts "=" * 60
    puts "=== Summary ==="
    puts "Jobs processed:    #{service.stats[:jobs_processed]}"
    puts "Would geocode:     #{service.stats[:jobs_processed] - service.stats[:already_geocoded] - service.stats[:skipped_no_address] - service.stats[:geocode_failed]}"
    puts "Already geocoded:  #{service.stats[:already_geocoded]}"
    puts "Skipped (no addr): #{service.stats[:skipped_no_address]}"
    puts "Geocode failed:    #{service.stats[:geocode_failed]}"

    if service.stats[:errors].any?
      puts ""
      puts "=== Errors (#{service.stats[:errors].count}) ==="
      service.stats[:errors].first(10).each { |e| puts "  - #{e}" }
    end

    puts ""
    puts "Run 'rails jobs:geocode_all' to apply changes."
  end

  desc "Geocode addresses for all jobs and update titles"
  task geocode_all: :environment do
    unless ENV["MAPBOX_ACCESS_TOKEN"].present?
      puts "ERROR: MAPBOX_ACCESS_TOKEN environment variable is not set"
      puts "Please set it with: heroku config:set MAPBOX_ACCESS_TOKEN=your_token"
      exit 1
    end

    puts "Geocoding addresses for all jobs..."
    puts ""

    service = JobAddressService.new
    stats = service.process_all_jobs(preview: false)

    puts ""
    puts "=== Results ==="
    puts "Jobs processed:    #{stats[:jobs_processed]}"
    puts "Geocoded:          #{stats[:geocoded]}"
    puts "Already geocoded:  #{stats[:already_geocoded]}"
    puts "Skipped (no addr): #{stats[:skipped_no_address]}"
    puts "Geocode failed:    #{stats[:geocode_failed]}"

    if stats[:errors].any?
      puts ""
      puts "=== Errors (#{stats[:errors].count}) ==="
      stats[:errors].first(10).each { |e| puts "  - #{e}" }
    end

    puts ""
    puts "Done!"
  end

  desc "Geocode a single job by ID"
  task :geocode, [ :job_id ] => :environment do |_, args|
    unless args[:job_id].present?
      puts "Usage: rails jobs:geocode[JOB_ID]"
      exit 1
    end

    job = Job.find(args[:job_id])
    service = JobAddressService.new

    puts "Processing job: #{job.title}"
    puts ""

    # Preview first
    result = service.process_job(job, preview: true)

    case result[:status]
    when :success
      puts "Original Title: #{result[:original_title]}"
      puts "New Title:      #{result[:new_title]}"
      puts "Location:       #{result[:location]}"
      puts "Coordinates:    #{result[:latitude]}, #{result[:longitude]}"
      puts ""
      puts "Parsed data: #{result[:parsed].inspect}"

      print "Apply changes? (y/n): "
      if STDIN.gets.chomp.downcase == "y"
        service = JobAddressService.new
        service.process_job(job, preview: false)
        puts "Updated!"
      else
        puts "Cancelled."
      end
    when :skipped
      puts "Skipped: #{result[:reason]}"
    when :geocode_failed
      puts "Geocoding failed"
      puts "Parsed: #{result[:parsed].inspect}"
    when :error
      puts "Error: #{result[:error]}"
    end
  end

  desc "Test parsing a job title without geocoding"
  task :parse_title, [ :title ] => :environment do |_, args|
    unless args[:title].present?
      puts "Usage: rails jobs:parse_title['Your Job Title Here']"
      exit 1
    end

    service = JobAddressService.new
    result = service.parse_job_title(args[:title])

    puts "Input:        #{args[:title]}"
    puts ""
    puts "Parsed:"
    puts "  Prefix:       #{result[:prefix] || '(none)'}"
    puts "  Job Number:   #{result[:job_number] || '(none)'}"
    puts "  House Number: #{result[:house_number] || '(none)'}"
    puts "  Address:      #{result[:address] || '(none)'}"
  end
end

namespace :jobs do
  desc "Link clients to jobs based on invoice contacts"
  task link_clients: :environment do
    puts "Linking clients to jobs based on invoices..."
    puts ""

    service = JobClientLinkerService.new
    stats = service.link_all_jobs

    puts ""
    puts "=== Results ==="
    puts "Jobs processed:   #{stats[:jobs_processed]}"
    puts "Clients linked:   #{stats[:clients_linked]}"
    puts "Already linked:   #{stats[:already_linked]}"
    puts "No invoices:      #{stats[:no_invoices]}"
    puts "No contact:       #{stats[:no_contact]}"

    if stats[:errors].any?
      puts ""
      puts "=== Errors (#{stats[:errors].count}) ==="
      stats[:errors].first(10).each { |e| puts "  - #{e}" }
      puts "  ... and #{stats[:errors].count - 10} more" if stats[:errors].count > 10
    end

    puts ""
    puts "Done!"
  end

  desc "Preview client linking without saving"
  task preview_clients: :environment do
    puts "Previewing client suggestions for jobs..."
    puts ""

    service = JobClientLinkerService.new

    Job.includes(:job_contacts).find_each do |job|
      # Check if already has a client
      existing_client = job.job_contacts.find_by(role: "client")

      suggestion = service.suggest_client_for_job(job)

      if suggestion
        status = existing_client ? "[HAS CLIENT]" : "[NO CLIENT]"
        puts "#{status} Job: #{job.title}"
        puts "        Suggested: #{suggestion[:contact].display_name}"
        puts "        Invoices: #{suggestion[:invoice_count]}, Total: $#{'%.2f' % suggestion[:total_invoiced]}"
        if existing_client
          puts "        Current: #{existing_client.contact&.display_name || 'Unknown'}"
        end
        puts ""
      end
    end

    puts "Done! Run 'rails jobs:link_clients' to apply changes."
  end
end

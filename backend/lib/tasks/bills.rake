namespace :bills do
  desc "Show summary of jobs with unlinked Xero bills (no corresponding PO)"
  task summary: :environment do
    puts "Scanning for jobs with Xero bills that have no Purchase Order..."
    puts ""

    summary = BillToPurchaseOrderService.summary

    if summary.empty?
      puts "All bills have corresponding Purchase Orders!"
      next
    end

    total_bills = summary.sum { |s| s[:unlinked_bills] }
    total_value = summary.sum { |s| s[:total_value] || 0 }

    puts "%-8s %-20s %10s %15s" % ["Job ID", "Job Code", "Bills", "Total Value"]
    puts "-" * 58

    summary.each do |s|
      puts "%-8d %-20s %10d %15s" % [
        s[:job_id],
        s[:job_code].to_s.truncate(20),
        s[:unlinked_bills],
        "$#{"%.2f" % (s[:total_value] || 0)}"
      ]
    end

    puts "-" * 58
    puts "Total: #{total_bills} unlinked bills across #{summary.size} jobs ($#{"%.2f" % total_value})"
  end

  desc "Generate POs from Xero bills for a single job. Usage: rake bills:generate_pos[JOB_ID]"
  task :generate_pos, [:job_id] => :environment do |_t, args|
    job_id = args[:job_id]
    abort "Usage: rake bills:generate_pos[JOB_ID]" unless job_id.present?

    job = Job.find_by(id: job_id)
    abort "Job #{job_id} not found" unless job

    job_code = job.respond_to?(:job_code) ? job.job_code : job.id.to_s
    puts "Generating POs from Xero bills for Job #{job_code} (ID: #{job.id})..."

    service = BillToPurchaseOrderService.new(job)
    result = service.generate_all

    if result[:created].any?
      puts ""
      puts "Created #{result[:created].size} Purchase Orders:"
      result[:created].each do |po|
        puts "  #{po[:po_number]} - Bill #{po[:bill_number]} from #{po[:supplier]} ($#{"%.2f" % (po[:total] || 0)})"
      end
    end

    if result[:errors].any?
      puts ""
      puts "Errors (#{result[:errors].size}):"
      result[:errors].each do |err|
        puts "  Bill #{err[:bill_number]} (ID: #{err[:bill_id]}): #{err[:error]}"
      end
    end

    if result[:created].empty? && result[:errors].empty?
      puts "No unlinked bills found for this job."
    end

    puts ""
    puts "Summary: #{result[:created].size} created, #{result[:errors].size} errors"
  end

  desc "Generate POs from Xero bills for ALL jobs with unlinked bills"
  task generate_all_pos: :environment do
    puts "Scanning all jobs for unlinked Xero bills..."

    summary = BillToPurchaseOrderService.summary
    if summary.empty?
      puts "No unlinked bills found!"
      next
    end

    puts "Found #{summary.size} jobs with #{summary.sum { |s| s[:unlinked_bills] }} unlinked bills"
    puts ""

    total_created = 0
    total_errors = 0

    summary.each do |s|
      job = Job.find(s[:job_id])
      job_code = s[:job_code]
      print "Job #{job_code} (#{s[:unlinked_bills]} bills)... "

      service = BillToPurchaseOrderService.new(job)
      result = service.generate_all

      created = result[:created].size
      errors = result[:errors].size
      total_created += created
      total_errors += errors

      puts "#{created} POs created" + (errors > 0 ? ", #{errors} errors" : "")

      result[:errors].each do |err|
        puts "  ERROR: Bill #{err[:bill_number]}: #{err[:error]}"
      end
    end

    puts ""
    puts "=" * 50
    puts "Total: #{total_created} POs created, #{total_errors} errors"
  end
end

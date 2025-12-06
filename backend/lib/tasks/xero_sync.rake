namespace :xero do
  desc "Sync all invoices from Xero to local database (full sync)"
  task sync_invoices: :environment do
    puts "Starting full invoice sync from Xero..."
    puts "This may take several minutes for large datasets."
    puts ""

    service = ExternalInvoiceSyncService.new(source: "xero")
    result = service.sync

    puts ""
    puts "=" * 60
    puts "Sync Complete!"
    puts "=" * 60
    puts "Success: #{result[:success]}"
    puts ""
    puts "Stats:"
    puts "  Pages fetched: #{result[:stats][:pages_fetched]}"
    puts "  Total invoices: #{result[:stats][:total_invoices]}"
    puts "  Created: #{result[:stats][:created]}"
    puts "  Updated: #{result[:stats][:updated]}"
    puts "  Linked to jobs: #{result[:stats][:linked_to_jobs]}"
    puts "  Linked to contacts: #{result[:stats][:linked_to_contacts]}"
    puts ""

    if result[:stats][:errors].any?
      puts "Errors (#{result[:stats][:errors].count}):"
      result[:stats][:errors].first(10).each do |error|
        puts "  - #{error}"
      end
      puts "  ... and #{result[:stats][:errors].count - 10} more" if result[:stats][:errors].count > 10
    else
      puts "No errors!"
    end

    puts ""
    puts "Synced at: #{result[:synced_at]}"
  end

  desc "Incremental sync - only fetch invoices modified recently"
  task sync_invoices_incremental: :environment do
    since = ENV["SINCE"] ? Time.parse(ENV["SINCE"]) : nil

    puts "Starting incremental invoice sync from Xero..."
    puts "Since: #{since || 'last sync time'}"
    puts ""

    service = ExternalInvoiceSyncService.new(source: "xero")
    result = service.sync_incremental(since: since)

    puts ""
    puts "Incremental Sync Complete!"
    puts "Success: #{result[:success]}"
    puts "Stats: #{result[:stats].inspect}"
  end

  desc "Sync invoices for a specific tenant"
  task sync_invoices_tenant: :environment do
    tenant_id = ENV["TENANT_ID"]
    unless tenant_id
      puts "ERROR: TENANT_ID environment variable required"
      puts "Usage: rails xero:sync_invoices_tenant TENANT_ID=xxx-yyy-zzz"
      exit 1
    end

    puts "Starting invoice sync for tenant #{tenant_id}..."

    service = ExternalInvoiceSyncService.new(source: "xero", tenant_id: tenant_id)
    result = service.sync

    puts ""
    puts "Sync Complete!"
    puts "Success: #{result[:success]}"
    puts "Stats: #{result[:stats].inspect}"
  end

  desc "Show invoice sync status"
  task invoice_status: :environment do
    puts "External Invoice Sync Status"
    puts "=" * 60
    puts ""

    total = ExternalInvoice.count
    by_source = ExternalInvoice.group(:source).count
    by_type = ExternalInvoice.group(:invoice_type).count
    by_status = ExternalInvoice.group(:status).count
    linked_to_jobs = ExternalInvoice.where.not(job_id: nil).count
    linked_to_contacts = ExternalInvoice.where.not(contact_id: nil).count
    last_sync = ExternalInvoice.maximum(:last_synced_at)

    puts "Total invoices cached: #{total}"
    puts ""
    puts "By source:"
    by_source.each { |source, count| puts "  #{source}: #{count}" }
    puts ""
    puts "By type:"
    by_type.each { |type, count| puts "  #{type}: #{count}" }
    puts ""
    puts "By status:"
    by_status.each { |status, count| puts "  #{status}: #{count}" }
    puts ""
    puts "Linked to TEEEM jobs: #{linked_to_jobs}"
    puts "Linked to TEEEM contacts: #{linked_to_contacts}"
    puts ""
    puts "Last sync: #{last_sync || 'Never'}"
  end

  desc "Link unlinked invoices to jobs (by tracking category)"
  task link_invoices_to_jobs: :environment do
    puts "Linking invoices to jobs via tracking categories..."

    linked = 0
    ExternalInvoice.where(job_id: nil).find_each do |invoice|
      invoice.link_to_job!
      linked += 1 if invoice.job_id.present?
    end

    puts "Linked #{linked} invoices to jobs"
  end

  desc "Link unlinked invoices to contacts"
  task link_invoices_to_contacts: :environment do
    puts "Linking invoices to contacts..."

    linked = 0
    ExternalInvoice.where(contact_id: nil).find_each do |invoice|
      invoice.link_to_contact!
      linked += 1 if invoice.contact_id.present?
    end

    puts "Linked #{linked} invoices to contacts"
  end
end

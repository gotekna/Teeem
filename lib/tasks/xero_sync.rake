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

  desc "Full warehouse sync: invoices with line items + PDFs stored against contacts"
  task full_warehouse: :environment do
    puts "=" * 70
    puts "FULL XERO WAREHOUSE SYNC"
    puts "=" * 70
    puts ""
    puts "This will:"
    puts "  1. Fetch ALL invoices with FULL details (line items, payments, tracking)"
    puts "  2. Download PDFs and store against contacts in folder structure"
    puts ""
    puts "WARNING: This may take 60+ minutes due to Xero API rate limits."
    puts "         (~1.2 seconds per invoice for full details)"
    puts ""

    # Phase 1: Sync invoices with full details
    puts "=" * 70
    puts "PHASE 1: Syncing invoices with full details (line items)"
    puts "=" * 70
    puts ""

    service = ExternalInvoiceSyncService.new(source: "xero")
    result = service.sync_full

    puts ""
    puts "Invoice Sync Complete!"
    puts "  Total invoices: #{result[:stats][:total_invoices]}"
    puts "  Details fetched: #{result[:stats][:details_fetched] || 'N/A'}"
    puts "  Created: #{result[:stats][:created]}"
    puts "  Updated: #{result[:stats][:updated]}"
    puts "  Linked to jobs: #{result[:stats][:linked_to_jobs]}"
    puts "  Linked to contacts: #{result[:stats][:linked_to_contacts]}"
    puts ""

    if result[:stats][:errors].any?
      puts "Errors (#{result[:stats][:errors].count}):"
      result[:stats][:errors].first(5).each { |e| puts "  - #{e}" }
    end

    # Phase 2: Sync PDFs to contact folders
    puts ""
    puts "=" * 70
    puts "PHASE 2: Syncing PDFs to contact folders"
    puts "=" * 70
    puts ""

    # Only sync PDFs for invoices linked to contacts
    invoices_with_contacts = ExternalInvoice.where.not(contact_id: nil)
    total = invoices_with_contacts.count
    synced = 0
    pdf_count = 0
    attachment_count = 0
    errors = []

    puts "Found #{total} invoices linked to contacts"
    puts ""

    invoices_with_contacts.find_each.with_index do |invoice, index|
      begin
        result = XeroAttachmentSyncService.new(invoice).sync!
        pdf_count += 1 if result[:pdf].present?
        attachment_count += result[:attachments].count
        errors.concat(result[:errors]) if result[:errors].any?
      rescue StandardError => e
        errors << "Invoice #{invoice.invoice_number}: #{e.message}"
      end

      synced += 1
      if synced % 25 == 0 || synced == total
        puts "  Progress: #{synced}/#{total} invoices processed (#{pdf_count} PDFs, #{attachment_count} attachments)"
      end

      # Small delay between API calls
      sleep(0.5)
    end

    puts ""
    puts "=" * 70
    puts "FULL WAREHOUSE SYNC COMPLETE!"
    puts "=" * 70
    puts ""
    puts "Summary:"
    puts "  Invoices processed: #{synced}"
    puts "  PDFs synced: #{pdf_count}"
    puts "  Attachments synced: #{attachment_count}"
    puts ""

    if errors.any?
      puts "Errors (#{errors.count}):"
      errors.first(10).each { |e| puts "  - #{e}" }
      puts "  ... and #{errors.count - 10} more" if errors.count > 10
    else
      puts "No errors!"
    end

    puts ""
    puts "Documents are now available in contact tabs under BILLS/INVOICES folders."
  end

  desc "Sync PDFs only (for invoices already in warehouse)"
  task sync_pdfs: :environment do
    puts "Syncing PDFs for existing invoices..."
    puts "PDFs will be uploaded to SharePoint and stored in Active Storage."
    puts ""

    # Only sync PDFs for invoices linked to contacts
    invoices_with_contacts = ExternalInvoice.where.not(contact_id: nil)
    total = invoices_with_contacts.count
    synced = 0
    pdf_count = 0
    sharepoint_count = 0
    errors = []
    rate_limit_retries = 0
    max_rate_limit_retries = 3

    puts "Found #{total} invoices linked to contacts"

    invoices_with_contacts.find_each do |invoice|
      retries = 0
      begin
        result = XeroAttachmentSyncService.new(invoice).sync!
        pdf_count += 1 if result[:pdf].present?
        sharepoint_count += result[:sharepoint_uploads]&.count || 0
        errors.concat(result[:errors]) if result[:errors].any?
        rate_limit_retries = 0 # Reset on success
      rescue XeroApiClient::RateLimitError => e
        retries += 1
        rate_limit_retries += 1
        if retries <= 3
          wait_time = 60 * retries # Exponential backoff: 60s, 120s, 180s
          puts "\n[Rate Limit] Waiting #{wait_time}s before retry #{retries}/3 for invoice #{invoice.invoice_number}..."
          sleep(wait_time)
          retry
        else
          errors << "Invoice #{invoice.invoice_number}: Rate limit exceeded after 3 retries"
        end

        # If we hit rate limits too many times in a row, abort
        if rate_limit_retries >= max_rate_limit_retries
          puts "\n[ABORT] Hit rate limit #{max_rate_limit_retries} times in a row. Stopping sync."
          break
        end
      rescue StandardError => e
        errors << "Invoice #{invoice.invoice_number}: #{e.message}"
      end

      synced += 1
      if synced % 10 == 0
        puts "Progress: #{synced}/#{total} | PDFs: #{pdf_count} | SharePoint: #{sharepoint_count} | Errors: #{errors.count}"
      end

      # Xero has strict rate limits for PDF/attachment endpoints
      # Use 3s delay to stay safely under limit
      sleep(3)
    end

    puts ""
    puts ""
    puts "PDF Sync Complete!"
    puts "  Invoices processed: #{synced}"
    puts "  PDFs synced to Active Storage: #{pdf_count}"
    puts "  PDFs uploaded to SharePoint: #{sharepoint_count}"
    puts "  Errors: #{errors.count}"
    if errors.any?
      puts "\nFirst 10 errors:"
      errors.first(10).each { |e| puts "  - #{e}" }
    end
  end
end

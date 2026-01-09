namespace :xero do
  desc "Sync all invoices from Xero to local database (full sync)"
  task sync_invoices: :environment do
    # Check if we already have data - warn about API usage
    existing_count = ExternalInvoice.count
    if existing_count > 100
      puts "=" * 60
      puts "WARNING: You already have #{existing_count} invoices synced!"
      puts "Full sync makes 50-100+ API calls and may hit rate limits."
      puts ""
      puts "Consider using incremental sync instead:"
      puts "  bin/rails xero:sync_invoices_incremental"
      puts ""
      puts "Continue with full sync? (y/N)"
      puts "=" * 60

      # In non-interactive mode (heroku run:detached), skip confirmation
      unless ENV["SKIP_CONFIRMATION"] == "true"
        response = STDIN.gets&.strip&.downcase rescue "n"
        unless response == "y" || response == "yes"
          puts "Aborted. Use SKIP_CONFIRMATION=true to bypass this check."
          exit 0
        end
      end
    end

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

  desc "Fix external_id format for attachments (SSoT Bible #16.002)"
  task fix_external_id_format: :environment do
    puts "=" * 70
    puts "FIXING EXTERNAL_ID FORMAT (SSoT Bible #16.002)"
    puts "=" * 70
    puts ""
    puts "SSoT: external_id should be 'xero:attachment:ID'"
    puts "Wrong: 'xero:invoice-uuid:attachment:attachment-uuid'"
    puts ""

    # Find all documents with wrong format
    wrong_format_docs = CorporateCompanyDocument.where(source: "xero")
                                                .where("external_id LIKE ? OR external_id LIKE ?",
                                                       "%:invoice:%:attachment:%",
                                                       "xero:%:attachment:%")
                                                .where.not("external_id LIKE ?", "xero:attachment:%")

    total_count = wrong_format_docs.count
    puts "Found #{total_count} documents with wrong external_id format"
    puts ""

    if total_count == 0
      puts "✓ All documents already have correct format!"
      exit 0
    end

    puts "Fixing external_id format..."
    fixed_count = 0
    errors = []

    wrong_format_docs.find_each do |doc|
      begin
        # Extract attachment ID from old format
        # Old: xero:invoice-uuid:attachment:attachment-uuid
        # New: xero:attachment:attachment-uuid
        if doc.external_id =~ /xero:[^:]+:attachment:([a-f0-9-]+)/i
          attachment_id = $1
          new_external_id = "xero:attachment:#{attachment_id}"

          doc.update!(external_id: new_external_id)
          fixed_count += 1

          if fixed_count % 100 == 0
            puts "  Progress: #{fixed_count}/#{total_count} fixed"
          end
        else
          errors << "Could not parse external_id: #{doc.external_id}"
        end
      rescue StandardError => e
        errors << "ID #{doc.id}: #{e.message}"
      end
    end

    puts ""
    puts "=" * 70
    puts "COMPLETE!"
    puts "=" * 70
    puts "  Fixed: #{fixed_count}"
    puts "  Errors: #{errors.count}"
    puts ""

    if errors.any?
      puts "Errors:"
      errors.first(10).each { |e| puts "  - #{e}" }
      puts "  ... and #{errors.count - 10} more" if errors.count > 10
    else
      puts "✓ All documents now have correct SSoT format!"
    end
    puts ""
  end

  desc "Sync PDFs only (for invoices already in warehouse)"
  task sync_pdfs: :environment do
    puts "Syncing PDFs for existing invoices..."
    puts "PDFs will be uploaded to SharePoint and stored in Active Storage."
    puts ""

    # Find invoices that DON'T already have PDFs synced
    # This avoids unnecessary API calls for already-synced invoices
    already_synced_ids = CompanyDocument
      .where(source: "xero")
      .where("external_id LIKE ?", "xero:%:pdf")
      .where(documentable_type: "ExternalInvoice")
      .pluck(:documentable_id)

    invoices_needing_pdfs = ExternalInvoice
      .where.not(contact_id: nil)
      .where.not(id: already_synced_ids)

    total_with_contacts = ExternalInvoice.where.not(contact_id: nil).count
    already_synced = already_synced_ids.count
    remaining = invoices_needing_pdfs.count

    puts "=" * 60
    puts "PDF Sync Status:"
    puts "  Total invoices with contacts: #{total_with_contacts}"
    puts "  Already synced (skipping):    #{already_synced}"
    puts "  Remaining to sync:            #{remaining}"
    puts "=" * 60
    puts ""

    if remaining == 0
      puts "All PDFs already synced! Nothing to do."
      exit 0
    end

    # Estimate time (10s per invoice)
    estimated_minutes = (remaining * 10 / 60.0).round(0)
    puts "Estimated time: ~#{estimated_minutes} minutes (#{remaining} invoices x 10s delay)"
    puts ""

    synced = 0
    pdf_count = 0
    sharepoint_count = 0
    skipped_count = 0
    errors = []
    rate_limit_retries = 0
    max_rate_limit_retries = 3

    invoices_needing_pdfs.find_each do |invoice|
      retries = 0
      begin
        puts "[#{synced + 1}/#{remaining}] Syncing invoice #{invoice.invoice_number}..."
        result = XeroAttachmentSyncService.new(invoice).sync!

        if result[:skipped]
          skipped_count += 1
        elsif result[:pdf].present?
          pdf_count += 1
        end

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
          puts "Re-run this task later to continue where you left off."
          break
        end
      rescue StandardError => e
        errors << "Invoice #{invoice.invoice_number}: #{e.message}"
      end

      synced += 1
      if synced % 10 == 0
        puts "Progress: #{synced}/#{remaining} | New PDFs: #{pdf_count} | SharePoint: #{sharepoint_count} | Errors: #{errors.count}"
      end

      # Xero has strict rate limits for PDF/attachment endpoints
      # Use 10s delay to stay safely under limit
      sleep(10) unless result&.dig(:skipped)
    end

    puts ""
    puts ""
    puts "=" * 60
    puts "PDF Sync Complete!"
    puts "=" * 60
    puts "  Invoices processed: #{synced}"
    puts "  New PDFs synced:    #{pdf_count}"
    puts "  Already had PDF:    #{skipped_count}"
    puts "  SharePoint uploads: #{sharepoint_count}"
    puts "  Errors: #{errors.count}"
    if errors.any?
      puts "\nFirst 10 errors:"
      errors.first(10).each { |e| puts "  - #{e}" }
    end
    puts ""
    puts "Total synced (including previous runs): #{already_synced + pdf_count}"
  end

  desc "Backfill upload: Upload downloaded PDFs that are missing from SharePoint"
  task backfill_sharepoint_uploads: :environment do
    dry_run = ENV["DRY_RUN"] == "true"
    limit = ENV["LIMIT"]&.to_i

    puts "=" * 70
    puts "BACKFILL SHAREPOINT UPLOADS"
    puts "=" * 70
    puts ""
    puts "This uploads Xero documents that were downloaded before SharePoint"
    puts "integration was working."
    puts ""
    puts "Mode: #{dry_run ? 'DRY RUN (no actual uploads)' : 'LIVE'}"
    puts "Limit: #{limit || 'None (all documents)'}"
    puts ""

    # Show current status first
    total_xero_docs = CorporateCompanyDocument.where(source: "xero").count
    with_sharepoint = CorporateCompanyDocument.where(source: "xero").where.not(sharepoint_file_id: nil).count
    without_sharepoint = CorporateCompanyDocument.where(source: "xero").where(sharepoint_file_id: nil).count

    # Count how many have attached files (need to check in Ruby)
    docs_needing_upload = CorporateCompanyDocument
      .where(source: "xero")
      .where(sharepoint_file_id: nil)
      .select { |d| d.file.attached? }
      .count

    puts "Current Status:"
    puts "  Total Xero documents:     #{total_xero_docs}"
    puts "  Already on SharePoint:    #{with_sharepoint}"
    puts "  Missing from SharePoint:  #{without_sharepoint}"
    puts "  With attached files:      #{docs_needing_upload} (uploadable)"
    puts ""

    if docs_needing_upload == 0
      puts "✓ All documents already uploaded to SharePoint!"
      exit 0
    end

    puts "Starting backfill job..."
    puts ""

    stats = XeroSharepointUploadBackfillJob.perform_now(limit: limit, dry_run: dry_run)

    puts ""
    puts "=" * 70
    puts "BACKFILL COMPLETE"
    puts "=" * 70
    puts "  Total processed:     #{stats[:total_processed]}"
    puts "  Uploaded:            #{stats[:uploaded]}"
    puts "  Skipped (no file):   #{stats[:skipped_no_file]}"
    puts "  Skipped (no contact):#{stats[:skipped_no_contact]}"
    puts "  Errors:              #{stats[:errors]}"
    puts ""

    if stats[:error_details]&.any?
      puts "First 10 errors:"
      stats[:error_details].first(10).each { |e| puts "  - #{e}" }
    end

    # Show updated status
    updated_with_sharepoint = CorporateCompanyDocument.where(source: "xero").where.not(sharepoint_file_id: nil).count
    puts ""
    puts "Updated Status:"
    puts "  Now on SharePoint: #{updated_with_sharepoint} (+#{updated_with_sharepoint - with_sharepoint})"
  end
end

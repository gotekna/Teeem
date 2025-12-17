namespace :xero do
  desc "Fix XeroSyncStatus timestamps to match actual data"
  task fix_sync_status: :environment do
    # Update invoices sync status
    last_invoice = ExternalInvoice.maximum(:last_synced_at) || ExternalInvoice.maximum(:updated_at)
    if last_invoice
      sync = XeroSyncStatus.find_or_initialize_by(sync_type: "invoices")
      sync.update!(status: "success", last_synced_at: last_invoice, next_sync_at: 5.minutes.from_now)
      puts "Updated invoices: #{sync.last_synced_at}"
    end

    # Update pdfs sync status
    last_pdf = CorporateCompanyDocument.where(source: "xero", documentable_type: "ExternalInvoice").maximum(:created_at)
    if last_pdf
      sync = XeroSyncStatus.find_or_initialize_by(sync_type: "pdfs")
      sync.update!(status: "success", last_synced_at: last_pdf, next_sync_at: 5.minutes.from_now)
      puts "Updated pdfs: #{sync.last_synced_at}"
    end

    # Update sharepoint sync status
    last_sharepoint = CorporateCompanyDocument.where(source: "xero", documentable_type: "ExternalInvoice").where.not(sharepoint_file_id: nil).maximum(:updated_at)
    if last_sharepoint
      sync = XeroSyncStatus.find_or_initialize_by(sync_type: "sharepoint")
      sync.update!(status: "success", last_synced_at: last_sharepoint, next_sync_at: 5.minutes.from_now)
      puts "Updated sharepoint: #{sync.last_synced_at}"
    end

    puts "Done"
  end
end

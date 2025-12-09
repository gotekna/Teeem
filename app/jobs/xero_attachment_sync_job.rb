# Job to sync attachments from Xero invoices/bills to CorporateCompanyDocuments
# Can run for a single invoice or batch process all invoices missing attachments
class XeroAttachmentSyncJob < ApplicationJob
  queue_as :low

  # Sync attachments for a single invoice
  # @param external_invoice_id [Integer] - The ExternalInvoice ID
  def perform(external_invoice_id = nil, **options)
    if external_invoice_id.present?
      sync_single_invoice(external_invoice_id)
    else
      sync_batch_with_ssot(options)
    end
  end

  private

  def sync_single_invoice(external_invoice_id)
    invoice = ExternalInvoice.find_by(id: external_invoice_id)

    unless invoice
      Rails.logger.warn("[XeroAttachmentSyncJob] Invoice #{external_invoice_id} not found")
      return { success: false, error: "Invoice not found" }
    end

    service = XeroAttachmentSyncService.new(invoice)
    result = service.sync!

    if result[:errors].any?
      Rails.logger.warn("[XeroAttachmentSyncJob] Invoice #{external_invoice_id} had errors: #{result[:errors].join(', ')}")
    end

    result
  end

  def sync_batch_with_ssot(options)
    # Mark sync as in progress
    XeroSyncStatus.start_sync!("pdfs")

    begin
      results = sync_batch(options)

      # Update SSoT with success
      XeroSyncStatus.complete_sync!(
        "pdfs",
        records_synced: results[:success],
        next_sync_at: 2.hours.from_now
      )

      results
    rescue StandardError => e
      Rails.logger.error("[XeroAttachmentSyncJob] Batch failed: #{e.message}")
      XeroSyncStatus.fail_sync!("pdfs", error: e.message)
      raise
    end
  end

  def sync_batch(options)
    limit = options[:limit] || 50
    tenant_id = options[:tenant_id]
    invoice_type = options[:invoice_type] # 'sales_invoice', 'bill', etc.

    # Find invoices that DON'T already have PDF synced
    # More efficient than checking for ANY documents - specifically looks for PDFs
    already_synced_ids = CorporateCompanyDocument
      .where(source: "xero")
      .where("external_id LIKE ?", "xero:%:pdf")
      .where(documentable_type: "ExternalInvoice")
      .pluck(:documentable_id)

    query = ExternalInvoice
      .where.not(external_id: nil)
      .where.not(tenant_id: nil)
      .where.not(contact_id: nil) # Only invoices linked to contacts
      .where.not(id: already_synced_ids) # Skip already synced
      .limit(limit)

    query = query.where(tenant_id: tenant_id) if tenant_id.present?
    query = query.where(invoice_type: invoice_type) if invoice_type.present?

    remaining_count = query.except(:limit).count
    Rails.logger.info("[XeroAttachmentSyncJob] Found #{remaining_count} invoices needing PDFs (processing #{limit})")

    results = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: []
    }

    query.find_each do |invoice|
      results[:processed] += 1

      begin
        service = XeroAttachmentSyncService.new(invoice)
        result = service.sync!

        if result[:errors].empty?
          results[:success] += 1
        else
          results[:failed] += 1
          results[:errors] << { invoice_id: invoice.id, errors: result[:errors] }
        end
      rescue StandardError => e
        results[:failed] += 1
        results[:errors] << { invoice_id: invoice.id, errors: [ e.message ] }
        Rails.logger.error("[XeroAttachmentSyncJob] Error processing invoice #{invoice.id}: #{e.message}")
      end

      # Rate limiting - Xero PDF endpoints have strict limits
      # 10s delay to stay safely under limit
      sleep(10)
    end

    Rails.logger.info("[XeroAttachmentSyncJob] Batch complete: #{results.slice(:processed, :success, :failed)}")
    results
  end
end

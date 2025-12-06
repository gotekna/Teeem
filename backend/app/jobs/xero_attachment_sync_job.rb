# Job to sync attachments from Xero invoices/bills to CompanyDocuments
# Can run for a single invoice or batch process all invoices missing attachments
class XeroAttachmentSyncJob < ApplicationJob
  queue_as :low

  # Sync attachments for a single invoice
  # @param external_invoice_id [Integer] - The ExternalInvoice ID
  def perform(external_invoice_id = nil, **options)
    if external_invoice_id.present?
      sync_single_invoice(external_invoice_id)
    else
      sync_batch(options)
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

  def sync_batch(options)
    limit = options[:limit] || 50
    tenant_id = options[:tenant_id]
    invoice_type = options[:invoice_type] # 'sales_invoice', 'bill', etc.

    # Find invoices that have an external_id but no documents linked
    query = ExternalInvoice
      .where.not(external_id: nil)
      .where.not(tenant_id: nil)
      .left_joins(:company_documents)
      .where(company_documents: { id: nil }) # No documents yet
      .limit(limit)

    query = query.where(tenant_id: tenant_id) if tenant_id.present?
    query = query.where(invoice_type: invoice_type) if invoice_type.present?

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

      # Rate limiting - don't overwhelm Xero API
      sleep(0.5) if results[:processed] % 5 == 0
    end

    Rails.logger.info("[XeroAttachmentSyncJob] Batch complete: #{results.slice(:processed, :success, :failed)}")
    results
  end
end

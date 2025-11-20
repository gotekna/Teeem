class PaymentStatusSyncJob < ApplicationJob
  queue_as :default

  # Run this job periodically (e.g., every hour) to check payment status of synced invoices
  def perform(invoice_id = nil)
    if invoice_id
      # Sync specific invoice
      sync_invoice(invoice_id)
    else
      # Sync all synced but unpaid invoices
      sync_all_pending_invoices
    end
  end

  private

  def sync_invoice(invoice_id)
    invoice = SubcontractorInvoice.find(invoice_id)

    return unless invoice.synced? && invoice.external_invoice_id.present?

    result = AccountingSyncService.fetch_payment_status(invoice)

    if result[:success]
      Rails.logger.info("Payment status synced for invoice ##{invoice_id}: #{result[:status]}")
    else
      Rails.logger.error("Failed to sync payment status for invoice ##{invoice_id}: #{result[:error]}")
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error("Invoice ##{invoice_id} not found: #{e.message}")
  rescue => e
    Rails.logger.error("Error syncing invoice ##{invoice_id}: #{e.message}")
  end

  def sync_all_pending_invoices
    # Find all synced invoices that haven't been paid
    invoices = SubcontractorInvoice.where(status: 'synced')
                                  .where.not(external_invoice_id: nil)
                                  .includes(:accounting_integration)

    Rails.logger.info("Starting payment status sync for #{invoices.count} invoices")

    synced_count = 0
    paid_count = 0
    error_count = 0

    invoices.each do |invoice|
      begin
        result = AccountingSyncService.fetch_payment_status(invoice)

        if result[:success]
          synced_count += 1
          paid_count += 1 if result[:paid]
        else
          error_count += 1
        end

        # Small delay to avoid rate limiting
        sleep(0.5) if invoices.count > 10
      rescue => e
        error_count += 1
        Rails.logger.error("Error syncing invoice ##{invoice.id}: #{e.message}")
      end
    end

    Rails.logger.info(
      "Payment status sync completed: " \
      "#{synced_count} synced, #{paid_count} paid, #{error_count} errors"
    )

    # Send summary notification if there are newly paid invoices
    send_payment_summary_notification(paid_count) if paid_count > 0
  end

  def send_payment_summary_notification(paid_count)
    # TODO: Send notification to admin/accounting team about newly paid invoices
    Rails.logger.info("#{paid_count} invoices marked as paid")
  end
end

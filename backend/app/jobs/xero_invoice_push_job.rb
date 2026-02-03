# frozen_string_literal: true

# XeroInvoicePushJob - Push invoices from TEEEM to Xero
#
# This job handles the TEEEM → Xero direction of two-way invoice sync.
# It can be triggered by:
# - Manual user action (clicking "Push to Xero" button)
# - Webhook from TEEEM when invoice is created/updated
# - Scheduled sync for invoices with pending_push flag
#
# Conflict Detection:
# - Checks xero_updated_at vs local_updated_at before pushing
# - If both modified since last sync, creates conflict alert and skips
#
# Usage:
#   XeroInvoicePushJob.perform_later(invoice_id: 123)
#   XeroInvoicePushJob.perform_later(invoice_id: 123, force: true)  # Skip conflict check
#   XeroInvoicePushJob.perform_later(batch: true)  # Push all pending invoices
#
class XeroInvoicePushJob < ApplicationJob
  include XeroJobBase

  queue_as :xero_sync

  def perform(options = {})
    if options[:batch]
      push_all_pending(options)
    elsif options[:invoice_id]
      push_single_invoice(options[:invoice_id], force: options[:force])
    else
      Rails.logger.warn("[XeroInvoicePushJob] No invoice_id or batch option provided")
    end
  end

  private

  # Push a single invoice to Xero
  def push_single_invoice(invoice_id, force: false)
    invoice = ExternalInvoice.find_by(id: invoice_id)

    unless invoice
      Rails.logger.warn("[XeroInvoicePushJob] Invoice #{invoice_id} not found")
      return
    end

    # Get the credential for this invoice's tenant
    credential = XeroCredential.find_by(tenant_id: invoice.tenant_id)

    unless credential
      Rails.logger.warn("[XeroInvoicePushJob] No credential found for tenant #{invoice.tenant_id}")
      return
    end

    with_xero_credential(credential_id: credential.id, sync_type: "invoices", trigger: "manual") do |cred|
      # Check for conflicts unless forced
      unless force
        if conflict_detected?(invoice)
          handle_conflict(invoice)
          increment_records_skipped
          return
        end
      end

      # Push to Xero
      service = ExternalInvoiceSyncService.new
      service.send(:push_invoice_to_xero, invoice)

      # Update two-way sync tracking
      invoice.update!(
        synced_to_xero_at: Time.current,
        local_updated_at: invoice.updated_at,
        sync_conflict: false
      )

      increment_records_processed
      increment_records_updated

      Rails.logger.info("[XeroInvoicePushJob] Successfully pushed invoice #{invoice.invoice_number} to Xero")
    end
  rescue StandardError => e
    Rails.logger.error("[XeroInvoicePushJob] Failed to push invoice #{invoice_id}: #{e.message}")

    # Mark the invoice with sync error
    invoice&.update(sync_error: e.message.truncate(500))

    raise
  end

  # Push all invoices with pending_push flag
  def push_all_pending(options)
    tenant_id = options[:tenant_id]

    scope = ExternalInvoice.where(pending_push: true)
    scope = scope.where(tenant_id: tenant_id) if tenant_id.present?

    count = scope.count
    Rails.logger.info("[XeroInvoicePushJob] Found #{count} pending invoices to push")

    return if count.zero?

    # Get credential
    credential = tenant_id ? XeroCredential.find_by(tenant_id: tenant_id) : XeroCredential.current

    unless credential
      Rails.logger.warn("[XeroInvoicePushJob] No credential found for batch push")
      return
    end

    with_xero_credential(credential_id: credential.id, sync_type: "invoices", trigger: "scheduled") do |cred|
      service = ExternalInvoiceSyncService.new

      scope.find_each do |invoice|
        # Skip if conflict detected
        if conflict_detected?(invoice)
          handle_conflict(invoice)
          increment_records_skipped
          next
        end

        begin
          service.send(:push_invoice_to_xero, invoice)

          invoice.update!(
            synced_to_xero_at: Time.current,
            local_updated_at: invoice.updated_at,
            sync_conflict: false
          )

          increment_records_processed
          increment_records_updated

          # Rate limiting - small delay between pushes
          sleep(0.5)
        rescue StandardError => e
          Rails.logger.error("[XeroInvoicePushJob] Failed to push invoice #{invoice.id}: #{e.message}")
          invoice.update(sync_error: e.message.truncate(500))
          # Continue with next invoice
        end
      end
    end
  end

  # Detect if there's a conflict (both sides modified since last sync)
  def conflict_detected?(invoice)
    return false if invoice.synced_to_xero_at.nil? # Never synced, no conflict possible
    return false if invoice.xero_updated_at.nil?   # Never pulled from Xero

    # Check if Xero version was updated after our last push
    xero_modified_after_push = invoice.xero_updated_at > invoice.synced_to_xero_at

    # Check if local version was updated after our last push
    local_modified_after_push = invoice.local_updated_at.nil? ||
                                 invoice.updated_at > invoice.local_updated_at

    # Conflict if BOTH sides were modified
    xero_modified_after_push && local_modified_after_push
  end

  # Handle a conflict by creating an alert and marking the invoice
  def handle_conflict(invoice)
    Rails.logger.warn("[XeroInvoicePushJob] Conflict detected for invoice #{invoice.invoice_number}")

    # Mark the invoice as having a conflict
    invoice.update!(sync_conflict: true)

    # Create an alert for the user
    credential = XeroCredential.find_by(tenant_id: invoice.tenant_id)

    XeroAlert.create!(
      xero_credential: credential,
      corporate: find_company_for_invoice(invoice),
      alert_type: "sync_stale",
      severity: "warning",
      title: "Invoice sync conflict",
      message: "Invoice #{invoice.invoice_number} was modified in both TEEEM and Xero. " \
               "Please review and choose which version to keep."
    )
  end

  def find_company_for_invoice(invoice)
    # Try to find company via contact
    return invoice.contact&.corporate if invoice.contact.present?

    # Try to find company via job
    return invoice.job&.corporate if invoice.respond_to?(:job) && invoice.job.present?

    nil
  end
end

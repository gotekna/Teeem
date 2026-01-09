# frozen_string_literal: true

# Extracts invoice data using AI/OCR
# Triggered automatically after bill is created from email
#
class InvoiceExtractionJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  def perform(bill_inbox_id)
    bill = BillInbox.find(bill_inbox_id)

    Rails.logger.info "[InvoiceExtractionJob] Processing BillInbox ##{bill_inbox_id}"

    # Run AI extraction
    bill.extract_invoice_data!

    # Auto-match after extraction
    BillMatchingJob.perform_later(bill_inbox_id)
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn "[InvoiceExtractionJob] BillInbox ##{bill_inbox_id} not found"
  rescue StandardError => e
    Rails.logger.error "[InvoiceExtractionJob] Failed for BillInbox ##{bill_inbox_id}: #{e.message}"
    raise
  end
end

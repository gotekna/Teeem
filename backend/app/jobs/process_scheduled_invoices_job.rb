# frozen_string_literal: true

# Processes all scheduled invoices that are due to be sent
# Runs every 15 minutes to check for invoices scheduled for delivery
class ProcessScheduledInvoicesJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info("[ProcessScheduledInvoicesJob] Starting scheduled invoice processing")

    processed = 0
    failed = 0

    Gl::ScheduledInvoice.due_now.find_each do |scheduled|
      begin
        scheduled.send_invoice!
        if scheduled.reload.status == "sent"
          processed += 1
          Rails.logger.info("[ProcessScheduledInvoicesJob] Sent invoice #{scheduled.invoice_id} (scheduled #{scheduled.id})")
        else
          failed += 1
          Rails.logger.warn("[ProcessScheduledInvoicesJob] Failed to send invoice #{scheduled.invoice_id}: #{scheduled.error_message}")
        end
      rescue StandardError => e
        failed += 1
        Rails.logger.error("[ProcessScheduledInvoicesJob] Error processing scheduled #{scheduled.id}: #{e.message}")
      end
    end

    Rails.logger.info("[ProcessScheduledInvoicesJob] Complete: processed=#{processed}, failed=#{failed}")
  end
end

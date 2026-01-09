class RecurringInvoiceGenerationJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "[RecurringInvoiceGeneration] Starting daily recurring invoice generation..."

    due_invoices = Gl::RecurringInvoice.due_for_generation.includes(:contact, :job)
    total = due_invoices.count
    generated = 0
    failed = 0
    errors = []

    Rails.logger.info "[RecurringInvoiceGeneration] Found #{total} recurring invoices due for generation"

    due_invoices.find_each do |recurring|
      begin
        invoice = recurring.generate_invoice!
        if invoice
          generated += 1
          Rails.logger.info "[RecurringInvoiceGeneration] Generated invoice ##{invoice.invoice_number} from recurring '#{recurring.name}' (ID: #{recurring.id})"
        end
      rescue => e
        failed += 1
        error_msg = "Failed to generate from recurring ID #{recurring.id} (#{recurring.name}): #{e.message}"
        errors << error_msg
        Rails.logger.error "[RecurringInvoiceGeneration] #{error_msg}"
        Rails.logger.error e.backtrace.first(5).join("\n")

        # Don't stop processing other invoices
        next
      end
    end

    summary = {
      total_due: total,
      generated: generated,
      failed: failed,
      errors: errors
    }

    Rails.logger.info "[RecurringInvoiceGeneration] Completed: #{generated}/#{total} generated, #{failed} failed"

    # Return summary for monitoring
    summary
  end
end

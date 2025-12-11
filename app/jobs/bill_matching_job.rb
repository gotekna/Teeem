# frozen_string_literal: true

# Matches bills to POs after extraction
#
class BillMatchingJob < ApplicationJob
  queue_as :default

  def perform(bill_inbox_id)
    bill = BillInbox.find(bill_inbox_id)

    Rails.logger.info "[BillMatchingJob] Processing BillInbox ##{bill_inbox_id}"

    # Run PO matching
    bill.match_to_po!

    # Start approval workflow if matched
    if bill.match_status.in?(%w[matched no_po_required variance])
      bill.start_approval_workflow!
    end
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn "[BillMatchingJob] BillInbox ##{bill_inbox_id} not found"
  rescue StandardError => e
    Rails.logger.error "[BillMatchingJob] Failed for BillInbox ##{bill_inbox_id}: #{e.message}"
    raise
  end
end

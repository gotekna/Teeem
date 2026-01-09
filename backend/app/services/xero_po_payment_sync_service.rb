# frozen_string_literal: true

# Service to sync payment data FROM Xero TO existing PurchaseOrders
# Updates xero_amount_paid, xero_paid_date, xero_complete, etc.
class XeroPoPaymentSyncService
  attr_reader :stats

  def initialize
    @client = XeroApiClient.new
    @stats = {
      updated: 0,
      skipped: 0,
      errors: []
    }
  end

  # Sync payment data for all POs with Xero invoice IDs
  def sync_all(limit: nil)
    Rails.logger.info("Starting Xero PO payment sync")

    pos = PurchaseOrder.where.not(xero_invoice_id: nil)
    pos = pos.limit(limit) if limit.present?

    Rails.logger.info("Found #{pos.count} POs with Xero invoice IDs")

    pos.find_each do |po|
      sync_po(po)
      sleep(1.1) # Rate limit: ~60 calls/min
    rescue StandardError => e
      error_msg = "Error syncing PO #{po.id}: #{e.message}"
      Rails.logger.error(error_msg)
      @stats[:errors] << error_msg
    end

    Rails.logger.info("Xero PO payment sync completed: #{@stats.inspect}")
    { success: true, stats: @stats }

  rescue XeroApiClient::AuthenticationError => e
    error_msg = "Authentication error: #{e.message}"
    Rails.logger.error("Xero PO sync failed: #{error_msg}")
    { success: false, error: error_msg, stats: @stats }
  rescue StandardError => e
    error_msg = "Sync failed: #{e.message}"
    Rails.logger.error("Xero PO sync failed: #{error_msg}")
    { success: false, error: error_msg, stats: @stats }
  end

  # Sync a single PO
  def sync_po(po)
    return unless po.xero_invoice_id.present?

    # Fetch invoice from Xero
    result = @client.get("Invoices/#{po.xero_invoice_id}")

    unless result[:success]
      @stats[:errors] << "Failed to fetch invoice for PO #{po.id}: #{result[:error]}"
      return
    end

    invoice = result[:data]["Invoices"]&.first
    unless invoice
      @stats[:skipped] += 1
      return
    end

    # Extract payment data
    amount_paid = invoice["AmountPaid"]&.to_f || 0
    amount_due = invoice["AmountDue"]&.to_f || 0
    status = invoice["Status"]
    is_paid = status == "PAID"

    # Parse paid date from payments array if available
    paid_date = nil
    if is_paid && invoice["Payments"].present?
      last_payment = invoice["Payments"].max_by { |p| p["Date"] }
      paid_date = parse_xero_date(last_payment["Date"]) if last_payment
    end

    # Update PO
    po.update!(
      xero_amount_paid: amount_paid,
      xero_paid_date: paid_date,
      xero_complete: is_paid,
      xero_still_to_be_paid: amount_due,
      required_date: po.required_date || parse_xero_date(invoice["DueDate"]),
      xero_invoice_number: invoice["InvoiceNumber"]
    )

    @stats[:updated] += 1
    Rails.logger.debug("Synced PO #{po.id}: paid=#{amount_paid}, complete=#{is_paid}")
  end

  private

  def parse_xero_date(xero_date)
    return nil unless xero_date

    # Xero dates come as "/Date(1680307200000+0000)/"
    match = xero_date.match(/\/Date\((\d+)/)
    return nil unless match

    Time.at(match[1].to_i / 1000).to_date
  end
end

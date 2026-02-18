# frozen_string_literal: true

# Fetches bills from Xero for a job, matches them to existing POs by supplier + amount,
# then writes the PO number back to the Xero bill's Reference field.
#
# This creates a two-way link visible in Xero:
#   Xero bill Reference = "PO-002452"
#
# Also links the PO to the Xero bill locally:
#   PurchaseOrder.xero_invoice_id = Xero InvoiceID
#
# Usage:
#   # Match Xero bills for a specific job
#   XeroBillPoMatcherService.new(job: job).match_and_update!
#
class XeroBillPoMatcherService
  include XeroConstants

  # Amount tolerance: Xero bill total must be within 5% of PO total
  AMOUNT_TOLERANCE = 0.05

  attr_reader :stats

  def initialize(job:)
    @job = job
    @client = XeroApiClient.new
    @stats = { bills_found: 0, matched: 0, updated_xero: 0, already_matched: 0, skipped: 0, errors: [] }
    # Track which POs have been matched (one-to-one constraint)
    @matched_po_ids = Set.new
  end

  def match_and_update!
    Rails.logger.info("[XeroBillPoMatcher] Starting match for job ##{@job.id} (#{@job.job_code})")

    # Pre-exclude POs already linked to a Xero bill
    @matched_po_ids = PurchaseOrder
      .where(job_id: @job.id)
      .where.not(xero_invoice_id: [nil, ""])
      .pluck(:id)
      .to_set

    # Step 1: Fetch bills from Xero for this job
    xero_bills = fetch_xero_bills_for_job
    @stats[:bills_found] = xero_bills.length
    Rails.logger.info("[XeroBillPoMatcher] Found #{xero_bills.length} Xero bills for #{@job.job_code}")

    # Step 2: Load native POs for this job
    native_pos = PurchaseOrder
      .where(job_id: @job.id)
      .where(xero_invoice_id: [nil, ""])
      .includes(:supplier)
      .to_a

    Rails.logger.info("[XeroBillPoMatcher] #{native_pos.length} native POs to match against")

    # Step 3: Match each Xero bill to a PO
    xero_bills.each do |bill|
      match_bill_to_po(bill, native_pos)
    end

    Rails.logger.info("[XeroBillPoMatcher] Complete: #{@stats.except(:errors).inspect}, errors=#{@stats[:errors].length}")
    @stats
  end

  private

  # Fetch all ACCPAY bills from Xero that are tracked to this job
  def fetch_xero_bills_for_job
    # Get tracking option IDs for this job
    tracking_option_ids = XeroJobTrackingLink
      .where(job_id: @job.id)
      .pluck(:tracking_option_id)

    # Also check legacy column
    if @job.xero_tracking_option_id.present?
      tracking_option_ids << @job.xero_tracking_option_id
    end
    tracking_option_ids.uniq!

    if tracking_option_ids.empty?
      Rails.logger.warn("[XeroBillPoMatcher] Job #{@job.job_code} has no Xero tracking options")
      return []
    end

    Rails.logger.info("[XeroBillPoMatcher] Tracking option IDs: #{tracking_option_ids}")

    # Fetch all ACCPAY (bills) from Xero - paginated
    all_bills = fetch_all_xero_bills

    # Filter to bills that have line items tracked to this job
    matching_bills = all_bills.select do |bill|
      bill_tracking_ids = extract_tracking_option_ids(bill)
      (bill_tracking_ids & tracking_option_ids).any?
    end

    # Skip bills that already have a PO reference set
    matching_bills.reject do |bill|
      ref = bill["Reference"].to_s.strip
      if ref.match?(/^PO-\d{6}$/)
        @stats[:already_matched] += 1
        true
      else
        false
      end
    end
  end

  def fetch_all_xero_bills
    all_bills = []
    page = 1

    loop do
      result = with_rate_limit_retry do
        @client.get("Invoices", { where: 'Type=="ACCPAY"', page: page })
      end
      break unless result[:success]

      invoices = result[:data]["Invoices"] || []
      break if invoices.empty?

      all_bills.concat(invoices)
      page += 1
      break if invoices.length < 100

      sleep(XERO_PAGE_SLEEP_SEC)
    end

    Rails.logger.info("[XeroBillPoMatcher] Fetched #{all_bills.length} total Xero bills, fetching details...")

    # Fetch full details for each (need line item tracking info)
    all_bills.map.with_index do |bill, index|
      if (index + 1) % 50 == 0
        Rails.logger.info("[XeroBillPoMatcher] Fetching detail #{index + 1}/#{all_bills.length}...")
      end
      detail = fetch_invoice_detail(bill["InvoiceID"])
      sleep(XERO_DETAIL_FETCH_SLEEP_SEC)
      detail || bill
    end.compact
  end

  def fetch_invoice_detail(invoice_id)
    result = with_rate_limit_retry { @client.get("Invoices/#{invoice_id}") }
    return nil unless result[:success]

    (result[:data]["Invoices"] || []).first
  end

  def extract_tracking_option_ids(bill)
    ids = []
    (bill["LineItems"] || []).each do |line|
      (line["Tracking"] || []).each do |tracking|
        ids << tracking["TrackingOptionID"] if tracking["TrackingOptionID"]
      end
    end
    ids.uniq
  end

  def match_bill_to_po(bill, native_pos)
    invoice_id = bill["InvoiceID"]
    invoice_number = bill["InvoiceNumber"]
    bill_total = (bill["Total"] || 0).to_f
    bill_supplier = bill.dig("Contact", "Name").to_s
    xero_contact_id = bill.dig("Contact", "ContactID")

    if bill_total.zero?
      @stats[:skipped] += 1
      return
    end

    # Find candidates: same supplier + similar amount
    lower = bill_total * (1 - AMOUNT_TOLERANCE)
    upper = bill_total * (1 + AMOUNT_TOLERANCE)

    candidates = native_pos.select do |po|
      next false if @matched_po_ids.include?(po.id)
      next false if po.total.nil? || po.total.zero?
      next false unless po.total.to_f.between?(lower, upper)

      # Match supplier by contact link or name
      supplier_matches?(po, xero_contact_id, bill_supplier)
    end

    if candidates.empty?
      @stats[:skipped] += 1
      Rails.logger.debug("[XeroBillPoMatcher] No match for Xero bill #{invoice_number} ($#{bill_total}, #{bill_supplier})")
      return
    end

    # Pick best match: closest amount
    best = candidates.min_by { |po| (po.total.to_f - bill_total).abs }

    # Update Xero bill Reference field
    success = update_xero_reference(invoice_id, best.purchase_order_number)

    if success
      # Link the PO to this Xero bill locally
      best.update_columns(xero_invoice_id: invoice_id, xero_invoice_number: invoice_number)
      @matched_po_ids.add(best.id)
      @stats[:matched] += 1
      Rails.logger.info("[XeroBillPoMatcher] Matched #{invoice_number} ($#{bill_total}) → #{best.purchase_order_number} ($#{best.total}) [#{bill_supplier}]")
    end
  rescue StandardError => e
    error_msg = "Error matching bill #{invoice_number}: #{e.message}"
    Rails.logger.error("[XeroBillPoMatcher] #{error_msg}")
    @stats[:errors] << error_msg
  end

  def supplier_matches?(po, xero_contact_id, bill_supplier_name)
    return false unless po.supplier_id.present?

    # Try matching via ContactExternalLink (Xero contact → TEEEM contact)
    if xero_contact_id.present?
      link = ContactExternalLink.xero.find_by(external_contact_id: xero_contact_id)
      return true if link&.contact_id == po.supplier_id
    end

    # Fall back to name match
    if bill_supplier_name.present? && po.supplier&.display_name.present?
      po.supplier.display_name.downcase.include?(bill_supplier_name.downcase) ||
        bill_supplier_name.downcase.include?(po.supplier.display_name.downcase)
    else
      false
    end
  end

  def update_xero_reference(xero_invoice_id, po_number)
    result = @client.post("Invoices/#{xero_invoice_id}", {
      "InvoiceID" => xero_invoice_id,
      "Reference" => po_number
    })

    if result[:success]
      @stats[:updated_xero] += 1
      true
    else
      error_msg = "Failed to update Xero bill #{xero_invoice_id}: #{result[:error]}"
      Rails.logger.warn("[XeroBillPoMatcher] #{error_msg}")
      @stats[:errors] << error_msg
      false
    end
  rescue XeroApiClient::RateLimitError => e
    @stats[:errors] << "Rate limited updating #{xero_invoice_id}: #{e.message}"
    false
  rescue XeroApiClient::ApiError => e
    @stats[:errors] << "API error updating #{xero_invoice_id}: #{e.message}"
    false
  end

  def with_rate_limit_retry(max_retries: 3)
    retries = 0
    begin
      yield
    rescue XeroApiClient::RateLimitError => e
      retries += 1
      if retries <= max_retries
        wait_time = e.message.match(/after (\d+) seconds/)&.captures&.first&.to_i || 60
        Rails.logger.warn("[XeroBillPoMatcher] Rate limit hit, waiting #{wait_time}s (retry #{retries}/#{max_retries})")
        sleep(wait_time + 1)
        retry
      else
        raise
      end
    end
  end
end

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

    # Step 1: Load native POs for this job (used for pre-filtering and matching)
    @native_pos = PurchaseOrder
      .where(job_id: @job.id)
      .where(xero_invoice_id: [nil, ""])
      .includes(:supplier)
      .to_a

    Rails.logger.info("[XeroBillPoMatcher] #{@native_pos.length} native POs to match against")

    # Step 2: Fetch bills from Xero for this job (pre-filtered by supplier)
    xero_bills = fetch_xero_bills_for_job
    @stats[:bills_found] = xero_bills.length
    Rails.logger.info("[XeroBillPoMatcher] Found #{xero_bills.length} Xero bills for #{@job.job_code}")

    # Step 3: Match each Xero bill to a PO
    xero_bills.each do |bill|
      match_bill_to_po(bill, @native_pos)
    end

    Rails.logger.info("[XeroBillPoMatcher] Complete: #{@stats.except(:errors).inspect}, errors=#{@stats[:errors].length}")
    @stats
  end

  private

  # Fetch ACCPAY bills from Xero that are tracked to this job.
  #
  # ⚠️ DO NOT SIMPLIFY - Performance-critical optimization (Feb 2026)
  # ════════════════════════════════════════════════════════════════
  # Why: Xero's list endpoint omits line item tracking data. To check which
  # bills belong to a job, we must fetch each bill individually (~1.1s each).
  # With 2600+ total bills and 1200+ matching by supplier alone, the old
  # approach took ~24 minutes at Xero rate limits.
  #
  # Fix: Filter by supplier ContactID in the API call (targeted queries),
  # then pre-filter by amount BEFORE detail fetching. This reduces detail
  # fetches from ~1200 to ~30-50 (the ones actually matchable by amount).
  # ════════════════════════════════════════════════════════════════
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

    # Build supplier Xero contact IDs from native POs
    supplier_contact_ids = @native_pos.filter_map { |po|
      next unless po.supplier_id
      ContactExternalLink.xero.where(contact_id: po.supplier_id).pluck(:external_contact_id)
    }.flatten.uniq

    Rails.logger.info("[XeroBillPoMatcher] Pre-filter: #{supplier_contact_ids.length} Xero contact IDs")

    # Fetch bills per supplier (targeted API calls instead of fetching ALL bills)
    supplier_bills = fetch_bills_by_suppliers(supplier_contact_ids)

    # Pre-filter: skip already-matched bills
    candidates = supplier_bills.reject do |bill|
      ref = bill["Reference"].to_s.strip
      if ref.match?(/^PO-\d{6}$/)
        @stats[:already_matched] += 1
        true
      end
    end

    Rails.logger.info("[XeroBillPoMatcher] #{candidates.length} candidate bills from #{supplier_bills.length} supplier-filtered, fetching details...")

    # Fetch detail only for supplier+amount matched bills (need tracking data)
    detailed_bills = candidates.map.with_index do |bill, index|
      Rails.logger.info("[XeroBillPoMatcher] Fetching detail #{index + 1}/#{candidates.length}...") if candidates.length > 5 && (index + 1) % 10 == 0
      detail = fetch_invoice_detail(bill["InvoiceID"])
      sleep(XERO_DETAIL_FETCH_SLEEP_SEC)
      detail || bill
    end.compact

    # Final filter: only bills tracked to this job
    matched = detailed_bills.select do |bill|
      bill_tracking_ids = extract_tracking_option_ids(bill)
      (bill_tracking_ids & tracking_option_ids).any?
    end

    Rails.logger.info("[XeroBillPoMatcher] #{matched.length} bills confirmed for job #{@job.job_code} (#{detailed_bills.length} checked for tracking)")
    matched
  end

  # Fetch ACCPAY bills filtered by supplier ContactIDs.
  # Uses targeted Xero API queries per supplier instead of fetching ALL bills.
  def fetch_bills_by_suppliers(supplier_contact_ids)
    all_bills = []

    if supplier_contact_ids.empty?
      Rails.logger.warn("[XeroBillPoMatcher] No supplier Xero contact IDs found")
      return []
    end

    supplier_contact_ids.each_with_index do |contact_id, idx|
      page = 1
      loop do
        where_clause = "Type==\"ACCPAY\"&&Contact.ContactID==Guid(\"#{contact_id}\")"
        result = with_rate_limit_retry do
          @client.get("Invoices", { where: where_clause, page: page })
        end
        break unless result[:success]

        invoices = result[:data]["Invoices"] || []
        break if invoices.empty?

        all_bills.concat(invoices)
        page += 1
        break if invoices.length < 100

        sleep(XERO_PAGE_SLEEP_SEC)
      end
    end

    Rails.logger.info("[XeroBillPoMatcher] Fetched #{all_bills.length} bills from #{supplier_contact_ids.length} suppliers")
    all_bills
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

    # Find all POs from this supplier (not yet matched)
    supplier_candidates = native_pos.select do |po|
      next false if @matched_po_ids.include?(po.id)
      supplier_matches?(po, xero_contact_id, bill_supplier)
    end

    if supplier_candidates.empty?
      @stats[:skipped] += 1
      Rails.logger.debug("[XeroBillPoMatcher] No supplier match for Xero bill #{invoice_number} ($#{bill_total}, #{bill_supplier})")
      return
    end

    # Prefer amount match (within tolerance), fall back to supplier-only
    lower = bill_total * (1 - AMOUNT_TOLERANCE)
    upper = bill_total * (1 + AMOUNT_TOLERANCE)
    amount_matches = supplier_candidates.select { |po| po.total&.to_f&.between?(lower, upper) }

    best = if amount_matches.any?
      amount_matches.min_by { |po| (po.total.to_f - bill_total).abs }
    else
      # No amount match - link by supplier, pick closest amount
      supplier_candidates.min_by { |po| ((po.total || 0).to_f - bill_total).abs }
    end

    match_type = amount_matches.any? ? "amount+supplier" : "supplier-only"

    # Update Xero bill Reference field
    success = update_xero_reference(invoice_id, best.purchase_order_number)

    if success
      best.update_columns(xero_invoice_id: invoice_id, xero_invoice_number: invoice_number)
      @matched_po_ids.add(best.id)
      @stats[:matched] += 1
      Rails.logger.info("[XeroBillPoMatcher] Matched #{invoice_number} ($#{bill_total}) → #{best.purchase_order_number} ($#{best.total}) [#{bill_supplier}] (#{match_type})")
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

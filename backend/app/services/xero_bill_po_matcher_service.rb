# frozen_string_literal: true

# Matches Xero-imported POs to native (manually-created) POs by supplier + amount,
# then writes back the PO number to the Xero bill's Reference field.
#
# This creates a two-way link:
#   TEEEM → Xero: PurchaseOrder.xero_invoice_id
#   Xero → TEEEM: Bill.Reference = "PO-002452"
#
# Usage:
#   # Match all unmatched Xero bills across all jobs
#   XeroBillPoMatcherService.new.match_and_update!
#
#   # Match only for a specific job
#   XeroBillPoMatcherService.new(job: job).match_and_update!
#
class XeroBillPoMatcherService
  include XeroConstants

  # Amount tolerance: Xero bill total must be within 5% of native PO total
  AMOUNT_TOLERANCE = 0.05

  attr_reader :stats

  def initialize(job: nil)
    @job = job
    @client = XeroApiClient.new
    @stats = { matched: 0, updated_xero: 0, already_matched: 0, skipped: 0, errors: [] }
    # Track which native POs have already been matched (one-to-one constraint)
    @matched_native_po_ids = Set.new
  end

  def match_and_update!
    Rails.logger.info("[XeroBillPoMatcher] Starting match#{@job ? " for job ##{@job.id}" : " across all jobs"}")

    # Pre-load native POs that are already matched to avoid re-matching
    preload_existing_matches

    xero_pos = xero_imported_pos
    Rails.logger.info("[XeroBillPoMatcher] Found #{xero_pos.count} Xero-imported POs to check")

    xero_pos.find_each do |xero_po|
      match_single(xero_po)
    end

    Rails.logger.info("[XeroBillPoMatcher] Complete: #{@stats.inspect}")
    @stats
  end

  private

  # Find all Xero-imported POs (have xero_invoice_id set)
  def xero_imported_pos
    scope = PurchaseOrder.where.not(xero_invoice_id: [nil, ""])
    scope = scope.where(job_id: @job.id) if @job
    scope.includes(:supplier)
  end

  # Pre-load existing matches so we don't double-match within a single run.
  # Note: Re-running the service on already-matched bills is safe (idempotent) -
  # it will re-write the same PO number to Xero's Reference field.
  def preload_existing_matches
    # No persistent tracking yet - @matched_native_po_ids handles within-run dedup
  end

  def match_single(xero_po)
    # Find matching native PO (no xero_invoice_id = manually created)
    candidates = find_native_candidates(xero_po)

    if candidates.empty?
      @stats[:skipped] += 1
      return
    end

    # Pick best match: closest amount
    best = candidates.min_by { |po| (po.total.to_f - xero_po.total.to_f).abs }

    # Skip if this native PO was already matched to another Xero bill
    if @matched_native_po_ids.include?(best.id)
      @stats[:skipped] += 1
      return
    end

    # Update Xero bill's Reference field
    success = update_xero_reference(xero_po.xero_invoice_id, best.purchase_order_number)

    if success
      @matched_native_po_ids.add(best.id)
      @stats[:matched] += 1
      Rails.logger.info("[XeroBillPoMatcher] Matched Xero bill #{xero_po.xero_invoice_number} → #{best.purchase_order_number} (job ##{xero_po.job_id})")
    end
  rescue StandardError => e
    error_msg = "Error matching Xero PO ##{xero_po.id}: #{e.message}"
    Rails.logger.error("[XeroBillPoMatcher] #{error_msg}")
    @stats[:errors] << error_msg
  end

  def find_native_candidates(xero_po)
    return [] if xero_po.total.nil? || xero_po.total.zero?

    lower = xero_po.total * (1 - AMOUNT_TOLERANCE)
    upper = xero_po.total * (1 + AMOUNT_TOLERANCE)

    # Base scope: same job, no xero_invoice_id (native PO), amount within tolerance
    base = PurchaseOrder
      .where(job_id: xero_po.job_id)
      .where(xero_invoice_id: [nil, ""])
      .where("total BETWEEN ? AND ?", lower, upper)
    # Exclude native POs already matched to other Xero bills this run
    base = base.where.not(id: @matched_native_po_ids.to_a) if @matched_native_po_ids.any?

    # Try matching by supplier_id first (strongest match)
    if xero_po.supplier_id.present?
      by_supplier_id = base.where(supplier_id: xero_po.supplier_id)
      return by_supplier_id.to_a if by_supplier_id.any?
    end

    # Fall back to fuzzy name match via xero_supplier → Contact.display_name
    if xero_po.xero_supplier.present?
      by_name = base
        .joins("INNER JOIN contacts ON contacts.id = purchase_orders.supplier_id")
        .where("contacts.display_name ILIKE ?", "%#{sanitize_like(xero_po.xero_supplier)}%")
      return by_name.to_a if by_name.any?
    end

    []
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

  # Sanitize LIKE pattern special characters
  def sanitize_like(value)
    value.gsub(/[%_\\]/) { |m| "\\#{m}" }
  end
end

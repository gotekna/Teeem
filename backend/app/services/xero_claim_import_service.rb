# frozen_string_literal: true

# Service to import ALL sales invoices (ACCREC) from Xero as JobClaims
# These are invoices sent TO clients for work completed on jobs
class XeroClaimImportService
  TRACKING_CATEGORY_NAME = "Job"
  RATE_LIMIT_SLEEP = 100 # milliseconds between operations

  attr_reader :stats

  def initialize
    @client = XeroApiClient.new
    @tracking_category_id = nil
    @stats = {
      imported: 0,
      skipped: 0,
      no_job: 0,
      errors: []
    }
  end

  # Import all sales invoices from Xero as claims
  def import_all
    Rails.logger.info("Starting Xero claim import (ACCREC invoices)")

    # Get the tracking category ID first
    @tracking_category_id = fetch_tracking_category_id
    unless @tracking_category_id
      return {
        success: false,
        error: "No '#{TRACKING_CATEGORY_NAME}' tracking category found in Xero",
        stats: @stats
      }
    end

    # Fetch all sales invoices
    invoices = fetch_all_sales_invoices
    Rails.logger.info("Found #{invoices.length} sales invoices in Xero")

    invoices.each do |invoice|
      import_invoice(invoice)
      sleep(RATE_LIMIT_SLEEP / 1000.0)
    rescue StandardError => e
      error_msg = "Error importing invoice '#{invoice['InvoiceNumber']}': #{e.message}"
      Rails.logger.error(error_msg)
      @stats[:errors] << error_msg
    end

    Rails.logger.info("Xero claim import completed: #{@stats.inspect}")

    {
      success: true,
      stats: @stats
    }
  rescue XeroApiClient::AuthenticationError => e
    error_msg = "Authentication error: #{e.message}"
    Rails.logger.error("Xero claim import failed: #{error_msg}")
    { success: false, error: error_msg, stats: @stats }
  rescue StandardError => e
    error_msg = "Import failed: #{e.message}"
    Rails.logger.error("Xero claim import failed: #{error_msg}")
    Rails.logger.error(e.backtrace.join("\n"))
    { success: false, error: error_msg, stats: @stats }
  end

  private

  def fetch_tracking_category_id
    result = @client.get("TrackingCategories")
    return nil unless result[:success]

    categories = result[:data]["TrackingCategories"] || []
    job_category = categories.find { |c| c["Name"] == TRACKING_CATEGORY_NAME }
    job_category&.dig("TrackingCategoryID")
  end

  def fetch_all_sales_invoices
    # Fetch all ACCREC (sales invoices/claims) invoices
    # Note: List endpoint doesn't include line item tracking details
    # We'll fetch the list first, then get full details for each
    all_invoices = []
    page = 1

    loop do
      result = with_rate_limit_retry { @client.get("Invoices", { where: 'Type=="ACCREC"', page: page }) }
      break unless result[:success]

      invoices = result[:data]["Invoices"] || []
      break if invoices.empty?

      all_invoices.concat(invoices)
      page += 1

      # Xero returns up to 100 per page
      break if invoices.length < 100

      # Rate limit between pages
      sleep(0.5)
    end

    Rails.logger.info("Found #{all_invoices.length} sales invoices in Xero, fetching full details...")

    # Now fetch each invoice individually to get line item tracking details
    # This is slow but necessary to get tracking data
    all_invoices.map.with_index do |invoice, index|
      Rails.logger.info("Fetching details for invoice #{index + 1}/#{all_invoices.length}...") if (index + 1) % 50 == 0
      detail = fetch_invoice_details(invoice["InvoiceID"])
      # Rate limit between individual fetches - Xero allows ~60 calls/min
      sleep(1.1)
      detail || invoice
    end.compact
  end

  def fetch_invoice_details(invoice_id)
    result = with_rate_limit_retry { @client.get("Invoices/#{invoice_id}") }
    return nil unless result[:success]

    invoices = result[:data]["Invoices"] || []
    invoices.first
  end

  def with_rate_limit_retry(max_retries: 3)
    retries = 0
    begin
      yield
    rescue XeroApiClient::RateLimitError => e
      retries += 1
      if retries <= max_retries
        # Parse retry-after from error message or default to 60 seconds
        wait_time = e.message.match(/after (\d+) seconds/)&.captures&.first&.to_i || 60
        Rails.logger.warn("Rate limit hit, waiting #{wait_time} seconds before retry #{retries}/#{max_retries}")
        sleep(wait_time + 1)
        retry
      else
        raise
      end
    end
  end

  def import_invoice(invoice)
    invoice_id = invoice["InvoiceID"]
    invoice_number = invoice["InvoiceNumber"]

    # Check if claim already exists for this invoice
    existing_claim = JobClaim.find_by(xero_invoice_id: invoice_id)
    if existing_claim
      Rails.logger.debug("Skipping invoice '#{invoice_number}' - already imported as claim ##{existing_claim.id}")
      @stats[:skipped] += 1
      return
    end

    # Find tracking option ID from line items
    tracking_option_id = extract_tracking_option_id(invoice)
    unless tracking_option_id
      Rails.logger.debug("Skipping invoice '#{invoice_number}' - no job tracking category")
      @stats[:no_job] += 1
      return
    end

    # Find the job linked to this tracking option
    job = Job.find_by(xero_tracking_option_id: tracking_option_id)
    unless job
      Rails.logger.debug("Skipping invoice '#{invoice_number}' - tracking option not linked to any job")
      @stats[:no_job] += 1
      return
    end

    # Find contact if available
    contact = find_contact(invoice["Contact"])

    # Calculate total for line items with this tracking option
    job_total = calculate_job_total(invoice, tracking_option_id)

    # Build description from line items
    description = build_description(invoice, tracking_option_id)

    # Create JobClaim - use description as the claim name (user preference)
    # Keep invoice_number for reference but description is the primary name
    claim_name = description.presence || invoice_number || "XERO-#{invoice_id[0..7]}"
    job.job_claims.create!(
      invoice_number: invoice_number,
      description: claim_name.truncate(500),
      amount: job_total,
      amount_paid: invoice["AmountPaid"] || 0,
      status: determine_status(invoice),
      date: parse_xero_date(invoice["Date"]),
      due_date: parse_xero_date(invoice["DueDate"]),
      xero_invoice_id: invoice_id,
      xero_contact_id: invoice.dig("Contact", "ContactID"),
      contact_name: invoice.dig("Contact", "Name"),
      contact_id: contact&.id
    )

    Rails.logger.info("Imported invoice '#{invoice_number}' as claim for job ##{job.id} '#{job.title}'")
    @stats[:imported] += 1
  end

  def extract_tracking_option_id(invoice)
    line_items = invoice["LineItems"] || []

    line_items.each do |line|
      (line["Tracking"] || []).each do |tracking|
        if tracking["TrackingCategoryID"] == @tracking_category_id
          return tracking["TrackingOptionID"]
        end
      end
    end

    nil
  end

  def calculate_job_total(invoice, tracking_option_id)
    line_items = invoice["LineItems"] || []

    # Sum only line items that are tracked to this job
    matching_lines = line_items.select do |line|
      (line["Tracking"] || []).any? do |t|
        t["TrackingOptionID"] == tracking_option_id
      end
    end

    matching_lines.sum { |line| (line["LineAmount"] || 0).to_f }
  end

  def build_description(invoice, tracking_option_id)
    line_items = invoice["LineItems"] || []

    # Get descriptions from matching line items
    matching_lines = line_items.select do |line|
      (line["Tracking"] || []).any? do |t|
        t["TrackingOptionID"] == tracking_option_id
      end
    end

    descriptions = matching_lines.map { |l| l["Description"] }.compact.uniq

    if descriptions.any?
      descriptions.join("; ").truncate(400)
    else
      "Progress claim imported from Xero"
    end
  end

  def determine_status(invoice)
    case invoice["Status"]
    when "PAID"
      "paid"
    when "AUTHORISED"
      "authorised"
    when "SUBMITTED"
      "submitted"
    when "VOIDED"
      "voided"
    else
      "draft"
    end
  end

  def parse_xero_date(xero_date)
    return nil unless xero_date

    # Xero dates come as "/Date(1680307200000+0000)/"
    match = xero_date.match(/\/Date\((\d+)/)
    return nil unless match

    Time.at(match[1].to_i / 1000).to_date
  end

  def find_contact(xero_contact)
    return nil unless xero_contact

    xero_id = xero_contact["ContactID"]
    return nil unless xero_id

    # Get tenant_id from current Xero credential
    tenant_id = XeroCredential.current&.tenant_id

    # Try to find via WarehouseContact first (SSoT for Xero contact linking)
    if tenant_id.present?
      warehouse_contact = WarehouseContact.find_by(xero_id: xero_id, tenant_id: tenant_id)
      return warehouse_contact.contact if warehouse_contact&.contact
    end

    # Fallback: Try to find by Contact.xero_id (legacy, deprecated)
    contact = Contact.find_by(xero_id: xero_id)
    return contact if contact

    # Try to find by name
    contact_name = xero_contact["Name"]
    contact = Contact.find_by("LOWER(display_name) = ?", contact_name.downcase) if contact_name
    contact
  end
end

# frozen_string_literal: true

# Service to import ALL bills from Xero as Purchase Orders
# Matches bills to jobs by their tracking category
class XeroFullBillImportService
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

  # Import all bills from Xero
  def import_all
    Rails.logger.info("Starting Xero full bill import")

    # Get the tracking category ID first
    @tracking_category_id = fetch_tracking_category_id
    unless @tracking_category_id
      return {
        success: false,
        error: "No '#{TRACKING_CATEGORY_NAME}' tracking category found in Xero",
        stats: @stats
      }
    end

    # Fetch all bills
    bills = fetch_all_bills
    Rails.logger.info("Found #{bills.length} bills in Xero")

    bills.each do |bill|
      import_bill(bill)
      sleep(RATE_LIMIT_SLEEP / 1000.0)
    rescue StandardError => e
      error_msg = "Error importing bill '#{bill['InvoiceNumber']}': #{e.message}"
      Rails.logger.error(error_msg)
      @stats[:errors] << error_msg
    end

    Rails.logger.info("Xero bill import completed: #{@stats.inspect}")

    {
      success: true,
      stats: @stats
    }
  rescue XeroApiClient::AuthenticationError => e
    error_msg = "Authentication error: #{e.message}"
    Rails.logger.error("Xero bill import failed: #{error_msg}")
    { success: false, error: error_msg, stats: @stats }
  rescue StandardError => e
    error_msg = "Import failed: #{e.message}"
    Rails.logger.error("Xero bill import failed: #{error_msg}")
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

  def fetch_all_bills
    # Fetch all ACCPAY (bills/expenses) invoices
    # Note: List endpoint doesn't include line item tracking details
    # We'll fetch the list first, then get full details for each
    all_bills = []
    page = 1

    loop do
      result = with_rate_limit_retry { @client.get("Invoices", { where: 'Type=="ACCPAY"', page: page }) }
      break unless result[:success]

      invoices = result[:data]["Invoices"] || []
      break if invoices.empty?

      all_bills.concat(invoices)
      page += 1

      # Xero returns up to 100 per page
      break if invoices.length < 100

      # Rate limit between pages
      sleep(0.5)
    end

    Rails.logger.info("Found #{all_bills.length} bills in Xero, fetching full details...")

    # Now fetch each invoice individually to get line item tracking details
    # This is slow but necessary to get tracking data
    all_bills.map.with_index do |bill, index|
      Rails.logger.info("Fetching details for bill #{index + 1}/#{all_bills.length}...") if (index + 1) % 50 == 0
      detail = fetch_invoice_details(bill["InvoiceID"])
      # Rate limit between individual fetches - Xero allows ~60 calls/min
      sleep(1.1)
      detail || bill
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

  def import_bill(bill)
    invoice_id = bill["InvoiceID"]
    invoice_number = bill["InvoiceNumber"]

    # Check if PO already exists for this bill
    existing_po = PurchaseOrder.find_by(xero_invoice_id: invoice_id)
    if existing_po
      Rails.logger.debug("Skipping bill '#{invoice_number}' - already imported as PO ##{existing_po.id}")
      @stats[:skipped] += 1
      return
    end

    # Find tracking option ID from line items
    tracking_option_id = extract_tracking_option_id(bill)
    unless tracking_option_id
      Rails.logger.debug("Skipping bill '#{invoice_number}' - no job tracking category")
      @stats[:no_job] += 1
      return
    end

    # Find the job linked to this tracking option
    job = Job.find_by(xero_tracking_option_id: tracking_option_id)
    unless job
      Rails.logger.debug("Skipping bill '#{invoice_number}' - tracking option not linked to any job")
      @stats[:no_job] += 1
      return
    end

    # Find or match supplier contact
    supplier = find_or_create_supplier(bill["Contact"])

    # Calculate total for line items with this tracking option
    job_total = calculate_job_total(bill, tracking_option_id)

    # Build description from line items
    description = build_description(bill, tracking_option_id)

    # Create Purchase Order with invoice number as the task/description
    job.purchase_orders.create!(
      supplier_name: bill.dig("Contact", "Name") || "Unknown Supplier",
      supplier_id: supplier&.id,
      description: "#{invoice_number} - #{description}".truncate(500),
      total: job_total,
      status: determine_status(bill),
      xero_invoice_id: invoice_id,
      xero_invoice_number: invoice_number,
      date: parse_xero_date(bill["Date"]),
      due_date: parse_xero_date(bill["DueDate"]),
      xero_amount_paid: bill["AmountPaid"] || 0,
      xero_complete: bill["Status"] == "PAID",
      xero_supplier: bill.dig("Contact", "Name")
    )

    Rails.logger.info("Imported bill '#{invoice_number}' as PO for job ##{job.id} '#{job.title}'")
    @stats[:imported] += 1
  end

  def extract_tracking_option_id(bill)
    line_items = bill["LineItems"] || []

    line_items.each do |line|
      (line["Tracking"] || []).each do |tracking|
        if tracking["TrackingCategoryID"] == @tracking_category_id
          return tracking["TrackingOptionID"]
        end
      end
    end

    nil
  end

  def calculate_job_total(bill, tracking_option_id)
    line_items = bill["LineItems"] || []

    # Sum only line items that are tracked to this job
    matching_lines = line_items.select do |line|
      (line["Tracking"] || []).any? do |t|
        t["TrackingOptionID"] == tracking_option_id
      end
    end

    matching_lines.sum { |line| (line["LineAmount"] || 0).to_f }
  end

  def build_description(bill, tracking_option_id)
    line_items = bill["LineItems"] || []

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
      "Imported from Xero"
    end
  end

  def determine_status(bill)
    case bill["Status"]
    when "PAID"
      "paid"
    when "AUTHORISED"
      "approved"
    when "SUBMITTED"
      "pending"
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

  def find_or_create_supplier(xero_contact)
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
    return contact if contact

    # No match found - could create here but let's just return nil
    # Contact sync should be run separately
    nil
  end
end

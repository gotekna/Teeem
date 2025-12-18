# frozen_string_literal: true

# Service to import bills from Xero as Purchase Orders for a job
# Matches bills by Xero Tracking Category (Job)
class XeroBillImportService
  TRACKING_CATEGORY_NAME = "Job"

  class Error < StandardError; end
  class NotConnectedError < Error; end
  class NoTrackingOptionError < Error; end

  def initialize(job)
    @job = job
    @client = XeroApiClient.new
    @imported_count = 0
    @skipped_count = 0
    @errors = []
  end

  # Import all bills from Xero that match the job's tracking option
  # Returns hash with results
  def import_bills
    validate_setup!

    bills = fetch_bills_for_job

    bills.each do |bill|
      import_bill(bill)
    rescue StandardError => e
      @errors << { invoice_number: bill["InvoiceNumber"], error: e.message }
    end

    {
      success: true,
      imported: @imported_count,
      skipped: @skipped_count,
      errors: @errors,
      job_id: @job.id,
      tracking_option: @job.xero_tracking_option_name
    }
  end

  # Fetch all tracking categories and their options from Xero
  # Returns empty array if Xero is not configured (graceful degradation for local dev)
  def self.fetch_tracking_options
    client = XeroApiClient.new
    result = client.get("TrackingCategories")

    return [] unless result[:success]

    categories = result[:data]["TrackingCategories"] || []
    job_category = categories.find { |c| c["Name"] == TRACKING_CATEGORY_NAME }

    return [] unless job_category

    job_category["Options"]&.select { |o| o["Status"] == "ACTIVE" } || []
  rescue XeroApiClient::AuthenticationError => e
    # Graceful degradation: return empty if Xero not configured (common in local dev)
    Rails.logger.info("[Xero] Not configured: #{e.message}")
    []
  end

  # Match a job to a Xero tracking option by name/address
  def self.match_job_to_tracking_option(job, tracking_options = nil)
    tracking_options ||= fetch_tracking_options

    # Extract searchable parts from job title/location
    job_text = "#{job.title} #{job.location}".downcase

    best_match = nil
    best_score = 0

    tracking_options.each do |option|
      option_name = option["Name"].downcase

      # Calculate match score based on common words
      score = calculate_match_score(job_text, option_name)

      if score > best_score && score >= 2  # Require at least 2 matching words
        best_score = score
        best_match = option
      end
    end

    best_match
  end

  private

  def validate_setup!
    unless XeroCredential.first&.access_token.present?
      raise NotConnectedError, "Xero is not connected"
    end

    unless @job.xero_tracking_option_id.present?
      raise NoTrackingOptionError, "Job '#{@job.title}' is not linked to a Xero tracking option"
    end
  end

  def fetch_bills_for_job
    # Fetch all ACCPAY (bills) invoices from Xero
    result = @client.get("Invoices", { where: 'Type=="ACCPAY"' })

    return [] unless result[:success]

    all_bills = result[:data]["Invoices"] || []

    # Filter to bills that have line items with our job's tracking option
    all_bills.select do |bill|
      bill_has_job_tracking?(bill)
    end
  end

  def bill_has_job_tracking?(bill)
    line_items = bill["LineItems"] || []

    line_items.any? do |line|
      tracking = line["Tracking"] || []
      tracking.any? do |t|
        t["TrackingCategoryID"] == tracking_category_id &&
          t["TrackingOptionID"] == @job.xero_tracking_option_id
      end
    end
  end

  def tracking_category_id
    @tracking_category_id ||= begin
      result = @client.get("TrackingCategories")
      categories = result[:data]["TrackingCategories"] || []
      job_category = categories.find { |c| c["Name"] == TRACKING_CATEGORY_NAME }
      job_category&.dig("TrackingCategoryID")
    end
  end

  def import_bill(bill)
    # Check if PO already exists for this Xero invoice
    existing_po = @job.purchase_orders.find_by(xero_invoice_id: bill["InvoiceID"])

    if existing_po
      @skipped_count += 1
      return
    end

    # Get contact info
    contact = bill["Contact"] || {}
    contact_name = contact["Name"] || "Unknown Supplier"

    # Calculate total from line items that match our job
    job_total = calculate_job_total(bill)

    # Build description from line items
    description = build_description(bill)

    # Create Purchase Order
    @job.purchase_orders.create!(
      supplier_name: contact_name,
      description: description,
      total: job_total,
      status: bill["Status"] == "PAID" ? "paid" : "approved",
      xero_invoice_id: bill["InvoiceID"],
      xero_invoice_number: bill["InvoiceNumber"],
      date: parse_xero_date(bill["Date"]),
      due_date: parse_xero_date(bill["DueDate"])
    )

    @imported_count += 1
  end

  def calculate_job_total(bill)
    line_items = bill["LineItems"] || []

    # Sum only line items that are tracked to this job
    matching_lines = line_items.select do |line|
      tracking = line["Tracking"] || []
      tracking.any? do |t|
        t["TrackingOptionID"] == @job.xero_tracking_option_id
      end
    end

    matching_lines.sum { |line| (line["LineAmount"] || 0).to_f }
  end

  def build_description(bill)
    line_items = bill["LineItems"] || []

    # Get descriptions from matching line items
    matching_lines = line_items.select do |line|
      tracking = line["Tracking"] || []
      tracking.any? do |t|
        t["TrackingOptionID"] == @job.xero_tracking_option_id
      end
    end

    descriptions = matching_lines.map { |l| l["Description"] }.compact.uniq

    if descriptions.any?
      descriptions.join("; ").truncate(500)
    else
      "Imported from Xero: #{bill['InvoiceNumber']}"
    end
  end

  def parse_xero_date(xero_date)
    return nil unless xero_date

    # Xero dates come as "/Date(1680307200000+0000)/"
    match = xero_date.match(/\/Date\((\d+)/)
    return nil unless match

    Time.at(match[1].to_i / 1000).to_date
  end

  def self.calculate_match_score(text1, text2)
    # Extract significant words (3+ chars, not common words)
    common_words = %w[the and for lot street road drive court place avenue close circuit]

    words1 = text1.scan(/\b\w{3,}\b/).map(&:downcase) - common_words
    words2 = text2.scan(/\b\w{3,}\b/).map(&:downcase) - common_words

    # Count matching words
    (words1 & words2).length
  end
end

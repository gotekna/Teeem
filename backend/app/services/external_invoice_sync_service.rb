class ExternalInvoiceSyncService
  attr_reader :stats

  RATE_LIMIT_SLEEP = 1200 # milliseconds between API calls (1.2s)

  def initialize(source: "xero", tenant_id: nil)
    @source = source
    @tenant_id = tenant_id
    @stats = {
      created: 0,
      updated: 0,
      linked_to_jobs: 0,
      linked_to_contacts: 0,
      contacts_auto_created: 0,
      pos_auto_created: 0,
      errors: [],
      pages_fetched: 0,
      total_invoices: 0,
      total_credit_notes: 0,
      total_quotes: 0
    }
    @sync_timestamp = Time.current

    case @source
    when "xero"
      @api_client = XeroApiClient.new
    else
      raise ArgumentError, "Unsupported source: #{@source}"
    end
  end

  # Main sync method - syncs all invoices
  # @param fetch_details [Boolean] - If true, fetches full invoice details including line items
  def sync(fetch_details: false)
    @fetch_details = fetch_details
    if @tenant_id
      sync_tenant(@tenant_id)
    else
      sync_all_tenants
    end
  end

  # Full warehouse sync - fetches complete invoice details including line items
  def sync_full
    sync(fetch_details: true)
  end

  # Sync all connected tenants
  def sync_all_tenants
    Rails.logger.info("Starting multi-tenant #{@source} invoice sync at #{@sync_timestamp}")

    results = []
    SyncConfiguration.where(sync_enabled: true).find_each do |config|
      begin
        Rails.logger.info("Syncing invoices for tenant: #{config.xero_tenant_name} (#{config.xero_tenant_id})")
        result = sync_tenant(config.xero_tenant_id)
        results << result
      rescue StandardError => e
        error_msg = "Failed to sync invoices for tenant #{config.xero_tenant_name}: #{e.message}"
        Rails.logger.error(error_msg)
        @stats[:errors] << error_msg
      end
    end

    {
      success: @stats[:errors].empty?,
      stats: @stats,
      tenant_results: results,
      synced_at: @sync_timestamp
    }
  end

  # Sync invoices for a specific tenant
  def sync_tenant(tenant_id)
    Rails.logger.info("Starting #{@source} invoice sync for tenant #{tenant_id}")

    @tenant_id = tenant_id

    begin
      # Fetch all invoices with pagination
      # If @fetch_details is true, also fetch full details including line items
      all_invoices = fetch_all_invoices(tenant_id, fetch_details: @fetch_details)
      @stats[:total_invoices] = all_invoices.length

      Rails.logger.info("Fetched #{all_invoices.length} invoices from #{@source}#{@fetch_details ? ' (with full details)' : ''}")

      # Process each invoice
      all_invoices.each do |invoice_data|
        process_invoice(invoice_data, tenant_id)
      end

      # Fetch all credit notes
      all_credit_notes = fetch_all_credit_notes(tenant_id)
      @stats[:total_credit_notes] = all_credit_notes.length

      Rails.logger.info("Fetched #{all_credit_notes.length} credit notes from #{@source}")

      # Process each credit note
      all_credit_notes.each do |cn_data|
        process_credit_note(cn_data, tenant_id)
      end

      # Fetch all quotes
      all_quotes = fetch_all_quotes(tenant_id)
      @stats[:total_quotes] = all_quotes.length

      Rails.logger.info("Fetched #{all_quotes.length} quotes from #{@source}")

      # Process each quote
      all_quotes.each do |quote_data|
        process_quote(quote_data, tenant_id)
      end

      Rails.logger.info("Full sync completed: #{@stats.inspect}")

      {
        success: true,
        tenant_id: tenant_id,
        stats: @stats,
        synced_at: @sync_timestamp
      }
    rescue XeroApiClient::AuthenticationError => e
      handle_sync_error("Authentication error", e)
    rescue XeroApiClient::RateLimitError => e
      handle_sync_error("Rate limit exceeded", e)
    rescue StandardError => e
      handle_sync_error("Sync failed", e, include_backtrace: true)
    end
  end

  # Incremental sync - only fetch invoices modified since last sync
  def sync_incremental(since: nil)
    since ||= ExternalInvoice.where(source: @source).maximum(:last_synced_at) || 1.year.ago

    Rails.logger.info("Starting incremental sync since #{since}")

    if @tenant_id
      sync_tenant_incremental(@tenant_id, since)
    else
      sync_all_tenants_incremental(since)
    end
  end

  # Push pending invoices created in TEEEM to Xero
  def push_pending
    pending = ExternalInvoice.pending_push.where(source: @source)
    pending = pending.for_tenant(@tenant_id) if @tenant_id

    Rails.logger.info("Found #{pending.count} invoices pending push to #{@source}")

    results = { pushed: 0, errors: [] }

    pending.find_each do |invoice|
      # Check sync configuration allows export
      config = SyncConfiguration.for_tenant(invoice.tenant_id)
      unless config&.export_enabled?
        Rails.logger.info("Skipping #{invoice.invoice_number} - export disabled for tenant")
        next
      end

      begin
        push_invoice_to_xero(invoice)
        results[:pushed] += 1
      rescue StandardError => e
        error_msg = "Failed to push #{invoice.invoice_number}: #{e.message}"
        Rails.logger.error(error_msg)
        results[:errors] << error_msg
        invoice.record_error!(error_msg)
      end
    end

    results
  end

  # Create a new invoice in TEEEM and mark for sync to Xero
  def create_and_push(attributes, tenant_id:)
    config = SyncConfiguration.for_tenant(tenant_id)
    unless config&.export_enabled?
      raise "Export not enabled for this tenant"
    end

    invoice = ExternalInvoice.new(
      source: @source,
      tenant_id: tenant_id,
      created_in_teeem: true,
      pending_push: true,
      sync_direction: "export_only",
      teeem_updated_at: Time.current,
      **attributes
    )

    invoice.save!
    push_invoice_to_xero(invoice)

    invoice
  end

  private

  # Fetch all invoices - supports two modes:
  # - Summary mode (default): Fast paginated fetch, no line items
  # - Detail mode (fetch_details: true): Fetches full details including line items for each invoice
  def fetch_all_invoices(tenant_id, fetch_details: false)
    all_invoices = []
    page = 1
    max_pages = 100 # Safety limit

    loop do
      Rails.logger.info("Fetching #{@source} invoices page #{page}")

      result = @api_client.get("Invoices", {
        page: page,
        tenant_id: tenant_id
      })

      unless result[:success]
        raise XeroApiClient::ApiError, "Failed to fetch invoices: #{result[:error]}"
      end

      invoices_page = result[:data]["Invoices"] || []
      break if invoices_page.empty?

      all_invoices.concat(invoices_page)
      @stats[:pages_fetched] += 1

      Rails.logger.info("Page #{page}: #{invoices_page.length} invoices (total: #{all_invoices.length})")

      page += 1
      break if page > max_pages

      # Rate limit protection
      sleep(RATE_LIMIT_SLEEP / 1000.0)
    end

    # If we need full details (line items, payments, tracking), fetch each invoice individually
    if fetch_details
      Rails.logger.info("Fetching full details for #{all_invoices.length} invoices...")
      @stats[:details_fetched] = 0

      all_invoices = all_invoices.map do |summary|
        detail = fetch_invoice_detail(summary["InvoiceID"], tenant_id)
        @stats[:details_fetched] += 1 if detail
        Rails.logger.info("Fetched details: #{@stats[:details_fetched]}/#{all_invoices.length}") if @stats[:details_fetched] % 50 == 0
        detail || summary # Fall back to summary if detail fetch fails
      end
    end

    all_invoices
  end

  # Fetch full invoice details including line items, payments, and tracking
  def fetch_invoice_detail(invoice_id, tenant_id)
    result = @api_client.get("Invoices/#{invoice_id}", {
      tenant_id: tenant_id,
      unitdp: 4 # Full decimal precision
    })

    if result[:success]
      result[:data]["Invoices"]&.first
    else
      Rails.logger.warn("Failed to fetch invoice #{invoice_id} details: #{result[:error]}")
      nil
    end
  rescue StandardError => e
    Rails.logger.warn("Error fetching invoice #{invoice_id} details: #{e.message}")
    nil
  ensure
    # Rate limit protection
    sleep(RATE_LIMIT_SLEEP / 1000.0)
  end

  def process_invoice(invoice_data, tenant_id)
    external_id = invoice_data["InvoiceID"]

    # Find or create the external invoice record
    invoice = ExternalInvoice.find_or_initialize_by(
      source: @source,
      tenant_id: tenant_id,
      external_id: external_id
    )

    is_new = invoice.new_record?

    # Map Xero data to our normalized format
    invoice.assign_attributes(
      invoice_number: invoice_data["InvoiceNumber"],
      reference: invoice_data["Reference"],
      invoice_type: ExternalInvoice.normalize_xero_type(invoice_data["Type"]),
      status: ExternalInvoice.normalize_xero_status(invoice_data["Status"]),
      invoice_date: parse_xero_date(invoice_data["DateString"] || invoice_data["Date"]),
      due_date: parse_xero_date(invoice_data["DueDateString"] || invoice_data["DueDate"]),
      fully_paid_date: parse_xero_date(invoice_data["FullyPaidOnDate"]),
      subtotal: invoice_data["SubTotal"],
      total_tax: invoice_data["TotalTax"],
      total: invoice_data["Total"],
      amount_due: invoice_data["AmountDue"],
      amount_paid: invoice_data["AmountPaid"],
      currency_code: invoice_data["CurrencyCode"] || "AUD",
      external_contact_id: invoice_data.dig("Contact", "ContactID"),
      contact_name: invoice_data.dig("Contact", "Name"),
      line_items: invoice_data["LineItems"] || [],
      payments: extract_payments(invoice_data),
      tracking_data: extract_tracking_categories(invoice_data),
      raw_data: invoice_data,
      external_updated_at: parse_xero_date(invoice_data["UpdatedDateUTC"]),
      last_synced_at: @sync_timestamp,
      sync_error: nil
    )

    invoice.save!

    if is_new
      @stats[:created] += 1
    else
      @stats[:updated] += 1
    end

    # Try to link to TEEEM job via tracking category
    if invoice.job_id.nil?
      link_to_job(invoice)
    end

    # Try to link to TEEEM contact
    if invoice.contact_id.nil?
      link_to_contact(invoice)
    end

    # Auto-create purchase order if this is a bill with job but no existing PO
    if invoice.invoice_type == "bill" && invoice.job_id.present? && invoice.contact_id.present?
      auto_create_purchase_order(invoice)
    end

  rescue StandardError => e
    error_msg = "Error processing invoice #{invoice_data['InvoiceNumber']}: #{e.message}"
    Rails.logger.error(error_msg)
    @stats[:errors] << error_msg
  end

  def extract_tracking_categories(invoice_data)
    tracking = []
    line_items = invoice_data["LineItems"] || []

    line_items.each do |line_item|
      item_tracking = line_item["Tracking"] || []
      item_tracking.each do |t|
        # Store unique tracking options
        unless tracking.any? { |existing| existing["Name"] == t["Name"] && existing["Option"] == t["Option"] }
          tracking << {
            "Name" => t["Name"],
            "Option" => t["Option"],
            "TrackingCategoryID" => t["TrackingCategoryID"],
            "TrackingOptionID" => t["TrackingOptionID"]
          }
        end
      end
    end

    tracking
  end

  def extract_payments(invoice_data)
    # Payments might be in the invoice data directly or need separate fetch
    payments = invoice_data["Payments"] || []
    payments.map do |payment|
      {
        "PaymentID" => payment["PaymentID"],
        "Date" => payment["Date"],
        "Amount" => payment["Amount"],
        "Reference" => payment["Reference"],
        "CurrencyRate" => payment["CurrencyRate"]
      }
    end
  end

  def link_to_job(invoice)
    return if invoice.tracking_data.blank?

    # Find job by tracking option name
    invoice.tracking_data.each do |tracking|
      option_name = tracking["Option"]
      next if option_name.blank?

      job = Job.find_by(xero_tracking_option_name: option_name)
      if job
        invoice.update!(job: job)
        @stats[:linked_to_jobs] += 1
        Rails.logger.info("Linked invoice #{invoice.invoice_number} to job #{job.title}")
        break
      end
    end
  end

  def link_to_contact(invoice)
    return if invoice.external_contact_id.blank?

    # First try: Find via ContactExternalLink (newer approach)
    link = ContactExternalLink.find_by(
      source: @source,
      tenant_id: @tenant_id,
      external_contact_id: invoice.external_contact_id
    )

    if link&.contact
      invoice.update!(contact: link.contact)
      @stats[:linked_to_contacts] += 1
      Rails.logger.info("Linked invoice #{invoice.invoice_number} to contact #{link.contact.display_name} via external link")
      return
    end

    # Fallback: Find contact directly by xero_id on Contact model
    contact = Contact.find_by(xero_id: invoice.external_contact_id)
    if contact
      invoice.update!(contact: contact)
      @stats[:linked_to_contacts] += 1
      Rails.logger.info("Linked invoice #{invoice.invoice_number} to contact #{contact.display_name} via xero_id")
      return
    end

    # Auto-create contact if not found (new Xero contact)
    contact = auto_create_contact_from_xero(invoice)
    if contact
      invoice.update!(contact: contact)
      @stats[:linked_to_contacts] += 1
      @stats[:contacts_auto_created] += 1
      Rails.logger.info("Auto-created contact #{contact.display_name} from Xero and linked to invoice #{invoice.invoice_number}")
    end
  end

  # Auto-create a TEEEM contact from Xero contact data embedded in invoice
  def auto_create_contact_from_xero(invoice)
    return nil if invoice.contact_name.blank?

    Rails.logger.info("Auto-creating contact for Xero contact: #{invoice.contact_name}")

    begin
      contact = Contact.new(
        display_name: invoice.contact_name,
        company_name_or_trust: invoice.contact_name,
        entity_type: "company",
        xero_id: invoice.external_contact_id,
        sync_with_xero: true
      )

      if contact.save
        Rails.logger.info("Successfully created contact #{contact.id}: #{contact.display_name}")
        contact
      else
        Rails.logger.warn("Failed to create contact for #{invoice.contact_name}: #{contact.errors.full_messages.join(', ')}")
        nil
      end
    rescue StandardError => e
      Rails.logger.error("Error auto-creating contact for #{invoice.contact_name}: #{e.message}")
      nil
    end
  end

  def auto_create_purchase_order(invoice)
    # Check if PO already exists for this invoice
    existing_po = PurchaseOrder.find_by(xero_invoice_id: invoice.external_id)
    if existing_po
      Rails.logger.debug("PO already exists for invoice #{invoice.invoice_number}: #{existing_po.purchase_order_number}")
      return
    end

    begin
      # Create purchase order (without line items, so skip calculate_totals callback)
      po = PurchaseOrder.new(
        job_id: invoice.job_id,
        supplier_id: invoice.contact_id,
        status: "invoiced", # Bill already exists, so mark as invoiced
        xero_invoice_id: invoice.external_id,
        invoiced_amount: invoice.total,
        invoice_date: invoice.invoice_date,
        invoice_reference: invoice.invoice_number,
        description: "Auto-generated from Xero bill #{invoice.invoice_number}",
        ordered_date: invoice.invoice_date, # Use invoice date as order date
        payment_status: invoice.status == "paid" ? "complete" : "pending"
      )

      # Generate PO number before saving (since we skip validation which would trigger the callback)
      po.send(:generate_po_number)

      # Set totals manually and skip callbacks to preserve values
      po.save!(validate: false)
      po.update_columns(
        total: invoice.total || 0,
        sub_total: invoice.subtotal || 0,
        tax: invoice.total_tax || 0
      )

      Rails.logger.info("Auto-created PO #{po.purchase_order_number} for bill #{invoice.invoice_number} (Job: #{invoice.job&.name}, Supplier: #{invoice.contact&.display_name})")

      # Add to stats if we have a place for it
      @stats[:pos_auto_created] ||= 0
      @stats[:pos_auto_created] += 1

    rescue StandardError => e
      Rails.logger.error("Failed to auto-create PO for invoice #{invoice.invoice_number}: #{e.message}")
      # Don't raise - continue processing other invoices
    end
  end

  def parse_xero_date(date_value)
    return nil if date_value.blank?

    # Handle Xero date formats
    if date_value.is_a?(String)
      if date_value.match?(/\/Date\((\d+)/)
        # Format: /Date(1234567890000+0000)/
        ms = date_value.match(/\/Date\((\d+)/)[1].to_i
        Time.at(ms / 1000).to_date
      else
        # Regular date string
        Date.parse(date_value) rescue nil
      end
    else
      date_value
    end
  end

  def sync_all_tenants_incremental(since)
    results = []
    SyncConfiguration.where(sync_enabled: true).find_each do |config|
      begin
        result = sync_tenant_incremental(config.xero_tenant_id, since)
        results << result
      rescue StandardError => e
        error_msg = "Failed incremental sync for tenant #{config.xero_tenant_name}: #{e.message}"
        Rails.logger.error(error_msg)
        @stats[:errors] << error_msg
      end
    end

    {
      success: @stats[:errors].empty?,
      stats: @stats,
      tenant_results: results,
      synced_at: @sync_timestamp
    }
  end

  def sync_tenant_incremental(tenant_id, since)
    Rails.logger.info("Starting incremental sync for tenant #{tenant_id} since #{since}")

    # Xero supports modifiedAfter parameter
    result = @api_client.get("Invoices", {
      modifiedAfter: since.iso8601,
      tenant_id: tenant_id
    })

    unless result[:success]
      raise XeroApiClient::ApiError, "Failed to fetch invoices: #{result[:error]}"
    end

    invoices = result[:data]["Invoices"] || []
    Rails.logger.info("Found #{invoices.length} modified invoices since #{since}")

    invoices.each do |invoice_data|
      process_invoice(invoice_data, tenant_id)
    end

    {
      success: true,
      tenant_id: tenant_id,
      invoices_synced: invoices.length,
      stats: @stats
    }
  end

  def handle_sync_error(prefix, error, include_backtrace: false)
    error_msg = "#{prefix}: #{error.message}"
    Rails.logger.error("Invoice sync failed: #{error_msg}")
    Rails.logger.error(error.backtrace.join("\n")) if include_backtrace
    @stats[:errors] << error_msg
    { success: false, error: error_msg, stats: @stats }
  end

  # Fetch all credit notes from Xero
  def fetch_all_credit_notes(tenant_id)
    all_credit_notes = []
    page = 1
    max_pages = 50

    loop do
      Rails.logger.info("Fetching #{@source} credit notes page #{page}")

      result = @api_client.get("CreditNotes", {
        page: page,
        tenant_id: tenant_id
      })

      unless result[:success]
        Rails.logger.warn("Failed to fetch credit notes: #{result[:error]}")
        break
      end

      credit_notes_page = result[:data]["CreditNotes"] || []
      break if credit_notes_page.empty?

      all_credit_notes.concat(credit_notes_page)
      @stats[:pages_fetched] += 1

      page += 1
      break if page > max_pages

      sleep(RATE_LIMIT_SLEEP / 1000.0)
    end

    all_credit_notes
  end

  # Process a single credit note
  def process_credit_note(cn_data, tenant_id)
    external_id = cn_data["CreditNoteID"]

    record = ExternalInvoice.find_or_initialize_by(
      source: @source,
      tenant_id: tenant_id,
      external_id: external_id
    )

    is_new = record.new_record?

    record.assign_attributes(
      invoice_number: cn_data["CreditNoteNumber"],
      reference: cn_data["Reference"],
      invoice_type: "credit_note",
      status: ExternalInvoice.normalize_xero_status(cn_data["Status"]),
      invoice_date: parse_xero_date(cn_data["DateString"] || cn_data["Date"]),
      due_date: nil,
      subtotal: cn_data["SubTotal"],
      total_tax: cn_data["TotalTax"],
      total: cn_data["Total"],
      amount_due: cn_data["RemainingCredit"],
      amount_paid: (cn_data["Total"] || 0) - (cn_data["RemainingCredit"] || 0),
      currency_code: cn_data["CurrencyCode"] || "AUD",
      external_contact_id: cn_data.dig("Contact", "ContactID"),
      contact_name: cn_data.dig("Contact", "Name"),
      line_items: cn_data["LineItems"] || [],
      payments: [],
      tracking_data: extract_tracking_categories_from_lines(cn_data["LineItems"]),
      raw_data: cn_data,
      external_updated_at: parse_xero_date(cn_data["UpdatedDateUTC"]),
      last_synced_at: @sync_timestamp,
      sync_error: nil
    )

    record.save!
    is_new ? @stats[:created] += 1 : @stats[:updated] += 1

    link_to_job(record) if record.job_id.nil?
    link_to_contact(record) if record.contact_id.nil?

  rescue StandardError => e
    error_msg = "Error processing credit note #{cn_data['CreditNoteNumber']}: #{e.message}"
    Rails.logger.error(error_msg)
    @stats[:errors] << error_msg
  end

  # Fetch all quotes from Xero
  def fetch_all_quotes(tenant_id)
    all_quotes = []
    page = 1
    max_pages = 50

    loop do
      Rails.logger.info("Fetching #{@source} quotes page #{page}")

      result = @api_client.get("Quotes", {
        page: page,
        tenant_id: tenant_id
      })

      unless result[:success]
        Rails.logger.warn("Failed to fetch quotes: #{result[:error]}")
        break
      end

      quotes_page = result[:data]["Quotes"] || []
      break if quotes_page.empty?

      all_quotes.concat(quotes_page)
      @stats[:pages_fetched] += 1

      page += 1
      break if page > max_pages

      sleep(RATE_LIMIT_SLEEP / 1000.0)
    end

    all_quotes
  end

  # Process a single quote
  def process_quote(quote_data, tenant_id)
    external_id = quote_data["QuoteID"]

    record = ExternalInvoice.find_or_initialize_by(
      source: @source,
      tenant_id: tenant_id,
      external_id: external_id
    )

    is_new = record.new_record?

    record.assign_attributes(
      invoice_number: quote_data["QuoteNumber"],
      reference: quote_data["Reference"] || quote_data["Title"],
      invoice_type: "quote",
      status: ExternalInvoice::XERO_QUOTE_STATUS_MAP[quote_data["Status"]] || "draft",
      invoice_date: parse_xero_date(quote_data["DateString"] || quote_data["Date"]),
      due_date: parse_xero_date(quote_data["ExpiryDateString"] || quote_data["ExpiryDate"]),
      subtotal: quote_data["SubTotal"],
      total_tax: quote_data["TotalTax"],
      total: quote_data["Total"],
      amount_due: quote_data["Total"],
      amount_paid: 0,
      currency_code: quote_data["CurrencyCode"] || "AUD",
      external_contact_id: quote_data.dig("Contact", "ContactID"),
      contact_name: quote_data.dig("Contact", "Name"),
      line_items: quote_data["LineItems"] || [],
      payments: [],
      tracking_data: extract_tracking_categories_from_lines(quote_data["LineItems"]),
      raw_data: quote_data,
      external_updated_at: parse_xero_date(quote_data["UpdatedDateUTC"]),
      last_synced_at: @sync_timestamp,
      sync_error: nil
    )

    record.save!
    is_new ? @stats[:created] += 1 : @stats[:updated] += 1

    link_to_job(record) if record.job_id.nil?
    link_to_contact(record) if record.contact_id.nil?

  rescue StandardError => e
    error_msg = "Error processing quote #{quote_data['QuoteNumber']}: #{e.message}"
    Rails.logger.error(error_msg)
    @stats[:errors] << error_msg
  end

  # Extract tracking categories from line items (reusable helper)
  def extract_tracking_categories_from_lines(line_items)
    tracking = []
    (line_items || []).each do |line_item|
      (line_item["Tracking"] || []).each do |t|
        unless tracking.any? { |existing| existing["Name"] == t["Name"] && existing["Option"] == t["Option"] }
          tracking << {
            "Name" => t["Name"],
            "Option" => t["Option"],
            "TrackingCategoryID" => t["TrackingCategoryID"],
            "TrackingOptionID" => t["TrackingOptionID"]
          }
        end
      end
    end
    tracking
  end

  # Push a single invoice to Xero
  def push_invoice_to_xero(invoice)
    Rails.logger.info("Pushing invoice #{invoice.invoice_number} to Xero")

    # Build Xero invoice payload
    xero_invoice = build_xero_invoice_payload(invoice)

    # Determine if create or update
    if invoice.external_id.present?
      # Update existing invoice
      result = @api_client.put("Invoices/#{invoice.external_id}", {
        tenant_id: invoice.tenant_id,
        body: { Invoices: [ xero_invoice ] }
      })
    else
      # Create new invoice
      result = @api_client.post("Invoices", {
        tenant_id: invoice.tenant_id,
        body: { Invoices: [ xero_invoice ] }
      })
    end

    unless result[:success]
      raise "Xero API error: #{result[:error]}"
    end

    # Update local record with Xero response
    xero_response = result[:data]["Invoices"]&.first
    if xero_response
      invoice.update!(
        external_id: xero_response["InvoiceID"],
        invoice_number: xero_response["InvoiceNumber"],
        status: ExternalInvoice.normalize_xero_status(xero_response["Status"]),
        external_updated_at: parse_xero_date(xero_response["UpdatedDateUTC"]),
        last_synced_at: Time.current,
        pending_push: false,
        sync_error: nil
      )
    end

    Rails.logger.info("Successfully pushed invoice #{invoice.invoice_number} to Xero")
    invoice
  end

  # Build Xero-compatible invoice payload from ExternalInvoice
  def build_xero_invoice_payload(invoice)
    payload = {
      "Type" => invoice.xero_type,
      "Status" => invoice.xero_status,
      "Reference" => invoice.reference,
      "CurrencyCode" => invoice.currency_code || "AUD"
    }

    # Add invoice number if present (for updates)
    payload["InvoiceNumber"] = invoice.invoice_number if invoice.invoice_number.present?

    # Add contact
    if invoice.external_contact_id.present?
      payload["Contact"] = { "ContactID" => invoice.external_contact_id }
    elsif invoice.contact_id.present?
      # Find the Xero contact ID from the TEEEM contact
      xero_link = ContactExternalLink.find_by(
        contact_id: invoice.contact_id,
        source: "xero",
        tenant_id: invoice.tenant_id
      )
      payload["Contact"] = { "ContactID" => xero_link.external_contact_id } if xero_link
    end

    # Add dates
    payload["Date"] = invoice.invoice_date.iso8601 if invoice.invoice_date
    payload["DueDate"] = invoice.due_date.iso8601 if invoice.due_date

    # Add line items
    if invoice.line_items.present?
      payload["LineItems"] = invoice.line_items.map do |item|
        {
          "Description" => item["Description"],
          "Quantity" => item["Quantity"] || 1,
          "UnitAmount" => item["UnitAmount"],
          "AccountCode" => item["AccountCode"],
          "TaxType" => item["TaxType"],
          "Tracking" => item["Tracking"]
        }.compact
      end
    end

    payload
  end
end

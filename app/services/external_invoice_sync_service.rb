class ExternalInvoiceSyncService
  attr_reader :stats

  RATE_LIMIT_SLEEP = 1200 # milliseconds between API calls (1.2s)

  def initialize(source: 'xero', tenant_id: nil)
    @source = source
    @tenant_id = tenant_id
    @stats = {
      created: 0,
      updated: 0,
      linked_to_jobs: 0,
      linked_to_contacts: 0,
      errors: [],
      pages_fetched: 0,
      total_invoices: 0
    }
    @sync_timestamp = Time.current

    case @source
    when 'xero'
      @api_client = XeroApiClient.new
    else
      raise ArgumentError, "Unsupported source: #{@source}"
    end
  end

  # Main sync method - syncs all invoices
  def sync
    if @tenant_id
      sync_tenant(@tenant_id)
    else
      sync_all_tenants
    end
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
      all_invoices = fetch_all_invoices(tenant_id)
      @stats[:total_invoices] = all_invoices.length

      Rails.logger.info("Fetched #{all_invoices.length} invoices from #{@source}")

      # Process each invoice
      all_invoices.each do |invoice_data|
        process_invoice(invoice_data, tenant_id)
      end

      Rails.logger.info("Invoice sync completed: #{@stats.inspect}")

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

  private

  def fetch_all_invoices(tenant_id)
    all_invoices = []
    page = 1
    max_pages = 100 # Safety limit

    loop do
      Rails.logger.info("Fetching #{@source} invoices page #{page}")

      result = @api_client.get('Invoices', {
        page: page,
        tenant_id: tenant_id
      })

      unless result[:success]
        raise XeroApiClient::ApiError, "Failed to fetch invoices: #{result[:error]}"
      end

      invoices_page = result[:data]['Invoices'] || []
      break if invoices_page.empty?

      all_invoices.concat(invoices_page)
      @stats[:pages_fetched] += 1

      Rails.logger.info("Page #{page}: #{invoices_page.length} invoices (total: #{all_invoices.length})")

      page += 1
      break if page > max_pages

      # Rate limit protection
      sleep(RATE_LIMIT_SLEEP / 1000.0)
    end

    all_invoices
  end

  def process_invoice(invoice_data, tenant_id)
    external_id = invoice_data['InvoiceID']

    # Find or create the external invoice record
    invoice = ExternalInvoice.find_or_initialize_by(
      source: @source,
      tenant_id: tenant_id,
      external_id: external_id
    )

    is_new = invoice.new_record?

    # Map Xero data to our normalized format
    invoice.assign_attributes(
      invoice_number: invoice_data['InvoiceNumber'],
      reference: invoice_data['Reference'],
      invoice_type: ExternalInvoice.normalize_xero_type(invoice_data['Type']),
      status: ExternalInvoice.normalize_xero_status(invoice_data['Status']),
      invoice_date: parse_xero_date(invoice_data['DateString'] || invoice_data['Date']),
      due_date: parse_xero_date(invoice_data['DueDateString'] || invoice_data['DueDate']),
      fully_paid_date: parse_xero_date(invoice_data['FullyPaidOnDate']),
      subtotal: invoice_data['SubTotal'],
      total_tax: invoice_data['TotalTax'],
      total: invoice_data['Total'],
      amount_due: invoice_data['AmountDue'],
      amount_paid: invoice_data['AmountPaid'],
      currency_code: invoice_data['CurrencyCode'] || 'AUD',
      external_contact_id: invoice_data.dig('Contact', 'ContactID'),
      contact_name: invoice_data.dig('Contact', 'Name'),
      line_items: invoice_data['LineItems'] || [],
      payments: extract_payments(invoice_data),
      tracking_data: extract_tracking_categories(invoice_data),
      raw_data: invoice_data,
      external_updated_at: parse_xero_date(invoice_data['UpdatedDateUTC']),
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

  rescue StandardError => e
    error_msg = "Error processing invoice #{invoice_data['InvoiceNumber']}: #{e.message}"
    Rails.logger.error(error_msg)
    @stats[:errors] << error_msg
  end

  def extract_tracking_categories(invoice_data)
    tracking = []
    line_items = invoice_data['LineItems'] || []

    line_items.each do |line_item|
      item_tracking = line_item['Tracking'] || []
      item_tracking.each do |t|
        # Store unique tracking options
        unless tracking.any? { |existing| existing['Name'] == t['Name'] && existing['Option'] == t['Option'] }
          tracking << {
            'Name' => t['Name'],
            'Option' => t['Option'],
            'TrackingCategoryID' => t['TrackingCategoryID'],
            'TrackingOptionID' => t['TrackingOptionID']
          }
        end
      end
    end

    tracking
  end

  def extract_payments(invoice_data)
    # Payments might be in the invoice data directly or need separate fetch
    payments = invoice_data['Payments'] || []
    payments.map do |payment|
      {
        'PaymentID' => payment['PaymentID'],
        'Date' => payment['Date'],
        'Amount' => payment['Amount'],
        'Reference' => payment['Reference'],
        'CurrencyRate' => payment['CurrencyRate']
      }
    end
  end

  def link_to_job(invoice)
    return if invoice.tracking_data.blank?

    # Find job by tracking option name
    invoice.tracking_data.each do |tracking|
      option_name = tracking['Option']
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

    # Find contact link
    link = ContactExternalLink.find_by(
      source: @source,
      tenant_id: @tenant_id,
      external_contact_id: invoice.external_contact_id
    )

    if link&.contact
      invoice.update!(contact: link.contact)
      @stats[:linked_to_contacts] += 1
      Rails.logger.info("Linked invoice #{invoice.invoice_number} to contact #{link.contact.display_name}")
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
    result = @api_client.get('Invoices', {
      modifiedAfter: since.iso8601,
      tenant_id: tenant_id
    })

    unless result[:success]
      raise XeroApiClient::ApiError, "Failed to fetch invoices: #{result[:error]}"
    end

    invoices = result[:data]['Invoices'] || []
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
end

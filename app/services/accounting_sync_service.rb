class AccountingSyncService
  # Main service for syncing invoices to accounting systems
  def self.sync_invoice(invoice)
    integration = invoice.accounting_integration

    unless integration&.active?
      return { success: false, error: 'No active accounting integration found' }
    end

    # Refresh token if expired
    if integration.token_expired?
      refresh_result = integration.refresh_token!
      unless refresh_result
        invoice.update(status: 'failed', error_message: 'Failed to refresh access token')
        return { success: false, error: 'Failed to refresh access token' }
      end
    end

    # Get appropriate adapter
    adapter = get_adapter(integration)

    begin
      result = adapter.create_invoice(invoice)

      if result[:success]
        invoice.update(
          status: 'synced',
          external_invoice_id: result[:external_invoice_id],
          synced_at: Time.current,
          error_message: nil
        )

        integration.update(last_sync_at: Time.current)

        { success: true, external_invoice_id: result[:external_invoice_id] }
      else
        invoice.update(
          status: 'failed',
          error_message: result[:error]
        )

        { success: false, error: result[:error] }
      end
    rescue => e
      invoice.update(
        status: 'failed',
        error_message: e.message
      )

      { success: false, error: e.message }
    end
  end

  # Fetch payment status from accounting system
  def self.fetch_payment_status(invoice)
    integration = invoice.accounting_integration

    unless integration&.active?
      return { success: false, error: 'No active accounting integration' }
    end

    unless invoice.external_invoice_id
      return { success: false, error: 'Invoice not synced yet' }
    end

    adapter = get_adapter(integration)

    begin
      result = adapter.get_invoice_status(invoice.external_invoice_id)

      if result[:success]
        # Update payment status
        if result[:paid] && !invoice.paid_at
          invoice.update(
            status: 'paid',
            paid_at: result[:paid_at] || Time.current
          )
        end

        { success: true, status: result[:status], paid: result[:paid] }
      else
        { success: false, error: result[:error] }
      end
    rescue => e
      { success: false, error: e.message }
    end
  end

  # Sync all pending invoices
  def self.sync_all_pending
    pending_invoices = SubcontractorInvoice.where(status: 'pending')
                                          .joins(:accounting_integration)
                                          .where(accounting_integrations: { sync_status: 'active' })

    results = {
      total: pending_invoices.count,
      synced: 0,
      failed: 0,
      errors: []
    }

    pending_invoices.each do |invoice|
      result = sync_invoice(invoice)
      if result[:success]
        results[:synced] += 1
      else
        results[:failed] += 1
        results[:errors] << { invoice_id: invoice.id, error: result[:error] }
      end
    end

    results
  end

  # Check payment status for all synced invoices
  def self.check_all_payment_statuses
    synced_invoices = SubcontractorInvoice.where(status: 'synced')
                                         .where.not(external_invoice_id: nil)

    results = {
      total: synced_invoices.count,
      paid: 0,
      still_pending: 0,
      errors: 0
    }

    synced_invoices.each do |invoice|
      result = fetch_payment_status(invoice)
      if result[:success]
        if result[:paid]
          results[:paid] += 1
        else
          results[:still_pending] += 1
        end
      else
        results[:errors] += 1
      end
    end

    results
  end

  # Get invoice statistics from accounting system
  def self.get_statistics(integration)
    adapter = get_adapter(integration)

    begin
      adapter.get_statistics
    rescue => e
      { success: false, error: e.message }
    end
  end

  private

  def self.get_adapter(integration)
    case integration.system_type
    when 'xero'
      AccountingAdapters::XeroAdapter.new(integration)
    when 'myob'
      AccountingAdapters::MyobAdapter.new(integration)
    when 'quickbooks'
      AccountingAdapters::QuickbooksAdapter.new(integration)
    when 'reckon'
      AccountingAdapters::ReckonAdapter.new(integration)
    else
      raise "Unsupported accounting system: #{integration.system_type}"
    end
  end
end

# Base adapter class
module AccountingAdapters
  class BaseAdapter
    attr_reader :integration

    def initialize(integration)
      @integration = integration
    end

    def create_invoice(invoice)
      raise NotImplementedError, 'Subclass must implement create_invoice'
    end

    def get_invoice_status(external_invoice_id)
      raise NotImplementedError, 'Subclass must implement get_invoice_status'
    end

    def get_statistics
      raise NotImplementedError, 'Subclass must implement get_statistics'
    end

    protected

    def access_token
      integration.oauth_token
    end

    def organization_id
      integration.organization_id
    end

    def http_headers
      {
        'Authorization' => "Bearer #{access_token}",
        'Content-Type' => 'application/json',
        'Accept' => 'application/json'
      }
    end

    def invoice_payload(invoice)
      {
        contact_name: invoice.contact.display_name,
        contact_email: invoice.contact.email,
        invoice_number: "INV-#{invoice.id}",
        amount: invoice.amount,
        date: invoice.created_at.to_date,
        due_date: (invoice.created_at + 30.days).to_date,
        reference: "PO: #{invoice.purchase_order.po_number}",
        description: build_invoice_description(invoice)
      }
    end

    def build_invoice_description(invoice)
      po = invoice.purchase_order
      "Work completed for #{po.construction.job_name}\n" \
      "Purchase Order: #{po.po_number}\n" \
      "Job Address: #{po.construction.street_address}"
    end
  end

  # Xero adapter
  class XeroAdapter < BaseAdapter
    XERO_API_URL = 'https://api.xero.com/api.xro/2.0'.freeze

    def create_invoice(invoice)
      payload = invoice_payload(invoice)

      # TODO: Implement actual Xero API call
      # response = HTTParty.post(
      #   "#{XERO_API_URL}/Invoices",
      #   headers: http_headers.merge('xero-tenant-id' => organization_id),
      #   body: xero_invoice_payload(payload).to_json
      # )

      # Placeholder response
      {
        success: true,
        external_invoice_id: "XERO-INV-#{SecureRandom.hex(8)}",
        message: 'Invoice created successfully (placeholder)'
      }
    rescue => e
      { success: false, error: e.message }
    end

    def get_invoice_status(external_invoice_id)
      # TODO: Implement actual Xero API call
      # response = HTTParty.get(
      #   "#{XERO_API_URL}/Invoices/#{external_invoice_id}",
      #   headers: http_headers.merge('xero-tenant-id' => organization_id)
      # )

      # Placeholder response
      {
        success: true,
        status: 'AUTHORISED',
        paid: false,
        paid_at: nil
      }
    rescue => e
      { success: false, error: e.message }
    end

    def get_statistics
      {
        success: true,
        total_invoices: 0,
        paid_invoices: 0,
        pending_invoices: 0
      }
    end

    private

    def xero_invoice_payload(payload)
      {
        Type: 'ACCREC',
        Contact: {
          Name: payload[:contact_name],
          EmailAddress: payload[:contact_email]
        },
        InvoiceNumber: payload[:invoice_number],
        Date: payload[:date],
        DueDate: payload[:due_date],
        Reference: payload[:reference],
        LineItems: [
          {
            Description: payload[:description],
            Quantity: 1.0,
            UnitAmount: payload[:amount],
            AccountCode: '200' # Revenue account
          }
        ]
      }
    end
  end

  # MYOB adapter
  class MyobAdapter < BaseAdapter
    MYOB_API_URL = 'https://api.myob.com/accountright'.freeze

    def create_invoice(invoice)
      payload = invoice_payload(invoice)

      # TODO: Implement actual MYOB API call
      {
        success: true,
        external_invoice_id: "MYOB-INV-#{SecureRandom.hex(8)}",
        message: 'Invoice created successfully (placeholder)'
      }
    rescue => e
      { success: false, error: e.message }
    end

    def get_invoice_status(external_invoice_id)
      # TODO: Implement actual MYOB API call
      {
        success: true,
        status: 'Open',
        paid: false,
        paid_at: nil
      }
    rescue => e
      { success: false, error: e.message }
    end

    def get_statistics
      {
        success: true,
        total_invoices: 0,
        paid_invoices: 0,
        pending_invoices: 0
      }
    end
  end

  # QuickBooks adapter
  class QuickbooksAdapter < BaseAdapter
    QB_API_URL = 'https://quickbooks.api.intuit.com/v3'.freeze

    def create_invoice(invoice)
      payload = invoice_payload(invoice)

      # TODO: Implement actual QuickBooks API call
      {
        success: true,
        external_invoice_id: "QB-INV-#{SecureRandom.hex(8)}",
        message: 'Invoice created successfully (placeholder)'
      }
    rescue => e
      { success: false, error: e.message }
    end

    def get_invoice_status(external_invoice_id)
      # TODO: Implement actual QuickBooks API call
      {
        success: true,
        status: 'Unpaid',
        paid: false,
        paid_at: nil
      }
    rescue => e
      { success: false, error: e.message }
    end

    def get_statistics
      {
        success: true,
        total_invoices: 0,
        paid_invoices: 0,
        pending_invoices: 0
      }
    end
  end

  # Reckon adapter (similar to QuickBooks)
  class ReckonAdapter < QuickbooksAdapter
    # Reckon uses same API as QuickBooks
  end
end

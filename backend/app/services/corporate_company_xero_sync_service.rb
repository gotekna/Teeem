# CorporateCompanyXeroSyncService
#
# SSoT for syncing Xero data to local database for corporate companies.
# Handles: Monthly P&L, Chart of Accounts, Invoices, Balance Sheets
#
# Usage:
#   service = CorporateCompanyXeroSyncService.new(corporate_company)
#   service.sync_all                    # Sync everything
#   service.sync_monthly_pl             # Just monthly P&L
#   service.sync_monthly_pl(force: true) # Force refresh even if recently synced
#
class CorporateCompanyXeroSyncService
  SYNC_COOLDOWN = 1.hour  # Don't re-sync if synced within this time

  class SyncError < StandardError; end

  def initialize(corporate_company)
    @company = corporate_company
    @connection = corporate_company.corporate_company_xero_connection
  end

  # Sync all Xero data types
  def sync_all(force: false)
    return { success: false, error: "Company not connected to Xero" } unless connected?

    results = {}
    results[:monthly_pl] = sync_monthly_pl(force: force)
    results[:accounts] = sync_accounts(force: force)
    results[:invoices] = sync_invoices(force: force)

    # Update connection sync time
    @connection.update(last_sync_at: Time.current)

    {
      success: true,
      results: results
    }
  rescue StandardError => e
    Rails.logger.error("[CorporateXeroSync] sync_all failed for #{@company.id}: #{e.message}")
    { success: false, error: e.message }
  end

  # Sync Monthly P&L data (last 3 years)
  # NOTE: Xero API limits P&L reports to 365 days max per request
  def sync_monthly_pl(force: false, years: 3)
    return { success: false, error: "Company not connected to Xero" } unless connected?
    return { success: true, skipped: true, reason: "Recently synced" } if !force && recently_synced?(:monthly_pl)

    refresh_tokens_if_needed!

    client = XeroApiClient.new
    all_monthly_data = []
    today = Date.today

    # Fetch year by year due to 365-day limit
    years.times do |year_offset|
      period_end = today - (year_offset * 365)
      period_start = period_end - 364

      result = client.get(
        "Reports/ProfitAndLoss",
        tenant_id: @connection.xero_tenant_id,
        fromDate: period_start.to_s,
        toDate: period_end.to_s,
        periods: 12,
        timeframe: "MONTH"
      )

      next unless result[:success]

      report = result[:data]["Reports"]&.first
      next unless report

      monthly_data = parse_monthly_profit_loss(report)
      all_monthly_data.concat(monthly_data)
    end

    # Upsert to database
    saved_count = 0
    all_monthly_data.each do |data|
      next if data[:month_date].nil?

      CorporateCompanyMonthlyPl.upsert_from_xero(@company, data[:month_date], data)
      saved_count += 1
    rescue StandardError => e
      Rails.logger.warn("[CorporateXeroSync] Failed to save monthly PL for #{data[:month]}: #{e.message}")
    end

    # Update sync timestamp
    @connection.update(monthly_pl_synced_at: Time.current)

    {
      success: true,
      months_synced: saved_count,
      total_records: @company.corporate_company_monthly_pls.count
    }
  rescue StandardError => e
    Rails.logger.error("[CorporateXeroSync] sync_monthly_pl failed: #{e.message}")
    { success: false, error: e.message }
  end

  # Sync Chart of Accounts
  def sync_accounts(force: false)
    return { success: false, error: "Company not connected to Xero" } unless connected?
    return { success: true, skipped: true, reason: "Recently synced" } if !force && recently_synced?(:accounts)

    refresh_tokens_if_needed!

    client = XeroApiClient.new
    result = client.get(
      "Accounts",
      tenant_id: @connection.xero_tenant_id,
      access_token: @connection.access_token
    )

    unless result[:success]
      return { success: false, error: result[:error] || "Failed to fetch accounts" }
    end

    accounts = result[:data]["Accounts"] || []
    saved_count = 0

    accounts.each do |account_data|
      next if account_data["SystemAccount"].present?  # Skip system accounts

      xero_account = @connection.corporate_company_xero_accounts.find_or_initialize_by(
        xero_account_id: account_data["AccountID"]
      )

      xero_account.assign_attributes(
        account_code: account_data["Code"],
        account_name: account_data["Name"],
        account_type: account_data["Type"],
        account_class: account_data["Class"],
        tax_type: account_data["TaxType"],
        description: account_data["Description"],
        status: account_data["Status"],
        bank_account_number: account_data["BankAccountNumber"],
        currency_code: account_data["CurrencyCode"],
        reporting_code: account_data["ReportingCode"],
        reporting_code_name: account_data["ReportingCodeName"],
        enable_payments: account_data["EnablePaymentsToAccount"] || false,
        show_in_expense_claims: account_data["ShowInExpenseClaims"] || false,
        synced_at: Time.current
      )

      xero_account.save!
      saved_count += 1
    rescue StandardError => e
      Rails.logger.warn("[CorporateXeroSync] Failed to save account #{account_data["Code"]}: #{e.message}")
    end

    @connection.update(accounts_synced_at: Time.current)

    {
      success: true,
      accounts_synced: saved_count,
      total_accounts: @connection.corporate_company_xero_accounts.count
    }
  rescue StandardError => e
    Rails.logger.error("[CorporateXeroSync] sync_accounts failed: #{e.message}")
    { success: false, error: e.message }
  end

  # Sync Invoices (uses existing external_invoices table)
  def sync_invoices(force: false, months_back: 12)
    return { success: false, error: "Company not connected to Xero" } unless connected?
    return { success: true, skipped: true, reason: "Recently synced" } if !force && recently_synced?(:invoices)

    refresh_tokens_if_needed!

    client = XeroApiClient.new
    from_date = months_back.months.ago.beginning_of_month.to_date

    # Fetch invoices (both sales and bills)
    result = client.get(
      "Invoices",
      tenant_id: @connection.xero_tenant_id,
      access_token: @connection.access_token,
      params: {
        where: "Date >= DateTime(#{from_date.year}, #{from_date.month}, #{from_date.day})",
        order: "Date DESC"
      }
    )

    unless result[:success]
      return { success: false, error: result[:error] || "Failed to fetch invoices" }
    end

    invoices = result[:data]["Invoices"] || []
    saved_count = 0

    invoices.each do |invoice_data|
      external_invoice = ExternalInvoice.find_or_initialize_by(
        source: "xero",
        external_id: invoice_data["InvoiceID"],
        tenant_id: @connection.xero_tenant_id
      )

      external_invoice.assign_attributes(
        invoice_number: invoice_data["InvoiceNumber"],
        invoice_type: invoice_data["Type"],
        status: invoice_data["Status"],
        reference: invoice_data["Reference"],
        invoice_date: parse_xero_date(invoice_data["Date"]),
        due_date: parse_xero_date(invoice_data["DueDate"]),
        fully_paid_date: parse_xero_date(invoice_data["FullyPaidOnDate"]),
        subtotal: invoice_data["SubTotal"],
        total_tax: invoice_data["TotalTax"],
        total: invoice_data["Total"],
        amount_due: invoice_data["AmountDue"],
        amount_paid: invoice_data["AmountPaid"],
        currency_code: invoice_data["CurrencyCode"],
        external_contact_id: invoice_data.dig("Contact", "ContactID"),
        contact_name: invoice_data.dig("Contact", "Name"),
        line_items: invoice_data["LineItems"] || [],
        raw_data: invoice_data,
        external_updated_at: parse_xero_date(invoice_data["UpdatedDateUTC"])
      )

      external_invoice.save!
      saved_count += 1
    rescue StandardError => e
      Rails.logger.warn("[CorporateXeroSync] Failed to save invoice #{invoice_data["InvoiceNumber"]}: #{e.message}")
    end

    @connection.update(invoices_synced_at: Time.current)

    {
      success: true,
      invoices_synced: saved_count,
      total_invoices: ExternalInvoice.where(source: "xero", tenant_id: @connection.xero_tenant_id).count
    }
  rescue StandardError => e
    Rails.logger.error("[CorporateXeroSync] sync_invoices failed: #{e.message}")
    { success: false, error: e.message }
  end

  private

  def connected?
    @connection&.connected?
  end

  def recently_synced?(data_type)
    sync_time = case data_type
    when :monthly_pl then @connection.monthly_pl_synced_at
    when :accounts then @connection.accounts_synced_at
    when :invoices then @connection.invoices_synced_at
    when :balance_sheet then @connection.balance_sheet_synced_at
    else nil
    end

    sync_time.present? && sync_time > SYNC_COOLDOWN.ago
  end

  def refresh_tokens_if_needed!
    return unless @connection.needs_refresh?

    unless @connection.refresh_tokens!
      raise SyncError, "Failed to refresh Xero tokens. Please reconnect."
    end
  end

  # Parse Xero's multi-period P&L report into monthly data
  def parse_monthly_profit_loss(report)
    rows = report["Rows"] || []
    months = []
    revenue_values = []
    expenses_values = []
    net_profit_values = []

    # Extract month headers
    rows.each do |row|
      if row["RowType"] == "Header"
        cells = row["Cells"] || []
        cells[1..].each do |cell|
          month_str = cell["Value"]
          months << month_str if month_str.present?
        end
      end
    end

    # Extract values from sections
    rows.each do |row|
      case row["RowType"]
      when "Section"
        title = row["Title"]
        section_rows = row["Rows"] || []

        section_rows.each do |section_row|
          if section_row["RowType"] == "SummaryRow"
            cells = section_row["Cells"] || []
            label = cells.first&.dig("Value") || ""
            values = cells[1..].map { |c| parse_currency_value(c["Value"]) }

            case title
            when "Income"
              revenue_values = values if label.include?("Total")
            when /Expenses|Operating/
              expenses_values = values if label.include?("Total")
            end
          end
        end
      when "SummaryRow"
        cells = row["Cells"] || []
        label = cells.first&.dig("Value") || ""

        if label.include?("Net Profit") || label.include?("Net Income")
          net_profit_values = cells[1..].map { |c| parse_currency_value(c["Value"]) }
        end
      end
    end

    # Build monthly data array
    months.each_with_index.map do |month_str, idx|
      month_date = parse_month_string(month_str)
      {
        month: month_str,
        month_date: month_date,
        revenue: revenue_values[idx] || 0.0,
        expenses: expenses_values[idx] || 0.0,
        net_profit: net_profit_values[idx] || 0.0
      }
    end
  end

  def parse_currency_value(value)
    return 0.0 if value.blank?
    value.to_s.gsub(/[^0-9.\-]/, "").to_f
  end

  def parse_month_string(month_str)
    Date.parse("1 #{month_str}")
  rescue ArgumentError
    nil
  end

  def parse_xero_date(date_str)
    return nil if date_str.blank?

    if date_str.is_a?(String) && date_str.start_with?("/Date(")
      timestamp = date_str.match(/\/Date\((\d+)/)[1].to_i / 1000
      Time.at(timestamp).to_date
    else
      Date.parse(date_str.to_s)
    end
  rescue ArgumentError
    nil
  end
end

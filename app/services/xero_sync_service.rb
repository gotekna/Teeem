require 'httparty'

class XeroSyncService
  include HTTParty
  base_uri 'https://api.xero.com/api.xro/2.0'

  class SyncError < StandardError; end

  def initialize(connection)
    @connection = connection
    @auth_service = XeroAuthService.new(connection.company)
  end

  # Sync chart of accounts from Xero
  def sync_chart_of_accounts
    begin
      # Get valid access token
      access_token = @auth_service.get_valid_token(@connection)

      # Fetch accounts from Xero
      response = self.class.get(
        '/Accounts',
        headers: {
          'Authorization' => "Bearer #{access_token}",
          'Xero-tenant-id' => @connection.xero_tenant_id,
          'Accept' => 'application/json',
          'Content-Type' => 'application/json'
        }
      )

      unless response.success?
        error_message = "Failed to sync accounts: #{response.code} - #{response.body}"
        Rails.logger.error(error_message)
        @connection.mark_error!(error_message)
        raise SyncError, error_message
      end

      accounts_data = JSON.parse(response.body)['Accounts'] || []

      # Sync each account
      synced_count = 0
      accounts_data.each do |account_data|
        sync_account(account_data)
        synced_count += 1
      end

      # Mark sync as successful
      @connection.sync_successful!

      Rails.logger.info("Synced #{synced_count} accounts for #{@connection.company.name}")

      {
        success: true,
        synced_count: synced_count,
        total_accounts: @connection.company_xero_accounts.count
      }
    rescue XeroAuthService::AuthenticationError => e
      @connection.mark_error!(e.message)
      raise
    rescue StandardError => e
      error_message = "Sync failed: #{e.message}"
      Rails.logger.error(error_message)
      @connection.mark_error!(error_message)
      raise SyncError, error_message
    end
  end

  # Sync organization settings
  def sync_organization_settings
    begin
      access_token = @auth_service.get_valid_token(@connection)

      response = self.class.get(
        '/Organisation',
        headers: {
          'Authorization' => "Bearer #{access_token}",
          'Xero-tenant-id' => @connection.xero_tenant_id,
          'Accept' => 'application/json'
        }
      )

      if response.success?
        org_data = JSON.parse(response.body)['Organisations'].first

        # Update connection with organization settings
        @connection.update(
          accounting_method: org_data['SalesTaxBasis'], # CASH or ACCRUAL
          financial_year_end: parse_xero_date(org_data['FinancialYearEndMonth'], org_data['FinancialYearEndDay'])
        )

        Rails.logger.info("Synced organization settings for #{@connection.company.name}")
        { success: true }
      else
        Rails.logger.warn("Failed to sync organization settings: #{response.code}")
        { success: false, error: "Failed to fetch organization settings" }
      end
    rescue StandardError => e
      Rails.logger.error("Organization settings sync error: #{e.message}")
      { success: false, error: e.message }
    end
  end

  # Fetch Profit & Loss report (for Phase 2 consolidation)
  def fetch_profit_and_loss(from_date, to_date)
    begin
      access_token = @auth_service.get_valid_token(@connection)

      response = self.class.get(
        '/Reports/ProfitAndLoss',
        query: {
          fromDate: from_date.strftime('%Y-%m-%d'),
          toDate: to_date.strftime('%Y-%m-%d')
        },
        headers: {
          'Authorization' => "Bearer #{access_token}",
          'Xero-tenant-id' => @connection.xero_tenant_id,
          'Accept' => 'application/json'
        }
      )

      if response.success?
        report_data = JSON.parse(response.body)['Reports'].first
        {
          success: true,
          data: report_data
        }
      else
        {
          success: false,
          error: "Failed to fetch P&L: #{response.code}"
        }
      end
    rescue StandardError => e
      Rails.logger.error("P&L fetch error: #{e.message}")
      { success: false, error: e.message }
    end
  end

  # Fetch Balance Sheet report (for Phase 2 consolidation)
  def fetch_balance_sheet(as_at_date)
    begin
      access_token = @auth_service.get_valid_token(@connection)

      response = self.class.get(
        '/Reports/BalanceSheet',
        query: {
          date: as_at_date.strftime('%Y-%m-%d')
        },
        headers: {
          'Authorization' => "Bearer #{access_token}",
          'Xero-tenant-id' => @connection.xero_tenant_id,
          'Accept' => 'application/json'
        }
      )

      if response.success?
        report_data = JSON.parse(response.body)['Reports'].first
        {
          success: true,
          data: report_data
        }
      else
        {
          success: false,
          error: "Failed to fetch Balance Sheet: #{response.code}"
        }
      end
    rescue StandardError => e
      Rails.logger.error("Balance Sheet fetch error: #{e.message}")
      { success: false, error: e.message }
    end
  end

  private

  def sync_account(account_data)
    account = @connection.company_xero_accounts.find_or_initialize_by(
      xero_account_id: account_data['AccountID']
    )

    account.assign_attributes(
      account_code: account_data['Code'],
      account_name: account_data['Name'],
      account_type: account_data['Type'],
      account_class: account_data['Class'],
      tax_type: account_data['TaxType'],
      description: account_data['Description'],
      enable_payments_to_account: account_data['EnablePaymentsToAccount'] || false,
      show_in_expense_claims: account_data['ShowInExpenseClaims'] || false,
      status: account_data['Status'],
      reporting_code_value: account_data['ReportingCodeName']
    )

    account.save!
  end

  def parse_xero_date(month, day)
    return nil unless month.present? && day.present?
    # Create date for current year's financial year end
    Date.new(Date.today.year, month.to_i, day.to_i)
  rescue ArgumentError
    nil
  end
end

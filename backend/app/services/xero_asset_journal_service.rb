require "httparty"

# World-Class Asset Register - Xero Journal Integration
# Posts depreciation, purchase, and disposal journals to Xero
class XeroAssetJournalService
  include HTTParty
  base_uri "https://api.xero.com/api.xro/2.0"

  class JournalError < StandardError; end

  # Default account codes - should be configured per company
  DEFAULT_ACCOUNTS = {
    # Asset accounts (1xxx)
    fixed_assets_vehicles: "1600",
    fixed_assets_equipment: "1610",
    fixed_assets_property: "1620",
    accumulated_depreciation_vehicles: "1650",
    accumulated_depreciation_equipment: "1660",
    accumulated_depreciation_property: "1670",
    # Expense accounts (6xxx)
    depreciation_expense_vehicles: "6800",
    depreciation_expense_equipment: "6810",
    depreciation_expense_property: "6820",
    # Gain/Loss accounts
    gain_on_disposal: "4900",
    loss_on_disposal: "6900"
  }.freeze

  def initialize(connection)
    @connection = connection
    @company = connection.company
    @auth_service = XeroAuthService.new(@company)
    @account_codes = load_account_codes
  end

  # Post monthly depreciation journal for all assets
  # Debit: Depreciation Expense
  # Credit: Accumulated Depreciation
  def post_depreciation_journal(month, year)
    assets = Asset.where(company_id: @company.id)
                  .active
                  .joins(:depreciation_schedules)
                  .where(asset_depreciation_schedules: { status: "calculated" })

    return { success: true, message: "No assets to post" } if assets.empty?

    journal_lines = []
    total_depreciation = 0

    assets.each do |asset|
      # Get the schedule for the current financial year
      schedule = asset.depreciation_schedules.order(period_end: :desc).first
      next unless schedule

      # Calculate monthly depreciation (pro-rata from annual)
      monthly_book_dep = (schedule.book_depreciation / 12.0).round(2)
      next if monthly_book_dep <= 0

      total_depreciation += monthly_book_dep

      # Add expense line (debit)
      journal_lines << {
        expense_account: depreciation_expense_account(asset.asset_type),
        accumulated_account: accumulated_depreciation_account(asset.asset_type),
        amount: monthly_book_dep,
        description: "#{asset.display_name} - #{month}/#{year} depreciation"
      }
    end

    return { success: true, message: "No depreciation to post" } if journal_lines.empty?

    # Build Xero manual journal
    journal_payload = build_depreciation_journal_payload(journal_lines, month, year)

    # Post to Xero
    post_manual_journal(journal_payload)
  end

  # Post purchase journal when asset is created
  # Debit: Fixed Asset account
  # Credit: Bank/AP account (passed as parameter)
  def post_purchase_journal(asset, credit_account_code)
    return { success: false, error: "No purchase price" } unless asset.purchase_price&.positive?

    journal_payload = {
      Date: (asset.purchase_date || Date.current).strftime("%Y-%m-%d"),
      Narration: "Asset Purchase: #{asset.display_name}",
      Status: "POSTED",
      JournalLines: [
        {
          AccountCode: fixed_asset_account(asset.asset_type),
          Description: "#{asset.display_name} - Asset Purchase",
          LineAmount: asset.purchase_price.to_f,
          TaxType: "NONE"
        },
        {
          AccountCode: credit_account_code,
          Description: "#{asset.display_name} - Asset Purchase",
          LineAmount: -asset.purchase_price.to_f,
          TaxType: "NONE"
        }
      ]
    }

    result = post_manual_journal(journal_payload)

    if result[:success]
      # Record the journal ID on the asset
      asset.update(xero_purchase_journal_id: result[:journal_id])
    end

    result
  end

  # Post disposal journal when asset is disposed
  # Clears asset value and accumulated depreciation, records gain/loss
  def post_disposal_journal(disposal)
    asset = disposal.asset
    return { success: false, error: "Asset not found" } unless asset

    # Calculate values
    sale_proceeds = disposal.sale_proceeds || 0
    disposal_costs = disposal.disposal_costs || 0
    net_proceeds = sale_proceeds - disposal_costs

    book_wdv = disposal.book_wdv_at_disposal || asset.current_book_wdv
    original_cost = asset.purchase_price || 0
    accumulated_dep = original_cost - book_wdv

    # Calculate gain/loss
    gain_loss = net_proceeds - book_wdv
    is_gain = gain_loss >= 0

    journal_lines = [
      # Credit Fixed Asset (remove original cost)
      {
        AccountCode: fixed_asset_account(asset.asset_type),
        Description: "#{asset.display_name} - Asset Disposal",
        LineAmount: -original_cost.to_f,
        TaxType: "NONE"
      },
      # Debit Accumulated Depreciation (remove accumulated dep)
      {
        AccountCode: accumulated_depreciation_account(asset.asset_type),
        Description: "#{asset.display_name} - Clear Accumulated Depreciation",
        LineAmount: accumulated_dep.to_f,
        TaxType: "NONE"
      }
    ]

    # Add bank/proceeds line if there are proceeds
    if net_proceeds.positive?
      journal_lines << {
        AccountCode: @account_codes[:bank] || "1000",
        Description: "#{asset.display_name} - Sale Proceeds",
        LineAmount: net_proceeds.to_f,
        TaxType: "NONE"
      }
    end

    # Add gain or loss line
    if gain_loss != 0
      journal_lines << {
        AccountCode: is_gain ? @account_codes[:gain_on_disposal] : @account_codes[:loss_on_disposal],
        Description: "#{asset.display_name} - #{is_gain ? 'Gain' : 'Loss'} on Disposal",
        LineAmount: is_gain ? -gain_loss.to_f : gain_loss.abs.to_f,
        TaxType: "NONE"
      }
    end

    journal_payload = {
      Date: disposal.disposal_date.strftime("%Y-%m-%d"),
      Narration: "Asset Disposal: #{asset.display_name}",
      Status: "POSTED",
      JournalLines: journal_lines
    }

    result = post_manual_journal(journal_payload)

    if result[:success]
      disposal.update(xero_journal_id: result[:journal_id])
    end

    result
  end

  # Class method to post monthly depreciation for all companies
  def self.post_monthly_depreciation(month = nil, year = nil)
    month ||= Date.current.month
    year ||= Date.current.year

    results = { success: 0, failed: 0, errors: [] }

    CorporateXeroConnection.active.each do |connection|
      begin
        service = new(connection)
        result = service.post_depreciation_journal(month, year)

        if result[:success]
          results[:success] += 1
        else
          results[:failed] += 1
          results[:errors] << { company_id: connection.company_id, error: result[:error] }
        end
      rescue => e
        results[:failed] += 1
        results[:errors] << { company_id: connection.company_id, error: e.message }
      end
    end

    results
  end

  private

  def post_manual_journal(payload)
    access_token = @auth_service.get_valid_token(@connection)

    response = self.class.post(
      "/ManualJournals",
      headers: {
        "Authorization" => "Bearer #{access_token}",
        "Xero-tenant-id" => @connection.xero_tenant_id,
        "Accept" => "application/json",
        "Content-Type" => "application/json"
      },
      body: payload.to_json
    )

    if response.success?
      journal_data = JSON.parse(response.body)["ManualJournals"].first
      Rails.logger.info("Posted Xero journal: #{journal_data['ManualJournalID']}")

      {
        success: true,
        journal_id: journal_data["ManualJournalID"],
        message: "Journal posted successfully"
      }
    else
      error_message = parse_xero_error(response)
      Rails.logger.error("Failed to post Xero journal: #{error_message}")

      { success: false, error: error_message }
    end
  rescue XeroAuthService::AuthenticationError => e
    { success: false, error: "Authentication failed: #{e.message}" }
  rescue => e
    { success: false, error: "Unexpected error: #{e.message}" }
  end

  def build_depreciation_journal_payload(lines, month, year)
    # Group lines by account
    expense_totals = Hash.new(0)
    accumulated_totals = Hash.new(0)

    lines.each do |line|
      expense_totals[line[:expense_account]] += line[:amount]
      accumulated_totals[line[:accumulated_account]] += line[:amount]
    end

    journal_lines = []

    # Add expense lines (debit)
    expense_totals.each do |account, amount|
      journal_lines << {
        AccountCode: account,
        Description: "Monthly Depreciation - #{month}/#{year}",
        LineAmount: amount.round(2),
        TaxType: "NONE"
      }
    end

    # Add accumulated depreciation lines (credit)
    accumulated_totals.each do |account, amount|
      journal_lines << {
        AccountCode: account,
        Description: "Monthly Depreciation - #{month}/#{year}",
        LineAmount: -amount.round(2),
        TaxType: "NONE"
      }
    end

    {
      Date: Date.new(year, month, 1).end_of_month.strftime("%Y-%m-%d"),
      Narration: "Asset Depreciation - #{Date::MONTHNAMES[month]} #{year}",
      Status: "POSTED",
      JournalLines: journal_lines
    }
  end

  def load_account_codes
    # Load account codes from company settings or use defaults
    settings = @company.corporate_setting rescue nil

    if settings&.xero_asset_accounts.present?
      settings.xero_asset_accounts.symbolize_keys
    else
      DEFAULT_ACCOUNTS.dup
    end
  end

  def fixed_asset_account(asset_type)
    case asset_type
    when "vehicle"
      @account_codes[:fixed_assets_vehicles] || DEFAULT_ACCOUNTS[:fixed_assets_vehicles]
    when "equipment"
      @account_codes[:fixed_assets_equipment] || DEFAULT_ACCOUNTS[:fixed_assets_equipment]
    when "property"
      @account_codes[:fixed_assets_property] || DEFAULT_ACCOUNTS[:fixed_assets_property]
    else
      @account_codes[:fixed_assets_equipment] || DEFAULT_ACCOUNTS[:fixed_assets_equipment]
    end
  end

  def accumulated_depreciation_account(asset_type)
    case asset_type
    when "vehicle"
      @account_codes[:accumulated_depreciation_vehicles] || DEFAULT_ACCOUNTS[:accumulated_depreciation_vehicles]
    when "equipment"
      @account_codes[:accumulated_depreciation_equipment] || DEFAULT_ACCOUNTS[:accumulated_depreciation_equipment]
    when "property"
      @account_codes[:accumulated_depreciation_property] || DEFAULT_ACCOUNTS[:accumulated_depreciation_property]
    else
      @account_codes[:accumulated_depreciation_equipment] || DEFAULT_ACCOUNTS[:accumulated_depreciation_equipment]
    end
  end

  def depreciation_expense_account(asset_type)
    case asset_type
    when "vehicle"
      @account_codes[:depreciation_expense_vehicles] || DEFAULT_ACCOUNTS[:depreciation_expense_vehicles]
    when "equipment"
      @account_codes[:depreciation_expense_equipment] || DEFAULT_ACCOUNTS[:depreciation_expense_equipment]
    when "property"
      @account_codes[:depreciation_expense_property] || DEFAULT_ACCOUNTS[:depreciation_expense_property]
    else
      @account_codes[:depreciation_expense_equipment] || DEFAULT_ACCOUNTS[:depreciation_expense_equipment]
    end
  end

  def parse_xero_error(response)
    begin
      error_data = JSON.parse(response.body)
      if error_data["Elements"]&.first&.dig("ValidationErrors")
        error_data["Elements"].first["ValidationErrors"].map { |e| e["Message"] }.join(", ")
      elsif error_data["Message"]
        error_data["Message"]
      else
        "Unknown error: #{response.code}"
      end
    rescue
      "HTTP #{response.code}: #{response.body}"
    end
  end
end

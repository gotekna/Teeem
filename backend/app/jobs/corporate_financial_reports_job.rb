# frozen_string_literal: true

# CorporateFinancialReportsJob
#
# Generates monthly P&L and Balance Sheet reports for all Xero-connected corporate companies.
# Runs on the 1st of each month to capture the previous month's data.
#
# SSoT: Financial report storage
# - ProfitLossReport model (profit_loss_reports table)
# - BalanceSheetReport model (balance_sheet_reports table)
#
class CorporateFinancialReportsJob < ApplicationJob
  queue_as :low

  # @param options [Hash] Optional configuration
  #   - :company_ids [Array<Integer>] Specific company IDs to process (default: all connected)
  #   - :report_types [Array<String>] Which reports to generate: ['profit_loss', 'balance_sheet']
  #   - :financial_year [String] Override FY (default: current FY based on date)
  #   - :dry_run [Boolean] If true, logs what would be done without generating
  def perform(options = {})
    options = options.with_indifferent_access
    dry_run = options[:dry_run] || false
    report_types = options[:report_types] || %w[profit_loss balance_sheet]

    Rails.logger.info("[CorporateFinancialReportsJob] Starting#{' (DRY RUN)' if dry_run}")

    result = {
      companies_processed: 0,
      profit_loss_generated: 0,
      balance_sheet_generated: 0,
      skipped: 0,
      errors: []
    }

    # Get companies to process
    companies = fetch_companies(options[:company_ids])
    Rails.logger.info("[CorporateFinancialReportsJob] Found #{companies.count} companies to process")

    companies.each do |company|
      begin
        process_company(company, report_types, options, result, dry_run)
        result[:companies_processed] += 1
      rescue StandardError => e
        result[:errors] << { company_id: company.id, company_name: company.name, error: e.message }
        Rails.logger.error("[CorporateFinancialReportsJob] Error processing #{company.name}: #{e.message}")
      end
    end

    Rails.logger.info("[CorporateFinancialReportsJob] Completed: #{result.inspect}")
    result
  end

  private

  def fetch_companies(company_ids = nil)
    scope = CorporateCompany.includes(:company_xero_connection)
                            .joins(:company_xero_connection)
                            .where(company_xero_connections: { status: "connected" })

    if company_ids.present?
      scope = scope.where(id: company_ids)
    end

    scope.order(:name)
  end

  def process_company(company, report_types, options, result, dry_run)
    financial_year = options[:financial_year] || current_financial_year
    period = calculate_period(financial_year)

    Rails.logger.info("[CorporateFinancialReportsJob] Processing #{company.name} for #{financial_year}")

    # Generate P&L Report
    if report_types.include?("profit_loss")
      pl_result = generate_profit_loss(company, financial_year, period, dry_run)
      if pl_result[:generated]
        result[:profit_loss_generated] += 1
      elsif pl_result[:skipped]
        result[:skipped] += 1
      end
    end

    # Generate Balance Sheet Report
    if report_types.include?("balance_sheet")
      bs_result = generate_balance_sheet(company, financial_year, period, dry_run)
      if bs_result[:generated]
        result[:balance_sheet_generated] += 1
      elsif bs_result[:skipped]
        result[:skipped] += 1
      end
    end
  end

  def generate_profit_loss(company, financial_year, period, dry_run)
    # Check if report already exists and is completed
    existing = ProfitLossReport.for_company(company.id).for_financial_year(financial_year).first

    if existing&.completed?
      Rails.logger.info("[CorporateFinancialReportsJob] P&L already exists for #{company.name} #{financial_year}")
      return { skipped: true, reason: "already_exists" }
    end

    if dry_run
      Rails.logger.info("[CorporateFinancialReportsJob] DRY RUN: Would generate P&L for #{company.name}")
      return { generated: true, dry_run: true }
    end

    # Create or update report record
    report = existing || ProfitLossReport.new(
      company_id: company.id,
      company_name: company.name,
      company_code: company.code,
      financial_year: financial_year,
      period_start: period[:start],
      period_end: period[:end]
    )

    report.save! if report.new_record?
    report.generate!

    { generated: true, report_id: report.id }
  end

  def generate_balance_sheet(company, financial_year, period, dry_run)
    # Check if report already exists and is completed
    existing = BalanceSheetReport.for_company(company.id).for_financial_year(financial_year).first

    if existing&.completed?
      Rails.logger.info("[CorporateFinancialReportsJob] Balance Sheet already exists for #{company.name} #{financial_year}")
      return { skipped: true, reason: "already_exists" }
    end

    if dry_run
      Rails.logger.info("[CorporateFinancialReportsJob] DRY RUN: Would generate Balance Sheet for #{company.name}")
      return { generated: true, dry_run: true }
    end

    # Create or update report record
    report = existing || BalanceSheetReport.new(
      company_id: company.id,
      company_name: company.name,
      company_code: company.code,
      financial_year: financial_year,
      report_date: period[:end]
    )

    report.save! if report.new_record?
    report.generate!

    { generated: true, report_id: report.id }
  end

  def current_financial_year
    today = CompanySetting.in_company_timezone { Date.today }
    # Australian FY: July 1 - June 30
    # If we're in Jan-June, we're in FY of current year
    # If we're in July-Dec, we're in FY of next year
    if today.month >= 7
      "FY#{today.year + 1}"
    else
      "FY#{today.year}"
    end
  end

  def calculate_period(financial_year)
    # Parse FY2024 -> July 1, 2023 to June 30, 2024
    year = financial_year.gsub(/\D/, "").to_i
    {
      start: Date.new(year - 1, 7, 1),
      end: Date.new(year, 6, 30)
    }
  end
end

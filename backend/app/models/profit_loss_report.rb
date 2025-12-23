# frozen_string_literal: true

# == Schema Information
#
# Table name: profit_loss_reports
#
#  id                   :bigint           not null, primary key
#  company_id           :bigint           not null
#  company_name         :string           not null
#  company_code         :string
#  financial_year       :string           not null
#  report_date          :date
#  period_start         :date
#  period_end           :date
#  period               :string           # "Jan25", "Feb25", etc.
#  total_revenue        :decimal(15, 2)   default(0.0)
#  total_expenses       :decimal(15, 2)   default(0.0)
#  net_profit           :decimal(15, 2)   default(0.0)
#  report_data          :jsonb
#  cloudinary_public_id :string
#  cloudinary_url       :string
#  file_name            :string
#  file_size            :integer
#  status               :string           default("pending")
#  generated_at         :datetime
#  error_message        :text
#  created_at           :datetime         not null
#  updated_at           :datetime         not null
#
class ProfitLossReport < ApplicationRecord
  belongs_to :corporate_company, foreign_key: "company_id"

  # Validations
  validates :company_name, presence: true
  validates :financial_year, presence: true
  # Uniqueness: one report per company per month (period_end)
  # NULL period_end allowed for legacy annual reports
  validates :company_id, uniqueness: {
    scope: :period_end,
    message: "already has a P&L report for this period",
    if: -> { period_end.present? }
  }

  # Status scopes
  scope :pending, -> { where(status: "pending") }
  scope :generating, -> { where(status: "generating") }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }

  # Filter scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_financial_year, ->(fy) { where(financial_year: fy) }

  # Status methods
  def pending?
    status == "pending"
  end

  def generating?
    status == "generating"
  end

  def completed?
    status == "completed"
  end

  def failed?
    status == "failed"
  end

  # Mark as completed
  def mark_completed!(url: nil, file_name: nil, file_size: nil)
    update!(
      status: "completed",
      cloudinary_url: url,
      file_name: file_name,
      file_size: file_size,
      generated_at: Time.current,
      error_message: nil
    )
  end

  # Mark as failed
  def mark_failed!(error)
    update!(
      status: "failed",
      error_message: error,
      generated_at: Time.current
    )
  end

  # Generate the report from Xero
  def generate!
    return if generating?

    update!(status: "generating", error_message: nil)

    begin
      connection = corporate_company.company_xero_connection
      raise "Company is not connected to Xero" unless connection&.connected?

      # Fetch P&L from Xero
      client = XeroApiClient.new
      result = client.get_profit_and_loss(
        connection,
        from_date: period_start || financial_year_start_date,
        to_date: period_end || financial_year_end_date
      )

      if result[:success]
        # Parse totals from report
        parse_totals(result[:report])

        # Store raw data
        update!(report_data: result[:report])

        # Generate PDF and upload to SharePoint
        pdf_service = ProfitLossReportService.new(self)
        pdf_result = pdf_service.generate

        if pdf_result[:success]
          mark_completed!(
            url: pdf_result[:sharepoint_url],
            file_name: pdf_result[:filename],
            file_size: pdf_result[:pdf]&.bytesize
          )
        else
          # Data fetched successfully but PDF generation failed
          Rails.logger.warn("P&L data saved but PDF generation failed: #{pdf_result[:error]}")
          mark_completed!
        end
      else
        mark_failed!(result[:error] || "Failed to fetch P&L from Xero")
      end
    rescue StandardError => e
      Rails.logger.error("P&L report generation failed: #{e.message}")
      mark_failed!(e.message)
    end
  end

  # ============================================
  # CLASS METHODS: Historical Report Generation
  # ============================================

  # Generate monthly P&L reports for all months since Xero connection
  # Creates one report per month, from connection date to current month
  def self.generate_historical!(company)
    connection = company.company_xero_connection
    unless connection&.connected?
      Rails.logger.info("[ProfitLossReport] Company #{company.id} not connected to Xero - skipping historical generation")
      return { success: false, error: "Company is not connected to Xero", created: 0 }
    end

    # Determine date range: from Xero start date to LAST completed month
    # Use xero_start_date if set, otherwise fall back to connection created_at
    # Don't generate for current month (incomplete data)
    start_date = (connection.xero_start_date || connection.created_at.to_date).beginning_of_month
    end_date = Date.current.prev_month.end_of_month  # Last day of previous month
    company_code = company.code.presence || company.name[0..3].upcase

    created_count = 0
    skipped_count = 0
    errors = []

    # Generate for each month
    current_date = start_date
    while current_date <= end_date
      month_start = current_date.beginning_of_month
      month_end = current_date.end_of_month

      # Skip if report already exists for this period
      if exists?(company_id: company.id, period_end: month_end)
        skipped_count += 1
        current_date = current_date.next_month
        next
      end

      begin
        report = create!(
          company_id: company.id,
          company_name: company.name,
          company_code: company_code,
          financial_year: fiscal_year_for_date(month_end),
          period: month_end.strftime("%b%y"),          # "Jan25", "Feb25", etc.
          period_start: month_start,
          period_end: month_end,
          report_date: month_end,
          status: "pending"
        )

        # Generate the report (async-safe: could be moved to a job)
        report.generate!
        created_count += 1

        Rails.logger.info("[ProfitLossReport] Generated #{report.period} for company #{company.id}")
      rescue StandardError => e
        errors << { period: month_end.strftime("%b%y"), error: e.message }
        Rails.logger.error("[ProfitLossReport] Failed to generate #{month_end.strftime('%b%y')}: #{e.message}")
      end

      current_date = current_date.next_month
    end

    {
      success: errors.empty?,
      created: created_count,
      skipped: skipped_count,
      errors: errors
    }
  end

  # Calculate fiscal year for a given date (Australian FY: July-June)
  # Returns short format (FY24) to match WarehouseBankTransaction.financial_year
  # June 30, 2024 -> "FY24"
  # July 1, 2024 -> "FY25"
  def self.fiscal_year_for_date(date)
    year = date.month >= 7 ? date.year + 1 : date.year
    "FY#{year.to_s[-2..]}"
  end

  # ============================================
  # INSTANCE METHODS: Period Helpers
  # ============================================

  # Human-readable period label
  # Returns "January 2025" or falls back to financial year
  def period_label
    return period_end.strftime("%B %Y") if period_end.present?
    financial_year
  end

  # Display name for table views - follows Entity Config: {DocTypeName} {MonthYearLong}
  # Example: "Profit & Loss December 2025"
  # FY column is for searching (e.g., search "FY2026" to find all 12 months)
  # For legacy reports without period_end, fallback to FY
  def display_name
    if period_end.present?
      "P&L #{period_label}"  # "P&L December 2025"
    else
      "P&L #{financial_year}"  # "P&L FY2024" for legacy reports
    end
  end

  # Short period label for filenames
  # Returns "Jan25" or falls back to FY abbreviation
  def period_short
    return period if period.present?
    return period_end.strftime("%b%y") if period_end.present?
    financial_year.to_s.gsub(/FY?(\d{4})/) { "FY#{$1[-2..]}" }
  end

  private

  def financial_year_start_date
    # Parse FY2024 -> July 1, 2023
    year = financial_year.gsub(/\D/, "").to_i
    Date.new(year - 1, 7, 1)
  end

  def financial_year_end_date
    # Parse FY2024 -> June 30, 2024
    year = financial_year.gsub(/\D/, "").to_i
    Date.new(year, 6, 30)
  end

  def parse_totals(report)
    return unless report.is_a?(Hash) && report["Rows"].present?

    revenue = 0
    expenses = 0

    report["Rows"].each do |section|
      next unless section["RowType"] == "Section"

      title = section["Title"]&.downcase || ""

      section["Rows"]&.each do |row|
        next unless row["RowType"] == "SummaryRow"

        amount = row["Cells"]&.last&.dig("Value")&.to_f || 0

        if title.include?("income") || title.include?("revenue")
          revenue += amount
        elsif title.include?("expense") || title.include?("cost")
          expenses += amount.abs
        end
      end
    end

    update!(
      total_revenue: revenue,
      total_expenses: expenses,
      net_profit: revenue - expenses
    )
  end
end

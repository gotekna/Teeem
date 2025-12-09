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
  belongs_to :company

  # Validations
  validates :company_name, presence: true
  validates :financial_year, presence: true
  validates :company_id, uniqueness: { scope: :financial_year, message: "already has a P&L report for this financial year" }

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
      connection = company.company_xero_connection
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

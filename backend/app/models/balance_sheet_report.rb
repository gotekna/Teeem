# frozen_string_literal: true

# == Schema Information
#
# Table name: balance_sheet_reports
#
#  id                   :bigint           not null, primary key
#  company_id           :bigint           not null
#  company_name         :string           not null
#  company_code         :string
#  financial_year       :string           not null
#  report_date          :date
#  total_assets         :decimal(15, 2)   default(0.0)
#  total_liabilities    :decimal(15, 2)   default(0.0)
#  net_assets           :decimal(15, 2)   default(0.0)
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
class BalanceSheetReport < ApplicationRecord
  belongs_to :corporate_company, foreign_key: "company_id"

  # Validations
  validates :company_name, presence: true
  validates :financial_year, presence: true
  validates :company_id, uniqueness: { scope: :financial_year, message: "already has a Balance Sheet for this financial year" }

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

      # Fetch Balance Sheet from Xero
      client = XeroApiClient.new
      result = client.get_balance_sheet(
        connection,
        date: report_date || financial_year_end_date
      )

      if result[:success]
        # Parse totals from report
        parse_totals(result[:report])

        # Store raw data
        update!(report_data: result[:report])

        # Generate PDF and upload to SharePoint
        pdf_service = BalanceSheetReportService.new(self)
        pdf_result = pdf_service.generate

        if pdf_result[:success]
          mark_completed!(
            url: pdf_result[:sharepoint_url],
            file_name: pdf_result[:filename],
            file_size: pdf_result[:pdf]&.bytesize
          )
        else
          # Data fetched successfully but PDF generation failed
          Rails.logger.warn("Balance Sheet data saved but PDF generation failed: #{pdf_result[:error]}")
          mark_completed!
        end
      else
        mark_failed!(result[:error] || "Failed to fetch Balance Sheet from Xero")
      end
    rescue StandardError => e
      Rails.logger.error("Balance Sheet report generation failed: #{e.message}")
      mark_failed!(e.message)
    end
  end

  private

  def financial_year_end_date
    # Parse FY2024 -> June 30, 2024
    year = financial_year.gsub(/\D/, "").to_i
    Date.new(year, 6, 30)
  end

  def parse_totals(report)
    return unless report.is_a?(Hash) && report["Rows"].present?

    assets = 0
    liabilities = 0

    report["Rows"].each do |section|
      next unless section["RowType"] == "Section"

      title = section["Title"]&.downcase || ""

      section["Rows"]&.each do |row|
        next unless row["RowType"] == "SummaryRow"

        amount = row["Cells"]&.last&.dig("Value")&.to_f || 0

        if title.include?("asset")
          assets += amount
        elsif title.include?("liabilit")
          liabilities += amount.abs
        end
      end
    end

    update!(
      total_assets: assets,
      total_liabilities: liabilities,
      net_assets: assets - liabilities
    )
  end
end

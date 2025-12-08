# frozen_string_literal: true

# Stores generated bank statement PDF reports for ATO compliance.
# Reports are stored in Cloudinary and organized by bank account, FY, and month.
class BankStatementReport < ApplicationRecord
  # Scopes
  scope :completed, -> { where(status: "completed") }
  scope :pending, -> { where(status: "pending") }
  scope :failed, -> { where(status: "failed") }
  scope :for_bank_account, ->(id) { where(bank_account_id: id) }
  scope :for_financial_year, ->(fy) { where(financial_year: fy) }
  scope :monthly, -> { where(report_type: "monthly") }
  scope :annual, -> { where(report_type: "annual") }

  # Validations
  validates :bank_account_id, presence: true
  validates :bank_account_name, presence: true
  validates :financial_year, presence: true
  validates :bank_account_id, uniqueness: { scope: [:financial_year, :month] }

  # Generate or regenerate the PDF report
  def generate!
    update!(status: "generating", error_message: nil)

    # Build the PDF
    service = BankTransactionReportService.new(
      bank_account_id: bank_account_id,
      financial_year: financial_year,
      month: month
    )

    result = service.generate

    if result[:success]
      # Upload to Cloudinary
      upload_result = Cloudinary::Uploader.upload(
        StringIO.new(result[:pdf]),
        resource_type: "raw",
        folder: "teeem/bank_statements/#{financial_year}/#{bank_account_name.parameterize}",
        public_id: generate_public_id,
        format: "pdf"
      )

      update!(
        status: "completed",
        cloudinary_public_id: upload_result["public_id"],
        cloudinary_url: upload_result["secure_url"],
        file_name: result[:filename],
        file_size: result[:pdf].bytesize,
        transaction_count: result[:transaction_count],
        total_in: calculate_totals(result)[:in],
        total_out: calculate_totals(result)[:out],
        net_change: calculate_totals(result)[:net],
        generated_at: Time.current
      )

      { success: true, report: self }
    else
      update!(status: "failed", error_message: result[:error])
      { success: false, error: result[:error] }
    end
  rescue StandardError => e
    update!(status: "failed", error_message: e.message)
    Rails.logger.error("BankStatementReport#generate! failed: #{e.message}")
    { success: false, error: e.message }
  end

  # Get the period display string
  def period_display
    if month.present?
      Date.new(year, month, 1).strftime("%B %Y")
    else
      financial_year
    end
  end

  # Check if report needs regeneration (transactions updated since generation)
  def needs_regeneration?
    return true if status != "completed"
    return true if generated_at.nil?

    # Check if any transactions were updated after generation
    latest_transaction = WarehouseBankTransaction
      .where(bank_account_id: bank_account_id)
      .where(financial_year: financial_year)
      .where(month.present? ? { transaction_month: month } : {})
      .maximum(:updated_at)

    latest_transaction.present? && latest_transaction > generated_at
  end

  private

  def generate_public_id
    parts = [bank_account_name.parameterize]
    parts << financial_year
    parts << Date::MONTHNAMES[month] if month.present?
    parts << Time.current.strftime("%Y%m%d%H%M%S")
    parts.join("_")
  end

  def calculate_totals(result)
    # Get totals from transactions
    transactions = WarehouseBankTransaction
      .where(bank_account_id: bank_account_id)
      .where(financial_year: financial_year)

    transactions = transactions.where(transaction_month: month) if month.present?

    money_in = transactions.where(transaction_type: "RECEIVE").sum(:total)
    money_out = transactions.where(transaction_type: "SPEND").sum(:total)

    {
      in: money_in,
      out: money_out,
      net: money_in - money_out
    }
  end
end

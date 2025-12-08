# frozen_string_literal: true

# Stores generated bank statement PDF reports for ATO compliance.
# Reports are uploaded to SharePoint in the Warehousing/Bank Statements folder structure:
#   Warehousing/Bank Statements/{bank_account_name}/{FY}/{month}.pdf
# PDFs can be regenerated on demand from the underlying bank transaction data.
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
  validates :bank_account_id, uniqueness: { scope: [ :financial_year, :month ] }

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
      # Upload PDF to SharePoint
      sharepoint_result = upload_to_sharepoint(result[:pdf], result[:filename])

      update!(
        status: "completed",
        file_name: result[:filename],
        file_size: result[:pdf].bytesize,
        transaction_count: result[:transaction_count],
        total_in: calculate_totals(result)[:in],
        total_out: calculate_totals(result)[:out],
        net_change: calculate_totals(result)[:net],
        generated_at: Time.current,
        cloudinary_url: sharepoint_result&.dig(:web_url),
        cloudinary_public_id: sharepoint_result&.dig(:id)
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

  # Upload file content to SharePoint using folder structure:
  # Warehousing/Bank Statements/{bank_account_name}/{FY}/{filename}
  def upload_to_sharepoint(content, filename)
    credential = OrganizationOneDriveCredential.active_credential
    unless credential.present?
      Rails.logger.warn("[BankStatementReport] No SharePoint credentials found - skipping upload")
      return nil
    end

    graph_client = MicrosoftGraphClient.new(credential)

    # Get or create Warehousing folder at root
    warehousing_folder = graph_client.find_folder_in_drive_root("Warehousing")
    unless warehousing_folder
      warehousing_folder = graph_client.create_folder("Warehousing")
      Rails.logger.info("[BankStatementReport] Created SharePoint folder: Warehousing")
    end

    # Get or create Bank Statements subfolder
    bank_statements_folder = graph_client.get_or_create_subfolder(
      warehousing_folder["id"] || warehousing_folder[:id],
      "Bank Statements"
    )

    # Get or create bank account subfolder (e.g., "NAB - Tekna Homes")
    bank_folder = graph_client.get_or_create_subfolder(
      bank_statements_folder[:id] || bank_statements_folder["id"],
      bank_account_name
    )

    # Get or create FY subfolder (e.g., "FY24")
    fy_folder = graph_client.get_or_create_subfolder(
      bank_folder[:id] || bank_folder["id"],
      financial_year
    )

    # Upload the file
    upload_result = graph_client.upload_file_content(
      fy_folder[:id] || fy_folder["id"],
      filename,
      content
    )

    Rails.logger.info("[BankStatementReport] Uploaded to SharePoint: Warehousing/Bank Statements/#{bank_account_name}/#{financial_year}/#{filename}")
    upload_result
  rescue MicrosoftGraphClient::AuthenticationError => e
    Rails.logger.error("[BankStatementReport] SharePoint auth error: #{e.message}")
    nil
  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error("[BankStatementReport] SharePoint API error: #{e.message}")
    nil
  rescue StandardError => e
    Rails.logger.error("[BankStatementReport] SharePoint upload error: #{e.message}")
    nil
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

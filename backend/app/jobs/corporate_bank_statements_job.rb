# frozen_string_literal: true

# CorporateBankStatementsJob
#
# Generates monthly bank statement PDFs for all corporate bank accounts.
# Uses BankTransactionReportService with BankStatementTemplate branding.
# Uploads generated PDFs to SharePoint in the company's BANK folder.
#
# Runs on the 2nd of each month to generate statements for the previous month.
# (Runs after bank transaction sync completes)
#
# SSoT: Bank statement templates
# - BankStatementTemplate model (bank_statement_templates table)
# - Admin UI: Admin > System > Company > Doc Templates > Bank Statements
#
# SSoT: Uses StorageUploadable for provider-agnostic storage (Wasabi/S3/SharePoint)
#
class CorporateBankStatementsJob < ApplicationJob
  include StorageUploadable

  queue_as :low

  # @param options [Hash] Optional configuration
  #   - :company_ids [Array<Integer>] Specific company IDs to process (default: all with bank accounts)
  #   - :month [Integer] Month number 1-12 (default: previous month)
  #   - :year [Integer] Year (default: year of previous month)
  #   - :dry_run [Boolean] If true, logs what would be done without generating
  def perform(options = {})
    options = options.with_indifferent_access
    dry_run = options[:dry_run] || false

    # Calculate target month (default: previous month)
    # Use Brisbane timezone for TEEEM
    today = Time.current.in_time_zone("Australia/Brisbane").to_date
    target_date = options[:year] && options[:month] ?
      Date.new(options[:year].to_i, options[:month].to_i, 1) :
      today.prev_month

    target_month = target_date.month
    target_year = target_date.year
    month_start = Date.new(target_year, target_month, 1)
    month_end = month_start.end_of_month

    Rails.logger.info("[CorporateBankStatementsJob] Starting for #{month_start.strftime('%B %Y')}#{' (DRY RUN)' if dry_run}")

    result = {
      month: month_start.strftime("%B %Y"),
      companies_processed: 0,
      statements_generated: 0,
      statements_uploaded: 0,
      skipped: 0,
      errors: []
    }

    # Get companies with bank accounts
    companies = fetch_companies(options[:company_ids])
    Rails.logger.info("[CorporateBankStatementsJob] Found #{companies.count} companies to process")

    companies.each do |company|
      begin
        process_company(company, month_start, month_end, result, dry_run)
        result[:companies_processed] += 1
      rescue StandardError => e
        result[:errors] << { company_id: company.id, company_name: company.name, error: e.message }
        Rails.logger.error("[CorporateBankStatementsJob] Error processing #{company.name}: #{e.message}")
      end
    end

    Rails.logger.info("[CorporateBankStatementsJob] Completed: #{result.inspect}")
    result
  end

  private

  def fetch_companies(company_ids = nil)
    scope = CorporateCompany.includes(:bank_accounts)
                            .joins(:bank_accounts)
                            .where.not(bank_accounts: { xero_account_id: nil })
                            .distinct

    scope = scope.where(id: company_ids) if company_ids.present?
    scope.order(:name)
  end

  def process_company(company, month_start, month_end, result, dry_run)
    Rails.logger.info("[CorporateBankStatementsJob] Processing #{company.name}")

    # Get all bank accounts for this company
    bank_accounts = company.bank_accounts.where.not(xero_account_id: nil)

    bank_accounts.each do |bank_account|
      process_bank_account(company, bank_account, month_start, month_end, result, dry_run)
    end
  end

  def process_bank_account(company, bank_account, month_start, month_end, result, dry_run)
    account_name = bank_account.account_name || "Unknown"

    # Check if transactions exist for this period
    transaction_count = WarehouseBankTransaction.where(
      bank_account_id: bank_account.xero_account_id,
      transaction_date: month_start..month_end
    ).count

    if transaction_count == 0
      Rails.logger.info("[CorporateBankStatementsJob] No transactions for #{account_name} in #{month_start.strftime('%B %Y')}")
      result[:skipped] += 1
      return
    end

    Rails.logger.info("[CorporateBankStatementsJob] Generating statement for #{account_name} (#{transaction_count} transactions)")

    if dry_run
      Rails.logger.info("[CorporateBankStatementsJob] DRY RUN: Would generate statement for #{account_name}")
      result[:statements_generated] += 1
      return
    end

    # Calculate opening balance (sum of all transactions before month_start)
    opening_balance = calculate_opening_balance(bank_account.xero_account_id, month_start)

    # Generate PDF
    service = BankTransactionReportService.new(
      bank_account_id: bank_account.xero_account_id,
      bank_account: bank_account,
      start_date: month_start,
      end_date: month_end,
      opening_balance: opening_balance
    )

    pdf_result = service.generate

    if pdf_result[:success]
      result[:statements_generated] += 1

      # Upload to SharePoint
      upload_result = upload_to_sharepoint(company, bank_account, pdf_result, month_start)
      if upload_result[:success]
        result[:statements_uploaded] += 1
        Rails.logger.info("[CorporateBankStatementsJob] Uploaded #{pdf_result[:filename]} to SharePoint")
      else
        result[:errors] << {
          company_id: company.id,
          bank_account: account_name,
          error: "Upload failed: #{upload_result[:error]}"
        }
      end
    else
      result[:errors] << {
        company_id: company.id,
        bank_account: account_name,
        error: "PDF generation failed: #{pdf_result[:error]}"
      }
    end
  end

  def calculate_opening_balance(bank_account_id, month_start)
    # Sum all credits and subtract all debits before the month start
    transactions = WarehouseBankTransaction.where(
      bank_account_id: bank_account_id
    ).where("transaction_date < ?", month_start)

    balance = BigDecimal("0")

    transactions.find_each do |txn|
      amount = BigDecimal(txn.total.to_s)
      if txn.transaction_type == "RECEIVE"
        balance += amount
      else
        balance -= amount
      end
    end

    balance
  end

  def upload_to_storage(company, bank_account, pdf_result, month_date)
    # Build the filename with month/year
    month_year = month_date.strftime("%Y-%m")
    account_name_safe = (bank_account.account_name || "Account")
                        .gsub(/[^a-zA-Z0-9\-]/, "_")
                        .squeeze("_")
    filename = "Bank_Statement_#{account_name_safe}_#{month_year}.pdf"

    # Get storage path for company BANK folder
    # SSoT: Uses StorageConfiguration for path resolution
    storage_config = StorageConfiguration.instance
    base_path = File.join(storage_config.root_path, storage_config.path_for(:corporate))
    company_folder = company.sharepoint_folder_name || company.name.gsub(/[^a-zA-Z0-9\-\s]/, "").strip
    folder_path = "#{base_path}/#{company_folder}/BANK"

    # SSoT: Use StorageUploadable for provider-agnostic upload
    result = upload_to_storage_path(folder_path, pdf_result[:pdf], filename, content_type: "application/pdf")

    if result[:success]
      # Create CorporateCompanyDocument record so it appears in the BANK tab
      create_document_record(
        company: company,
        bank_account: bank_account,
        filename: filename,
        folder_path: folder_path,
        month_date: month_date,
        pdf_size: pdf_result[:pdf].bytesize,
        storage_url: result[:url],
        storage_file_id: result[:id]
      )

      { success: true, path: "#{folder_path}/#{filename}", url: result[:url] }
    else
      Rails.logger.error("[CorporateBankStatementsJob] Storage upload error: #{result[:error]}")
      { success: false, error: result[:error] }
    end
  end

  def create_document_record(company:, bank_account:, filename:, folder_path:, month_date:, pdf_size:, sharepoint_url:, sharepoint_file_id:)
    account_name = bank_account.account_name || "Account"
    month_name = month_date.strftime("%B %Y")

    # Calculate financial year (Australian: July-June)
    fy_year = month_date.month >= 7 ? month_date.year + 1 : month_date.year

    CorporateCompanyDocument.create!(
      company_id: company.id,
      company_code: company.code,
      file_name: filename,
      display_name: "Bank Statement - #{account_name} - #{month_name}",
      document_type: "Bank Statement",
      document_date: month_date.end_of_month,
      file_url: sharepoint_url,
      file_size: pdf_size,
      mime_type: "application/pdf",
      folder: "BANK",
      register_folder: "BANK",
      storage_type: "sharepoint",
      source: "generated",
      focus: "company",
      sharepoint_file_id: sharepoint_file_id,
      sharepoint_download_url: sharepoint_url,
      expected_sharepoint_path: "#{folder_path}/#{filename}",
      financial_years: [fy_year],
      uploaded_at: Time.current,
      last_modified_at: Time.current,
      # Mark as already verified since we generated it
      ai_verification_status: "verified",
      ai_verified_at: Time.current,
      ai_confidence_score: 100
    )

    Rails.logger.info("[CorporateBankStatementsJob] Created CorporateCompanyDocument for #{filename}")
  rescue StandardError => e
    # Log but don't fail the job - the PDF is already uploaded to SharePoint
    Rails.logger.error("[CorporateBankStatementsJob] Failed to create document record: #{e.message}")
  end
end
